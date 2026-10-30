// covers: r66（deep-research-runtime）——Run 作用域证据库把 web 与 notebook chunk 统一为稳定 id 的 evidence 行（并存），convert kind=evidence 经该库稳定 id 解析而非 URL hash。
// EV1 lock-test：先 seed 真实 source+chunk 行，recording agent 流产出引用该行
// 描述符的 retrieveSources 结果 + webSearch SERP 命中，内核 ingest 后断言
// research_evidences 两类行并存且各自暴露 ev_ 稳定 id。
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { eq } from 'drizzle-orm';

mock.module('../../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => [],
  webSearchTool: () => ({}),
}));

// Recording 'ai' mock：work_unit 流产出 retrieveSources（描述符取自测试 seed 的
// 真实 chunk 行，见 S.__r66ChunkDescriptor）与 webSearch 双通道工具结果。
const S = globalThis as Record<string | symbol, unknown>;

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: '双通道证据短综合' }),
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
  ToolLoopAgent: class {
    async stream(args: { options?: Record<string, unknown> } = {}) {
      const parts: Array<Record<string, unknown>> = [];
      if (args.options?.mode === 'work_unit') {
        parts.push({
          type: 'tool-result',
          toolName: 'retrieveSources',
          output: S.__r66ChunkDescriptor ?? [],
        });
        parts.push({
          type: 'tool-result',
          toolName: 'webSearch',
          output: [
            {
              title: 'SERP hit',
              url: 'https://example.com/serp',
              snippet: 'SERP snippet about the topic.',
              source: 'mock',
            },
          ],
        });
        parts.push({ type: 'text-delta', text: 'agent work done' });
      } else {
        parts.push({ type: 'text-delta', text: 'mock chat reply' });
      }
      const make = async function* () {
        for (const p of parts) yield p;
      };
      return {
        stream: make(),
        fullStream: make(),
        textStream: (async function* () {
          yield 'mock chat reply';
        })(),
      };
    }
  },
  isStepCount: (maxSteps: number) => ({ kind: 'stepCount', maxSteps }),
}));

import { insertChunk } from '../../src/db/chunks.ts';
import { notebooks, outputs, researchRuns, sources } from '../../src/db/schema.ts';
import { listEvidences } from '../../src/features/research/research-core.ts';
import { runNodeWorkUnit } from '../../src/features/research/work-unit.ts';
import {
  getOrm,
  seedChatModel,
  setupIntegrationEnv,
  stubEmbedding,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

let notebookId: number;

beforeAll(() => {
  setupIntegrationEnv();
  seedChatModel();
  notebookId = getOrm()
    .insert(notebooks)
    .values({ name: 'evidence-store-r66' })
    .returning()
    .get().id;
});

afterAll(teardownIntegrationEnv);

describe('r66: run-scoped evidence store unifies web + chunk rows', () => {
  it('dual-channel work-unit lands kind=chunk next to kind=web with stable ids; convert evidence resolves via the store', async () => {
    // seed：真实笔记本来源 + 一个 chunk 行（agent 检索命中的就是这一行）。
    const src = getOrm()
      .insert(sources)
      .values({
        notebookId,
        filename: 'seed-r66.md',
        mimeType: 'text/markdown',
        parserType: 'text',
        status: 'ready',
      })
      .returning()
      .get();
    const chunkText = '笔记本 chunk 证据：notebook chunk body about the topic.';
    const chunk = await insertChunk({ sourceId: src.id, chunkIndex: 0, text: chunkText });
    S.__r66ChunkDescriptor = [
      {
        chunkId: chunk.id,
        chunkIndex: 0,
        sourceId: src.id,
        sourceName: 'seed-r66.md',
        text: chunkText,
        score: 0.9,
      },
    ];

    const node = {
      id: 'n1',
      role: 'research' as const,
      title: '双通道检索节点',
      conclusionStatus: 'pending' as const,
    };
    const runId = getOrm()
      .insert(researchRuns)
      .values({
        notebookId,
        topic: 'r66 evidence store',
        status: 'running',
        useNotebookSources: true,
        sourceIds: [src.id],
        allowWeb: true,
        depth: 'shallow',
        maxSearches: 5,
        maxNodes: 10,
        searchesUsed: 0,
        maxPageFetches: 5,
        pagesUsed: 0,
        graph: { nodes: [node], edges: [] },
      })
      .returning()
      .get().id;

    const result = await runNodeWorkUnit({
      runId,
      notebookId,
      node,
      topic: 'r66 evidence store',
      allowWeb: true,
      useNotebookSources: true,
      sourceIds: [src.id],
      searchesUsed: 0,
      maxSearches: 5,
      abortSignal: new AbortController().signal,
    });
    expect(result.via).toBe('agent');

    // web 与 chunk 统一为同一 Run 作用域的 evidence 行，且各自暴露稳定 id。
    const evidences = await listEvidences(runId);
    const chunkEv = evidences.find((e) => e.kind === 'chunk');
    const webEv = evidences.find((e) => e.kind === 'web');
    expect(chunkEv).toBeDefined();
    expect(webEv).toBeDefined();
    expect(chunkEv!.id).toMatch(/^ev_/u);
    expect(webEv!.id).toMatch(/^ev_/u);
    expect(chunkEv!.sourceId).toBe(src.id);
    expect(chunkEv!.chunkId).toBe(String(chunk.id));
    expect(chunkEv!.snippet).toBe(chunkText.slice(0, 500));
    expect(chunkEv!.collectedAtNodeId).toBe('n1');
    expect(webEv!.url).toBe('https://example.com/serp');
    expect(webEv!.snippet).toBeTruthy();
    expect(result.evidenceIds).toEqual(expect.arrayContaining([chunkEv!.id, webEv!.id]));

    // convert kind=evidence 经证据库稳定 id 解析（标题/摘要来自该 evidence 行）。
    await stubEmbedding();
    const { convertToNote } = await import('../../src/features/research/convert.ts');
    const converted = await convertToNote(notebookId, runId, {
      artifact: { kind: 'evidence', evidenceId: chunkEv!.id },
    });
    expect(converted.type).toBe('PARAGRAPH');
    const out = getOrm().select().from(outputs).where(eq(outputs.id, converted.outputId)).get();
    const outContent = out?.content as { title?: string; text?: string };
    expect(outContent.title).toBe(chunkEv!.title);
    expect(outContent.text).toContain(chunkText.slice(0, 500));

    // 不稳定 URL hash 不是 evidenceId SSOT：以 URL 充当 id 解析必须失败。
    await expect(
      convertToNote(notebookId, runId, {
        artifact: { kind: 'evidence', evidenceId: 'https://example.com/serp' },
      }),
    ).rejects.toThrow(/not found/iu);
  });
});
