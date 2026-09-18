/**
 * c65 / sources-search-web: engine failure is `service_error` (distinct from
 * `no_results`), with a user-readable message. The zero-hit path must stay
 * `no_results` — the key contrast case.
 */
import { afterAll, beforeAll, describe, expect, it, mock, spyOn } from 'bun:test';

// Per-test engine behaviour via globalThis (hoisted module factory safe).
type EngineMode = 'reject' | 'empty' | 'hits';
const engineModeKey = '__c65SearchEngineMode' as const;

mock.module('../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => {
    const mode = ((globalThis as Record<symbol | string, unknown>)[engineModeKey] ??
      'hits') as EngineMode;
    if (mode === 'reject') throw new Error('searxng down (c65 mock)');
    if (mode === 'empty') return [];
    return [
      {
        title: 'Web Result',
        url: 'https://example.com/c65',
        snippet: 'snippet',
        source: 'searxng',
      },
    ];
  },
  webSearchTool: () => ({}),
}));

import { notebooks } from '../src/db/schema.ts';
import { createApp } from '../src/server.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from './helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm()
    .insert(notebooks)
    .values({ name: 'sources-c65-search' })
    .returning()
    .get().id;
});

afterAll(() => {
  delete (globalThis as Record<symbol | string, unknown>)[engineModeKey];
  teardownIntegrationEnv();
});

async function postSearch(): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/sources/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'crystalith', engine: 'searxng', mode: 'Fast Research' }),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('sources search error contract (c65)', () => {
  it('engine failure → service_error with readable message, empty results', async () => {
    (globalThis as Record<symbol | string, unknown>)[engineModeKey] = 'reject';
    // 刻意失败场景: 吞掉应用层 error 日志, 避免门禁输出把预期内的错误当误报
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { status, body } = await postSearch();
      expect(status).toBe(200);
      expect(body.status).toBe('service_error');
      expect(body.results).toEqual([]);
      expect(typeof body.message).toBe('string');
      expect(body.message).not.toBe('');
      expect(String(body.message)).toContain('搜索服务');
      expect(body.status).not.toBe('no_results');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('engine answers with zero hits → still no_results (contrast case)', async () => {
    (globalThis as Record<symbol | string, unknown>)[engineModeKey] = 'empty';
    const { status, body } = await postSearch();
    expect(status).toBe(200);
    expect(body.status).toBe('no_results');
    expect(body.results).toEqual([]);
  });

  it('engine hits → ok', async () => {
    (globalThis as Record<symbol | string, unknown>)[engineModeKey] = 'hits';
    const { status, body } = await postSearch();
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect((body.results as unknown[]).length).toBe(1);
  });
});
