// covers: r330
// outputs pipeline：preference=quality 且 needsRepair 为真时 MUST 再跑一次生成修补
// 以挽救可挽救输出；修补失败（抛错或仍不完整）则保留原对象并走后续
// postprocess/fallback；preference!=quality 时不触发二次生成。
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// 生成器 mock — 脚本化每次 generateOutputByType 的返回。
const generateCalls: string[] = [];
let script: Array<unknown | Error> = [];

mock.module('../../src/features/outputs/generator.ts', () => ({
  generateOutputByType: async (
    _model: unknown,
    type: string,
    _context: string,
    _prompt?: string,
  ) => {
    generateCalls.push(type);
    const behavior = script[Math.min(generateCalls.length - 1, script.length - 1)];
    if (behavior instanceof Error) throw behavior;
    return behavior;
  },
  buildOutputQuery: (type: string, prompt?: string) => prompt ?? type,
  OUTPUT_META: {},
  listOutputTypes: () => [],
}));

import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { runOutputPipeline } from '../../src/features/outputs/pipeline.ts';
import {
  getOrm,
  setupIntegrationEnv,
  stubEmbedding,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

let notebookId: number;
let chunkId: number;
const MODEL = {} as Parameters<typeof runOutputPipeline>[0]['model'];

beforeAll(async () => {
  setupIntegrationEnv();
  // 同 runtime.test.ts：stub 掉与修补环断言无关的 auto-index 副作用，
  // 消除「No embedding model configured」error 级噪音。
  await stubEmbedding();
  const orm = getOrm();
  notebookId = orm.insert(notebooks).values({ name: 'outputs-r330-repair' }).returning().get().id;
  const sourceId = orm
    .insert(sources)
    .values({ notebookId, filename: 'r330.md', status: 'ready' })
    .returning()
    .get().id;
  chunkId = orm
    .insert(chunks)
    .values({ sourceId, chunkIndex: 0, text: 'r330 repair loop context' })
    .returning()
    .get().id;
});

afterAll(teardownIntegrationEnv);

function run(preference: 'quality' | 'speed') {
  return runOutputPipeline({
    model: MODEL,
    notebookId,
    type: 'FAQ',
    chunkIds: [chunkId],
    prompt: 'r330 修补管线',
    preference,
  });
}

describe('outputs pipeline LLM repair loop (r330)', () => {
  it('quality + needsRepair runs a second generation and accepts the repaired output', async () => {
    generateCalls.length = 0;
    script = [
      { items: [] }, // 第一次：不完整 → needsRepair=true
      { items: [{ question: 'q1', answer: 'a1' }] }, // 修补：完整 → 接受
    ];

    const result = await run('quality');

    expect(generateCalls).toEqual(['FAQ', 'FAQ']);
    const content = result.content as Record<string, unknown>;
    expect(content._fallback).toBeUndefined();
    const items = content.items as Array<Record<string, unknown>>;
    expect(items[0]!.question).toBe('q1');
    expect(items[0]!.answer).toBe('a1');
  });

  it('quality + failing repair pass keeps the original object and falls back', async () => {
    generateCalls.length = 0;
    script = [{ items: [] }, new Error('repair pass blew up (r330 mock)')];

    const result = await run('quality');

    // 二次生成跑过且失败被吸收
    expect(generateCalls).toEqual(['FAQ', 'FAQ']);
    // 原对象保留 → postprocess 判空 → fallback 内容（_fallback 标记）
    const content = result.content as Record<string, unknown>;
    expect(content._fallback).toBe(true);
    expect(result.warnings).toContain('Generated content was empty — using fallback');
  });

  it('quality + still-incomplete repair also keeps the original object', async () => {
    generateCalls.length = 0;
    script = [
      { items: [] },
      { items: [{ question: '', answer: '' }] }, // 修补后仍不完整 → 不接受
    ];

    const result = await run('quality');

    expect(generateCalls).toEqual(['FAQ', 'FAQ']);
    const content = result.content as Record<string, unknown>;
    expect(content._fallback).toBe(true);
  });

  it('non-quality preference never runs the second generation', async () => {
    generateCalls.length = 0;
    script = [{ items: [] }, { items: [{ question: 'never', answer: 'reached' }] }];

    const result = await run('speed');

    expect(generateCalls).toEqual(['FAQ']);
    const content = result.content as Record<string, unknown>;
    expect(content._fallback).toBe(true);
  });
});
