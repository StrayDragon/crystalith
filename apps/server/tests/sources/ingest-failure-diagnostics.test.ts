// covers: r266（source-ingestion-management-and-tags）——摄取失败的来源实体携带
// 结构化诊断（status=failed + errorCode/errorMessage/recoveryHint/lastErrorAt），
// 四阶段错误码（含 PARSE_ERROR、EMBEDDING_FAILED）均有恢复提示，且诊断经 sources
// wire 面透出供 UI 给出可操作修复建议。
//
// Source failure diagnostics (c57/r266). Drives the real pipeline twice:
// a throwing parser (parse stage) and a throwing indexSource (embed stage —
// the same mechanism embed-timing.test.ts uses). VECTOR_STORE_FAILED /
// INGESTION_FAILED have no deterministic drive without corrupting the DB
// (vector_store is a reserved split of the embed stage, see pipeline.ts), so
// their hint legs are locked against the exported hints map.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// Stub 'ai' (server import starts worker loop).
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

import { eq } from 'drizzle-orm';
import type { Elysia } from 'elysia';

import { db } from '../../src/db/index.ts';
import { notebooks, sources } from '../../src/db/schema.ts';
import { registerParser } from '../../src/features/sources/parser-registry.ts';
import {
  INGESTION_STAGE_RECOVERY_HINTS,
  ingestSource,
} from '../../src/features/sources/pipeline.ts';
import { EmbedStrategy } from '../../src/rag/embed-strategy.ts';
import { createApp } from '../../src/server.ts';
import {
  getOrm,
  setupIntegrationEnv,
  stubEmbedding,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

const BASE = 'http://test.local';
const BOOM_ERROR = 'boom parse failure';
const BOOM_HINT = INGESTION_STAGE_RECOVERY_HINTS.PARSE_ERROR!;
const EMBED_HINT = INGESTION_STAGE_RECOVERY_HINTS.EMBEDDING_FAILED!;

let app: Elysia;

beforeAll(async () => {
  setupIntegrationEnv();
  await stubEmbedding();
  registerParser({
    id: 'boom',
    name: 'Boom',
    mimeTypes: ['application/x-boom'],
    extensions: ['.boom'],
    parse: async () => {
      throw new Error(BOOM_ERROR);
    },
  });
  app = createApp();
});

afterAll(teardownIntegrationEnv);

function sourceRow(id: number) {
  return db().select().from(sources).where(eq(sources.id, id)).get();
}

describe('r266 failed sources carry structured diagnostics', () => {
  it('parse-stage failure → PARSE_ERROR with actionable recovery hint on the entity', async () => {
    const nb = getOrm().insert(notebooks).values({ name: 'diag-parse' }).returning().get();

    const result = await ingestSource({
      buffer: new TextEncoder().encode('unparseable payload'),
      filename: 'broken.boom',
      notebookId: nb.id,
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('PARSE_ERROR');
    expect(result.errorMessage).toBe(BOOM_ERROR);

    const row = sourceRow(result.sourceId);
    expect(row?.status).toBe('failed');
    expect(row?.errorCode).toBe('PARSE_ERROR');
    expect(row?.errorMessage).toBe(BOOM_ERROR);
    expect(row?.recoveryHint).toBe(BOOM_HINT);
    expect(row?.lastErrorAt).not.toBeNull();
  });

  it('embed-stage failure → EMBEDDING_FAILED with actionable recovery hint on the entity', async () => {
    const nb = getOrm().insert(notebooks).values({ name: 'diag-embed' }).returning().get();
    const original = EmbedStrategy.prototype.indexSource;
    EmbedStrategy.prototype.indexSource = async () => {
      throw new Error('embedding API down');
    };

    try {
      const result = await ingestSource({
        buffer: new TextEncoder().encode('content that fails to embed'),
        filename: 'embed-fail.txt',
        notebookId: nb.id,
      });

      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('EMBEDDING_FAILED');

      const row = sourceRow(result.sourceId);
      expect(row?.status).toBe('failed');
      expect(row?.errorCode).toBe('EMBEDDING_FAILED');
      expect(row?.recoveryHint).toBe(EMBED_HINT);
      expect(row?.lastErrorAt).not.toBeNull();
    } finally {
      EmbedStrategy.prototype.indexSource = original;
    }
  });

  it('every ingestion stage code carries a non-empty recovery hint', () => {
    for (const code of [
      'PARSE_ERROR',
      'EMBEDDING_FAILED',
      'VECTOR_STORE_FAILED',
      'INGESTION_FAILED',
    ]) {
      expect(typeof INGESTION_STAGE_RECOVERY_HINTS[code]).toBe('string');
      expect(INGESTION_STAGE_RECOVERY_HINTS[code]!.length).toBeGreaterThan(0);
    }
  });

  it('diagnostics surface on the sources wire for the UI', async () => {
    const nb = getOrm().insert(notebooks).values({ name: 'diag-wire' }).returning().get();
    const fd = new FormData();
    fd.append(
      'file',
      new File(['broken wire payload'], 'wire.boom', { type: 'application/x-boom' }),
    );
    const upload = await app.handle(
      new Request(`${BASE}/v2/notebooks/${nb.id}/sources/upload`, { method: 'POST', body: fd }),
    );
    expect([200, 201]).toContain(upload.status);

    const list = await app.handle(new Request(`${BASE}/v2/notebooks/${nb.id}/sources`));
    expect(list.status).toBe(200);
    const body = (await list.json()) as {
      items: Array<{ filename: string; status: string; errorCode?: string; recoveryHint?: string }>;
    };
    const failed = body.items.find((s) => s.filename === 'wire.boom');
    expect(failed?.status).toBe('failed');
    expect(failed?.errorCode).toBe('PARSE_ERROR');
    expect(failed?.recoveryHint).toBe(BOOM_HINT);
  });
});
