// covers: r286/r288/r289/r291/r292/r298/r490/r491（source-ingestion-upload-and-url）——parser 能力路由、CSV 行分块、413 超限、from-url link/fetch 双模式、去重门控、同名不同内容 409 提示（kind=filename 三分支/内容命中优先/门控关闭直建）与 replace 换源级联清理。
// c117 — upload contract bare rules:
// - r286: supported formats are parser-driven (parsers listing + parserType routing)
// - r288: .csv extension + text/csv MIME are recognized and handled by the CSV parser
// - r289: CSV chunks by rows (markdown-table pages + csv_row_start/end metadata)
// - r291: oversized uploads rejected with 413 before any source row is created
// - r292: from-url mode=link registers the link without scraping the page body;
//         mode=fetch extracts the page body into retrievable chunks
// - r298: dedup gated by source_ingestion.dedup.enabled=false → skip dedup, create new
import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from 'bun:test';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

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
import { pluginRegistry } from '../../src/plugins/registry.ts';
import type { CrystalithPlugin } from '../../src/plugins/types.ts';
import { createApp } from '../../src/server.ts';
import { getDedupEnabled, getUploadMaxBytes, resetConfig } from '../../src/shared/config.ts';
import type { ExtractedContent } from '../../src/shared/extraction/types.ts';
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
  pluginRegistry.reset();
  pluginRegistry.register({ plugin: r292FakeExtractorPlugin(), source: 'builtin' });
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
  dedupAction?: 'prompt' | 'reuse' | 'create_new' | 'replace',
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

describe('r288: core CSV upload', () => {
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

describe('r289: CSV chunked by rows', () => {
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

describe('r286: supported formats are parser-driven', () => {
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

describe('r291: upload_max_bytes 413 guard', () => {
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

describe('r298: dedup disabled by config', () => {
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

// ---------------------------------------------------------------------------
// c134 r490 — same-filename soft dedup
// ---------------------------------------------------------------------------

describe('r490: same-filename uploads prompt instead of silently duplicating', () => {
  it('prompt returns 409 kind=filename; reuse returns the existing; create_new makes an independent row', async () => {
    const nb = makeNotebook('c134-filename-dedup');
    const first = await uploadFile(nb, '同名笔记.md', '# 第一版内容甲', 'text/markdown');
    expect(first.status).toBe(200);
    const firstId = (first.body as { sourceId: number }).sourceId;

    // Same name, different bytes — prompt (default) must not silently duplicate.
    const prompt = await uploadFile(nb, '同名笔记.md', '# 第二版内容乙（更新版）', 'text/markdown');
    expect(prompt.status).toBe(409);
    const promptDetails = (
      prompt.body as { details?: { kind?: string; existingSourceId?: number } }
    ).details;
    expect(promptDetails?.kind).toBe('filename');
    expect(promptDetails?.existingSourceId).toBe(firstId);

    // reuse skips the upload and returns the existing source.
    const reuse = await uploadFile(
      nb,
      '同名笔记.md',
      '# 第二版内容乙（更新版）',
      'text/markdown',
      'reuse',
    );
    expect(reuse.status).toBe(200);
    const reuseBody = reuse.body as { reused?: boolean; source?: { id: number } };
    expect(reuseBody.reused).toBe(true);
    expect(reuseBody.source?.id).toBe(firstId);

    // create_new keeps both as independent rows.
    const created = await uploadFile(
      nb,
      '同名笔记.md',
      '# 第二版内容乙（更新版）',
      'text/markdown',
      'create_new',
    );
    expect(created.status).toBe(200);
    expect((created.body as { sourceId: number }).sourceId).not.toBe(firstId);

    const rows = db()
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.notebookId, nb))
      .all();
    expect(rows.length).toBe(2);
  });

  it('identical content still wins as kind=content', async () => {
    const nb = makeNotebook('c134-content-priority');
    const content = '# 完全相同的字节内容';
    const first = await uploadFile(nb, '原文档.md', content, 'text/markdown');
    expect(first.status).toBe(200);

    // Same bytes AND same name → content hit, not filename hit.
    const dup = await uploadFile(nb, '原文档.md', content, 'text/markdown');
    expect(dup.status).toBe(409);
    const details = (dup.body as { details?: { kind?: string } }).details;
    expect(details?.kind).toBe('content');
  });

  it('gate off → same-filename upload creates directly without 409', async () => {
    const nb = makeNotebook('c134-gate-off');
    resetConfig({
      models: { defaults: {}, available: [] },
      raw: { source_ingestion: { dedup: { enabled: false } } },
    });
    const a = await uploadFile(nb, '同门.md', '# 甲版', 'text/markdown');
    const b = await uploadFile(nb, '同门.md', '# 乙版', 'text/markdown');
    expect(a.status).toBe(200);
    expect(b.status).toBe(200); // not 409 — both dedup layers skipped
  });
});

// ---------------------------------------------------------------------------
// c135 r491 — dedup replace swaps the old source
// ---------------------------------------------------------------------------

describe('r491: replace action', () => {
  it('same-name replace deletes the old source (cascades) and ingests the new bytes', async () => {
    const nb = makeNotebook('c135-replace');
    const first = await uploadFile(nb, '更新文档.md', '# 旧版本内容', 'text/markdown');
    expect(first.status).toBe(200);
    const oldId = (first.body as { sourceId: number }).sourceId;

    const replaced = await uploadFile(
      nb,
      '更新文档.md',
      '# 新版本内容：毕昇活字印刷术',
      'text/markdown',
      'replace',
    );
    expect(replaced.status).toBe(200);
    const newId = (replaced.body as { sourceId: number }).sourceId;
    expect(newId).not.toBe(oldId);

    // Old row + its chunks are gone; the new row carries the new text.
    const oldRow = db().select().from(sources).where(eq(sources.id, oldId)).all();
    expect(oldRow).toHaveLength(0);
    const newChunks = db()
      .select({ text: chunks.text })
      .from(chunks)
      .where(eq(chunks.sourceId, newId))
      .all();
    expect(newChunks.some((c) => c.text.includes('毕昇'))).toBe(true);
  });

  it('content-hit replace replaces that source and skips the filename prompt', async () => {
    const nb = makeNotebook('c135-replace-content');
    const first = await uploadFile(nb, '原文档.md', '# 完全相同内容丙', 'text/markdown');
    expect(first.status).toBe(200);
    const oldId = (first.body as { sourceId: number }).sourceId;

    // Same bytes, direct replace → not a 409: old replaced by fresh ingest.
    const replaced = await uploadFile(
      nb,
      '原文档.md',
      '# 完全相同内容丙',
      'text/markdown',
      'replace',
    );
    expect(replaced.status).toBe(200);
    expect((replaced.body as { sourceId: number }).sourceId).not.toBe(oldId);
    expect(db().select().from(sources).where(eq(sources.id, oldId)).all()).toHaveLength(0);
    const rows = db()
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.notebookId, nb))
      .all();
    expect(rows.length).toBe(1);
  });

  it('replace of a deterministically-invalid upload is rejected BEFORE the old source is deleted', async () => {
    // Regression guard (r491 review): the r290 empty-file precheck must run
    // ahead of the cascade delete — otherwise an empty replace destroys the
    // old source and loses the data for good. (415 unsupported-type is not
    // reachable through a same-name hit: the old row's filename already
    // resolved to a parser.)
    const nb = makeNotebook('c135-replace-precheck');
    const first = await uploadFile(nb, '保命文档.md', '# 不能丢的内容', 'text/markdown');
    expect(first.status).toBe(200);
    const oldId = (first.body as { sourceId: number }).sourceId;

    const empty = await uploadFile(nb, '保命文档.md', '', 'text/markdown', 'replace');
    expect(empty.status).toBe(400);
    expect((empty.body as { errorCode: string }).errorCode).toBe('INVALID_REQUEST');

    // The old source survived, chunks included.
    const row = db().select().from(sources).where(eq(sources.id, oldId)).all();
    expect(row).toHaveLength(1);
    expect(row[0]?.status).toBe('ready');
    expect(
      db().select({ id: chunks.id }).from(chunks).where(eq(chunks.sourceId, oldId)).all().length,
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// r292 — from-url link vs fetch modes
// ---------------------------------------------------------------------------

// IP-literal hosts skip DNS resolution inside validateUrlForFetch — required
// for hermetic from-url tests (same trick as extractor-selection.test.ts).
const R292_LINK_URL = 'https://93.184.216.34/r292-link-only';
const R292_FETCH_URL = 'https://93.184.216.34/r292-fetched-article';
const R292_PAGE_TOKEN = 'Crystalith静态扫描锚文本X7Q9';
const r292Attempts: string[] = [];

// r292: fake extractor returns a canned page body so mode=fetch exercises the
// real extraction→ingest pipeline without any outbound network call.
function r292FakeExtractorPlugin(): CrystalithPlugin {
  return {
    id: 'extractor-r292-page',
    kind: 'extractor',
    displayName: 'r292 fake page extractor',
    description: 'r292: returns a canned page body, no outbound network',
    configSchema: z.object({}),
    capabilities: [],
    factory: async () => ({
      name: 'r292-page',
      isAvailable: () => true,
      extract: async (): Promise<ExtractedContent> => {
        r292Attempts.push('r292-page');
        return {
          title: 'r292 fetched page',
          content: `<html><body><p>页面正文：${R292_PAGE_TOKEN}。</p></body></html>`,
          extractorUsed: 'r292-page',
        };
      },
    }),
  };
}

async function postFromUrl(
  notebookId: number,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const res = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/sources/from-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
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

describe('r292: from-url link and fetch modes', () => {
  it('mode=link registers the URL without scraping the page body', async () => {
    r292Attempts.length = 0;
    const nb = makeNotebook('r292-link-mode');

    const { status, body } = await postFromUrl(nb, {
      url: R292_LINK_URL,
      mode: 'link',
      title: '登记链接',
    });
    expect(status).toBe(201);
    const result = body as { sourceId: number; filename: string; mode: string };
    expect(result.mode).toBe('link');
    expect(result.filename).toBe('登记链接');

    // 不抓取网页正文：提取器零调用。
    expect(r292Attempts).toEqual([]);

    const row = db().select().from(sources).where(eq(sources.id, result.sourceId)).get();
    expect(row?.parserType).toBe('link');
    expect(row?.status).toBe('ready');
    expect(row?.metadata).toMatchObject({ url: R292_LINK_URL, mode: 'link' });

    // 仅登记链接来源：单一登记 chunk 含 URL，不含网页正文 token。
    const linkChunks = db().select().from(chunks).where(eq(chunks.sourceId, result.sourceId)).all();
    expect(linkChunks).toHaveLength(1);
    expect(linkChunks[0]?.text).toContain(R292_LINK_URL);
    expect(linkChunks[0]?.text).not.toContain(R292_PAGE_TOKEN);
  });

  it('mode=fetch scrapes the page body into retrievable chunks', async () => {
    r292Attempts.length = 0;
    const nb = makeNotebook('r292-fetch-mode');

    const { status, body } = await postFromUrl(nb, {
      url: R292_FETCH_URL,
      mode: 'fetch',
      extractor: 'r292-page',
    });
    expect(status).toBe(200);
    const result = body as {
      sourceId: number;
      chunkCount: number;
      status: string;
      extractedBy: string;
    };
    // 抓取动作真实发生（经由被固定的假提取器，无外网调用）。
    expect(result.extractedBy).toBe('r292-page');
    expect(r292Attempts).toEqual(['r292-page']);
    expect(result.status).toBe('ready');
    expect(result.chunkCount).toBeGreaterThan(0);

    // 页面正文进入可检索分块。
    const chunkRows = db().select().from(chunks).where(eq(chunks.sourceId, result.sourceId)).all();
    expect(chunkRows.length).toBeGreaterThan(0);
    expect(chunkRows.some((c) => c.text.includes(R292_PAGE_TOKEN))).toBe(true);
  });
});
