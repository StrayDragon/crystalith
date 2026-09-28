// covers: r261
// POST …/sources/search 的 mode 字段仅是网搜通道元数据（echo）：
//   - mode='Deep Research'（或同义）被归一化为 'Fast Research'，不触发/冒充 ResearchRun；
//   - 其他 mode 值按 caller 传入 echo；
//   - 缺省为 'Fast Research'。
// 断言路由级行为 + 全程零 ResearchRun 写入。
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

mock.module('../../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => [
    {
      title: 'Web Result',
      url: 'https://example.com/r261',
      snippet: 'snippet',
      source: 'searxng',
    },
  ],
  webSearchTool: () => ({}),
}));

import { eq } from 'drizzle-orm';

import { notebooks, researchRuns } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: ReturnType<typeof createApp>;
let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm()
    .insert(notebooks)
    .values({ name: 'sources-r261-mode' })
    .returning()
    .get().id;
});

afterAll(teardownIntegrationEnv);

async function postSearch(mode?: string): Promise<Record<string, unknown>> {
  const res = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/sources/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        mode === undefined
          ? { query: 'crystalith', engine: 'searxng' }
          : { query: 'crystalith', engine: 'searxng', mode },
      ),
    }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, unknown>;
}

function researchRunCount(): number {
  return getOrm()
    .select({ id: researchRuns.id })
    .from(researchRuns)
    .where(eq(researchRuns.notebookId, notebookId))
    .all().length;
}

describe('sources search mode is not Deep Research (r261)', () => {
  it('normalizes mode=Deep Research to Fast Research and never creates a ResearchRun', async () => {
    const body = await postSearch('Deep Research');
    expect(body.status).toBe('ok');
    expect(body.mode).toBe('Fast Research');
    expect(researchRunCount()).toBe(0);
  });

  it('echoes non-reserved mode values as web-search channel metadata', async () => {
    const body = await postSearch('Fast Research');
    expect(body.mode).toBe('Fast Research');

    const custom = await postSearch('Custom Channel');
    expect(custom.mode).toBe('Custom Channel');
    expect(researchRunCount()).toBe(0);
  });

  it('defaults to Fast Research when mode is omitted', async () => {
    const body = await postSearch();
    expect(body.status).toBe('ok');
    expect(body.mode).toBe('Fast Research');
    expect(researchRunCount()).toBe(0);
  });
});
