// Sources ingest + dedup + SSRF integration tests.
//
// Exercises the real sources router (POST /v2/sources/upload +
// /notebooks/:nid/sources/from-url) via the in-process Elysia app, against a
// temp DB with AI + embedding stubbed.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { eq } from 'drizzle-orm';

// Stub the 'ai' module before importing the server (which wires routers that
// may touch the AI runtime). Source ingest itself doesn't call the LLM, but
// the worker loop is started on server import, so keep the mock in place.
mock.module('ai', () => ({
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked' }),
  streamText: () => ({
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
}));

import type { Elysia } from 'elysia';

import { db } from '../../src/db/index.ts';
import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import {
  setupIntegrationEnv,
  teardownIntegrationEnv,
  getOrm,
  stubEmbedding,
} from '../helpers/integration.ts';

let app: Elysia;

const BASE = 'http://test.local';

beforeAll(async () => {
  setupIntegrationEnv();
  await stubEmbedding();
  app = createApp();
});

afterAll(() => {
  teardownIntegrationEnv();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function uploadFile(
  notebookId: number,
  filename: string,
  content: string,
  dedupAction?: 'prompt' | 'reuse' | 'create_new',
): Promise<{ status: number; body: unknown }> {
  const fd = new FormData();
  fd.append('file', new File([content], filename, { type: 'text/plain' }));
  const qs = dedupAction ? `&dedupAction=${dedupAction}` : '';
  const res = await app.handle(
    new Request(`${BASE}/v2/sources/upload?notebookId=${notebookId}${qs}`, {
      method: 'POST',
      body: fd,
    }),
  );
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

function makeNotebook(name: string): number {
  return getOrm().insert(notebooks).values({ name }).returning().get().id;
}

// ---------------------------------------------------------------------------
// Upload happy path
// ---------------------------------------------------------------------------

describe('sources upload + ingest', () => {
  it('parses a text file into chunks and marks the source ready', async () => {
    const nb = makeNotebook('upload-happy');
    const content = 'Hello world. '.repeat(100); // > 800 chars → ≥1 chunk
    const { status, body } = await uploadFile(nb, 'note.txt', content);
    expect(status).toBe(200);

    const result = body as { sourceId: number; status: string; chunkCount: number };
    expect(result.status).toBe('ready');
    expect(result.sourceId).toBeGreaterThan(0);

    // DB row reflects ready state.
    const row = db().select().from(sources).where(eq(sources.id, result.sourceId)).get();
    expect(row?.status).toBe('ready');
    expect(row?.dedupKey).toMatch(/^upload:sha256:/);

    // Chunks were inserted.
    const chunkRows = db().select().from(chunks).where(eq(chunks.sourceId, result.sourceId)).all();
    expect(chunkRows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Dedup branches
// ---------------------------------------------------------------------------

describe('source dedup', () => {
  it('returns 409 SOURCE_DEDUP_HIT on repeat upload with dedupAction=prompt', async () => {
    const nb = makeNotebook('dedup-prompt');
    const content = 'identical content for dedup test';
    await uploadFile(nb, 'a.txt', content);

    const { status, body } = await uploadFile(nb, 'b.txt', content, 'prompt');
    expect(status).toBe(409);
    // c54: errors now use the unified ErrorEnvelope (errorCode + message).
    // Dedup is surfaced as CONFLICT with existing_source_id in details.
    expect((body as { errorCode: string }).errorCode).toBe('CONFLICT');
    expect((body as { details: { existing_source_id?: number } }).details).toBeDefined();
  });

  it('reuses the existing source with dedupAction=reuse', async () => {
    const nb = makeNotebook('dedup-reuse');
    const content = 'reuse me content';
    const first = await uploadFile(nb, 'first.txt', content);
    const firstId = (first.body as { sourceId: number }).sourceId;

    const { status, body } = await uploadFile(nb, 'second.txt', content, 'reuse');
    expect(status).toBe(200);
    const result = body as { reused: boolean; source: { id: number } };
    expect(result.reused).toBe(true);
    expect(result.source.id).toBe(firstId);
  });

  it('creates a distinct source with dedupAction=create_new (default)', async () => {
    const nb = makeNotebook('dedup-createnew');
    const content = 'create new each time';
    const first = await uploadFile(nb, 'first.txt', content);
    const second = await uploadFile(nb, 'second.txt', content, 'create_new');

    const firstId = (first.body as { sourceId: number }).sourceId;
    const secondId = (second.body as { sourceId: number }).sourceId;
    expect(secondId).not.toBe(firstId);
  });

  it('does NOT report a conflict for the same content in a different notebook', async () => {
    // Regression guard: the dedup WHERE previously used `eq() && eq()` which
    // silently dropped the notebookId predicate, so identical bytes in
    // notebook B matched a source in notebook A.
    const nbA = makeNotebook('cross-a');
    const nbB = makeNotebook('cross-b');
    const content = 'shared bytes across notebooks';
    await uploadFile(nbA, 'shared.txt', content);

    const { status, body } = await uploadFile(nbB, 'shared.txt', content, 'prompt');
    expect(status).toBe(200); // not 409
    expect((body as { sourceId: number }).sourceId).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// SSRF guard (URL ingest)
// ---------------------------------------------------------------------------

describe('SSRF guard on URL ingest', () => {
  it('blocks file:// scheme with 422', async () => {
    const nb = makeNotebook('ssrf-file');
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${nb}/sources/from-url`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'file:///etc/passwd' }),
      }),
    );
    expect(res.status).toBe(422);
    // Shared SourceFromUrlRequestSchema rejects non-http(s) before SSRF probe.
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/http:\/\/|https:\/\/|validation/i);
  });

  it('blocks the metadata-IP literal 169.254.169.254 with 422', async () => {
    const nb = makeNotebook('ssrf-meta');
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${nb}/sources/from-url`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data/' }),
      }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe('SSRF blocked');
  });
});
