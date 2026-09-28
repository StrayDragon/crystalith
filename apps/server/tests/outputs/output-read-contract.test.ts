// covers: r202
// POST /v2/notebooks/:nid/outputs MUST 返回 camelCase OutputRead 实体
// （id/notebookId/type/prompt/chunkIds/content/createdAt/updatedAt），
// 与 packages/shared OutputSchema wire 契约一致；MUST NOT 返回 snake_case
// 或裸 PipelineResult。
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { OutputSchema } from '@crystalith/shared';

import { notebooks } from '../../src/db/schema.ts';
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
    .values({ name: 'outputs-r202-read-contract' })
    .returning()
    .get().id;
});

afterAll(teardownIntegrationEnv);

/** PARAGRAPH + content 走手工登记路径 — 无需模型。 */
async function postOutput(): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/outputs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'PARAGRAPH',
        prompt: 'r202 合同检查',
        content: { text: '# r202\n\n正文内容' },
      }),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('POST outputs returns OutputRead contract (r202)', () => {
  it('response parses against shared OutputSchema with camelCase fields', async () => {
    const { status, body } = await postOutput();
    expect(status).toBe(201);

    const parsed = OutputSchema.safeParse(body);
    expect(parsed.success).toBe(true);

    // camelCase 实体字段逐项断言
    expect(typeof body.id === 'number').toBe(true);
    expect(body.notebookId).toBe(notebookId);
    expect(body.type).toBe('PARAGRAPH');
    expect(body.prompt).toBe('r202 合同检查');
    expect(Array.isArray(body.chunkIds)).toBe(true);
    expect((body.content as Record<string, unknown>).text).toContain('正文内容');
    expect(typeof body.createdAt).toBe('string');
    expect(typeof body.updatedAt).toBe('string');

    const keys = new Set(Object.keys(body));
    for (const camel of [
      'id',
      'notebookId',
      'type',
      'chunkIds',
      'content',
      'createdAt',
      'updatedAt',
    ]) {
      expect(keys.has(camel)).toBe(true);
    }
  });

  it('response is not snake_case and not a bare PipelineResult', async () => {
    const { body } = await postOutput();

    const keys = Object.keys(body);
    for (const snake of ['chunk_ids', 'notebook_id', 'created_at', 'updated_at', 'source_ids']) {
      expect(keys).not.toContain(snake);
    }

    // 裸 PipelineResult 形状（outputId/chunkCount/citations/warnings）不得外泄
    for (const pipelineKey of ['outputId', 'chunkCount', 'citations', 'warnings']) {
      expect(keys).not.toContain(pipelineKey);
    }
  });
});
