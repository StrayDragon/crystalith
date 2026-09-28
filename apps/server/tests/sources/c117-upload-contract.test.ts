// c117 — upload contract bare rules:
// - r286: supported formats are parser-driven (parsers listing + parserType routing)
// - r288: .csv extension + text/csv MIME are recognized and handled by the CSV parser
// - r289: CSV chunks by rows (markdown-table pages + csv_row_start/end metadata)
// - r291: oversized uploads rejected with 413 before any source row is created
// - r298: dedup gated by source_ingestion.dedup.enabled=false → skip dedup, create new
import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from 'bun:test';

import { and, eq } from 'drizzle-orm';

// Stub the 'ai' module before importing the server (worker loop starts on import).
mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked' }),
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
}));

import type { Elysia } from 'elysia';

import { db } from '../../src/db/index.ts';
import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { getDedupEnabled, getUploadMaxBytes, resetConfig } from '../../src/shared/config.ts';
import {
  getOrm,
  setupIntegrationEnv,
  stubEmbedding,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

let app: Elysia;
const BASE = 'http://test.local';

beforeAll(async () => {
  setupIntegrationEnv();
  await stubEmbedding();
  app = createApp();
});

afterAll(teardownIntegrationEnv);

// Config overrides must not leak into later tests of this file.
afterEach(() => {
  resetConfig(null);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function uploadFile(
  notebookId: number,
  filename: string,
  content: string,
  type = 'text/plain',
  dedupAction?: 'prompt' | 'reuse' | 'create_new',
): Promise<{ status: number; body: unknown }> {
  const fd = new FormData();
  fd.append('file', new File([content], filename, { type }));
  const qs = dedupAction ? `?dedupAction=${dedupAction}` : '';
  const res = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/sources/upload${qs}`, {
      method: 'POST',
      body: fd,
    }),
  );
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function makeNotebook(name: string): number {
  return getOrm().insert(notebooks).values({ name }).returning().get().id;
}

function csvContent(rows: number): string {
  const lines = ['id,name,note'];
  for (let i = 1; i <= rows; i++) {
    lines.push(`${i},item-${i},row ${i}`);
  }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// r288 — CSV upload is parser-driven supported format
// ---------------------------------------------------------------------------

describe('c117 r288: core CSV upload', () => {
  it('routes a text/csv upload to the CSV parser and marks it ready', async () => {
    const nb = makeNotebook('c117-csv-mime');
    const { status, body } = await uploadFile(nb, 'data.csv', csvContent(5), 'text/csv');

    expect(status).toBe(200);
    const result = body as {
      sourceId: number;
      parserType: string;
      status: string;
      chunkCount: number;
      text: string;
    };
    expect(result.parserType).toBe('csv');
    expect(result.status).toBe('ready');
    expect(result.chunkCount).toBe(1);

    const row = db().select().from(sources).where(eq(sources.id, result.sourceId)).get();
    expect(row?.parserType).toBe('csv');

    // Chunks are markdown tables (canonical csv-parser-markdown-table).
    const chunkRows = db().select().from(chunks).where(eq(chunks.sourceId, result.sourceId)).all();
    expect(chunkRows[0]?.text).toContain('| id | name | note |');
    expect(chunkRows[0]?.text).toContain('| 1 | item-1 | row 1 |');
  });

  it('recognizes the .csv extension when no MIME type is provided', async () => {
    const nb = makeNotebook('c117-csv-ext');
    // Empty File type → MIME detection must fall back to the .csv extension.
    const { status, body } = await uploadFile(nb, 'table.csv', csvContent(3), '');

    expect(status).toBe(200);
    const result = body as { parserType: string; status: string };
    expect(result.parserType).toBe('csv');
    expect(result.status).toBe('ready');
  });
});

// ---------------------------------------------------------------------------
// r289 — CSV chunking by rows
// ---------------------------------------------------------------------------

describe('c117 r289: CSV chunked by rows', () => {
  it('splits 120 rows into 50-row markdown-table chunks with contiguous csv_row metadata', async () => {
    const nb = makeNotebook('c117-csv-rows');
    const { status, body } = await uploadFile(nb, 'big.csv', csvContent(120), 'text/csv');
    expect(status).toBe(200);

    const result = body as { sourceId: number; chunkCount: number };
    expect(result.chunkCount).toBe(3); // ceil(120 / 50)

    const chunkRows = db()
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, result.sourceId))
      .orderBy(chunks.chunkIndex)
      .all();
    expect(chunkRows.length).toBe(3);

    const spans = chunkRows.map((c) => {
      const meta = c.metadata as { csv_row_start?: number; csv_row_end?: number };
      return { start: meta.csv_row_start, end: meta.csv_row_end };
    });
    // 1-based, contiguous, canonical csv_row_start/csv_row_end metadata.
    expect(spans).toEqual([
      { start: 1, end: 50 },
      { start: 51, end: 100 },
      { start: 101, end: 120 },
    ]);

    // Every chunk is a self-contained markdown table repeating the header.
    for (const c of chunkRows) {
      expect(c.text).toStartWith('| id | name | note |');
      expect(c.text).toContain('| --- | --- | --- |');
    }
    // No single oversized chunk: row 120 lives in the last chunk only.
    expect(chunkRows[0]?.text).not.toContain('item-120');
    expect(chunkRows[2]?.text).toContain('item-120');
  });
});

// ---------------------------------------------------------------------------
// r286 — supported formats are parser-driven
// ---------------------------------------------------------------------------

describe('c117 r286: supported formats are parser-driven', () => {
  it('exposes parser capabilities (mime types + extensions) via the parsers listing', async () => {
    const res = await app.handle(new Request(`${BASE}/v2/sources/parsers`));
    expect(res.status).toBe(200);
    const parsers = (await res.json()) as Array<{
      id: string;
      mimeTypes: string[];
      extensions: string[];
    }>;
    const csv = parsers.find((p) => p.id === 'csv');
    expect(csv?.mimeTypes).toContain('text/csv');
    expect(csv?.extensions).toContain('.csv');
    const text = parsers.find((p) => p.id === 'text');
    expect(text?.extensions).toEqual(expect.arrayContaining(['.txt', '.md', '.markdown']));
  });

  it('routes a markdown upload by parser ability and records parserType', async () => {
    const nb = makeNotebook('c117-md-parser');
    const { status, body } = await uploadFile(nb, 'note.md', '# 标题\n\n正文段落', 'text/markdown');
    expect(status).toBe(200);
    const result = body as { sourceId: number; parserType: string; status: string };
    // text/markdown + .md belong to the text parser's capability set.
    expect(result.parserType).toBe('text');
    expect(result.status).toBe('ready');

    const row = db().select().from(sources).where(eq(sources.id, result.sourceId)).get();
    expect(row?.parserType).toBe('text');
  });
});

// ---------------------------------------------------------------------------
// r291 — oversized uploads rejected with 413 before creating a source
// ---------------------------------------------------------------------------

describe('c117 r291: upload_max_bytes 413 guard', () => {
  it('rejects uploads over the configured limit with 413 and creates no source row', async () => {
    const nb = makeNotebook('c117-413');
    const before = db()
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.notebookId, nb))
      .all();

    resetConfig({
      models: { defaults: {}, available: [] },
      raw: { app: { http_guardrails: { upload_max_bytes: 64 } } },
    });
    expect(getUploadMaxBytes()).toBe(64);

    const { status, body } = await uploadFile(nb, 'big.txt', 'x'.repeat(200));
    expect(status).toBe(413);
    const envelope = body as {
      errorCode: string;
      details: { maxBytes: number; uploadedBytes: number };
    };
    expect(envelope.errorCode).toBe('PAYLOAD_TOO_LARGE');
    expect(envelope.details.maxBytes).toBe(64);
    expect(envelope.details.uploadedBytes).toBe(200);

    const after = db()
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.notebookId, nb))
      .all();
    expect(after.length).toBe(before.length);
  });
});

// ---------------------------------------------------------------------------
// r298 — dedup gated by config
// ---------------------------------------------------------------------------

describe('c117 r298: dedup disabled by config', () => {
  it('skips dedup and creates a new source when source_ingestion.dedup.enabled=false', async () => {
    const nb = makeNotebook('c117-dedup-off');
    const content = 'identical bytes for the dedup gate test';

    resetConfig({
      models: { defaults: {}, available: [] },
      raw: { source_ingestion: { dedup: { enabled: false } } },
    });
    expect(getDedupEnabled()).toBe(false);

    const first = await uploadFile(nb, 'a.txt', content, 'text/plain', 'prompt');
    expect(first.status).toBe(200);
    const second = await uploadFile(nb, 'b.txt', content, 'text/plain', 'prompt');
    expect(second.status).toBe(200); // not 409 — dedup skipped entirely

    const firstId = (first.body as { sourceId: number }).sourceId;
    const secondId = (second.body as { sourceId: number }).sourceId;
    expect(secondId).not.toBe(firstId);

    const rows = db()
      .select({ dedupKey: sources.dedupKey })
      .from(sources)
      .where(and(eq(sources.notebookId, nb), eq(sources.status, 'ready')))
      .all();
    expect(rows.length).toBe(2);
    // Gate off → no dedup key computed at all.
    for (const r of rows) expect(r.dedupKey).toBeNull();
  });

  it('keeps the default gate open (dedup enabled) so a repeat upload still conflicts', async () => {
    resetConfig({ models: { defaults: {}, available: [] }, raw: {} });
    expect(getDedupEnabled()).toBe(true);

    const nb = makeNotebook('c117-dedup-default');
    const content = 'default gate content';
    await uploadFile(nb, 'a.txt', content);
    const { status, body } = await uploadFile(nb, 'b.txt', content, 'text/plain', 'prompt');
    expect(status).toBe(409);
    expect((body as { errorCode: string }).errorCode).toBe('CONFLICT');
  });
});
