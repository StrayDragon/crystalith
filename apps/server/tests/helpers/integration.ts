// Integration test helpers — fresh temp DB + AI SDK mock setup.
//
// Usage in a test file:
//   import { setupIntegrationEnv, teardownIntegrationEnv, getOrm } from '../helpers/integration.ts';
//   beforeAll(setupIntegrationEnv);
//   afterAll(teardownIntegrationEnv);
import { afterAll, beforeAll, mock } from 'bun:test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { createDb, resetDb, type Orm } from '../../src/db/index.ts';
import {
  activeLoops,
  ensureRunAbortController,
} from '../../src/features/research/research-core.ts';
import { resetConfig } from '../../src/shared/config.ts';

const TMP_DIR = join(import.meta.dirname, '..', '..', 'data');

// 每个 setup 调用生成唯一文件名(随机后缀), 各自 teardown 清理, 文件间解耦。
// 避免 `test-integration-<pid>.db` 被后一文件删掉前一文件正在使用的数据库
// （后台 agent / 后台 loop 等写路径可能 busy），也避免 ledger/run 状态串文件。
// `--parallel`（implied --isolate）下每文件独立模块表 + 独立 worker，唯一名
// 保证 worker 之间（不同 pid）也不会碰撞。
let tmpDbPaths: string[] | null = null;

let orm: Orm;

/** Point the db() singleton at a fresh temp DB (runs migrations + vec setup). */
export function setupIntegrationEnv(): void {
  const db = join(TMP_DIR, `test-integration-${process.pid}-${crypto.randomUUID().slice(0, 8)}.db`);
  tmpDbPaths = [db, `${db}-wal`, `${db}-shm`];
  for (const f of tmpDbPaths) rmSync(f, { force: true });
  orm = createDb(db);
  resetDb(orm);
}

// runLoop is scheduled fire-and-forget (scheduleRun via createRun / confirm
// endpoints). Under `--parallel`（implied --isolate）each test file owns its
// module registry and temp DB; if such a detached loop is still settling when
// teardown closes the connection, its tail DB writes (finalizeCancel / the
// finally llmActivity reset) hit "database is locked". Cancels every active
// loop and waits for the set to drain before the connection is closed.
const RESEARCH_LOOP_DRAIN_TIMEOUT_MS = 3000;

async function drainResearchLoops(): Promise<void> {
  const deadline = Date.now() + RESEARCH_LOOP_DRAIN_TIMEOUT_MS;
  // Loop passes: scheduleRun() can enqueue a loop in a microtask between
  // passes; ensureRunAbortController(runId).abort() also pre-empts loops that
  // were scheduled but have not started (their first bailIfAborted fires).
  while (Date.now() < deadline) {
    for (const runId of activeLoops) {
      try {
        ensureRunAbortController(runId).abort();
      } catch {
        // loop torn down concurrently — ignore
      }
    }
    if (activeLoops.size === 0) return;
    await Bun.sleep(25);
  }
  if (activeLoops.size > 0) {
    console.warn(
      `[test] teardown: ${activeLoops.size} research runLoop(s) did not settle within ` +
        `${RESEARCH_LOOP_DRAIN_TIMEOUT_MS}ms; closing the temp DB anyway`,
    );
  }
}

/** Drop the temp DB files. Async: first cancels & awaits any detached runLoop. */
export async function teardownIntegrationEnv(): Promise<void> {
  // 先让后台研究循环沉降, 再关连接: --parallel 逐文件隔离下, 残留 loop 的
  // 尾部 updateRun 会打到已关闭的临时 DB → SQLiteError: database is locked.
  await drainResearchLoops();
  // 显式关闭底层 bun:sqlite 连接: bun:test 同进程会创建几十个临时 DB,
  // 仅 resetDb(null) 指望 GC 释放会让文件描述符/锁耗尽, 后续文件的 createDb
  // 报 'disk I/O error'。必须先 close 再删文件。
  try {
    orm?.$client?.close();
  } catch {
    // already closed / never opened — ignore
  }
  resetDb(null);
  for (const f of tmpDbPaths ?? []) rmSync(f, { force: true });
  tmpDbPaths = null;
}

/** The temp ORM instance (for direct inspection / seeding in tests). */
export function getOrm(): Orm {
  return orm;
}

// ---------------------------------------------------------------------------
// AI mock — stub the 'ai' module so handlers run without a live LLM.
//
// `mock.module` replaces the whole module. Tests must call this (or
// `installAiMock`) at module top-level BEFORE importing the module under test.
// ---------------------------------------------------------------------------

/** A single part yielded by a mocked streamText stream. */
export type MockStreamPart =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-result'; toolName: string; output: unknown }
  | { type: 'error'; error: string };

export interface AiMockOptions {
  /** Returns a structured object for a generateText+Output.object call (keyed by prompt). */
  object?: (prompt: string) => unknown;
  /** Plain text for generateText / default streamText text-delta. */
  text?: string;
  /**
   * Custom stream parts for streamText's stream. When omitted, a single
   * text-delta carrying `text` is yielded. Use this to emit tool-result +
   * text-delta sequences (e.g. QA citation flow).
   */
  streamParts?: () => AsyncIterable<MockStreamPart> | MockStreamPart[];
}

/**
 * Install an AI SDK mock. Prefer this over the older `mockAi` — it accepts
 * `streamParts` for tests that need tool-result events in the stream.
 */
export function installAiMock(opts: AiMockOptions): void {
  const text = opts.text ?? 'mocked answer';
  const makePartsStream = () =>
    (async function* () {
      if (opts.streamParts) {
        for await (const p of opts.streamParts()) yield p;
      } else {
        yield { type: 'text-delta', text } as MockStreamPart;
      }
    })();

  mock.module('ai', () => ({
    Output: {
      object: <T>(spec: T) => spec,
    },
    generateObject: async ({ prompt }: { prompt?: string }) => {
      const p = prompt ?? '';
      const custom = opts.object?.(p);
      const isReport =
        custom &&
        typeof custom === 'object' &&
        custom !== null &&
        'title' in (custom as object) &&
        'sections' in (custom as object);
      const isBranches =
        custom && typeof custom === 'object' && custom !== null && 'branches' in (custom as object);

      // Synthesize prompt → ResearchReport (ignore decompose custom branches)
      if (/结案|ResearchReport|研究报告|综合成稿|深度研究结案/u.test(p)) {
        if (isReport) return { object: custom };
        return {
          object: {
            title: `研究报告：mock`,
            sections: [
              {
                id: 'overview',
                heading: '概述',
                blocks: [{ type: 'paragraph', text, citeIds: [] }],
              },
            ],
            citations: {},
          },
        };
      }
      if (isBranches) return { object: custom };
      if (isReport) return { object: custom };
      if (/拆解|规划器|branches|研究支路/u.test(p)) {
        return { object: custom ?? { branches: [] } };
      }
      return { object: custom ?? {} };
    },
    generateText: async ({ prompt, output }: { prompt?: string; output?: unknown }) => {
      if (output) {
        return { output: opts.object?.(prompt ?? '') ?? {}, text };
      }
      return { text };
    },
    streamText: () => ({
      stream: makePartsStream(),
      // Keep fullStream alias for any leftover callers during migration.
      fullStream: makePartsStream(),
      // streamText consumers in this codebase also read .textStream (QA SSE
      // relay); provide it so they don't crash.
      textStream: (async function* () {
        yield text;
      })(),
    }),
    tool: (def: unknown) => def,
    ToolLoopAgent: class {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async generate(_args?: { prompt?: string }) {
        return { text };
      }
      async stream(args?: {
        prompt?: string;
        options?: {
          mode?: string;
          allowWeb?: boolean;
          useNotebookSources?: boolean;
        };
      }) {
        const prompt = typeof args?.prompt === 'string' ? args.prompt : '';
        const parts: Array<Record<string, unknown>> = [];
        // Work-unit path: emit tool-results so kernel can collect evidence
        if (args?.options?.mode === 'work_unit') {
          if (args.options.useNotebookSources) {
            parts.push({
              type: 'tool-result',
              toolName: 'retrieveSources',
              output: [
                {
                  chunkId: 1,
                  chunkIndex: 0,
                  sourceId: 1,
                  sourceName: 'seed.md',
                  text: 'Mock notebook chunk about the topic.',
                  score: 0.9,
                },
              ],
            });
          }
          if (args.options.allowWeb) {
            parts.push({
              type: 'tool-result',
              toolName: 'webSearch',
              output: [
                {
                  title: 'Mock Web Result',
                  url: 'https://example.com/mock',
                  snippet: 'Mock snippet about the topic.',
                  source: 'mock',
                },
              ],
            });
          }
          parts.push({ type: 'text-delta', text: `agent-work:${text}` });
        } else {
          parts.push({ type: 'text-delta', text: `agent:${text}` });
        }
        // Structure approval path for node_chat prune intents (ToolLoopAgent)
        if (args?.options?.mode === 'node_chat' && /prune|剪枝/iu.test(prompt)) {
          parts.push({
            type: 'tool-approval-request',
            approvalId: 'mock-approval-1',
            toolCall: {
              type: 'tool-call',
              toolCallId: 'mock-tc-prune',
              toolName: 'propose_prune',
              input: { rationale: 'mock prune proposal' },
            },
          });
        }
        const make = async function* () {
          for (const p of parts) yield p;
        };
        return {
          stream: make(),
          fullStream: make(),
          textStream: (async function* () {
            yield parts.find((p) => p.type === 'text-delta')?.text ?? text;
          })(),
        };
      }
    },
    isStepCount: () => ({ stopWhen: 'stepCount' }),
  }));
}

/**
 * Backwards-compatible thin wrapper over `installAiMock` (the original shape
 * used by outputs-core-types.test.ts). Prefer `installAiMock` for new tests.
 */
export function mockAi(opts: { object?: (prompt: string) => unknown; text?: string }): void {
  installAiMock(opts);
}

// ---------------------------------------------------------------------------
// Config seeding — make getDefaultChatModel() return a non-empty model so
// handlers that call resolveModel(config) don't throw 'No chat model
// configured'. resolveModel dynamically imports @ai-sdk/openai (installed) and
// constructs an inert client; since 'ai' is mocked, no network call happens.
// ---------------------------------------------------------------------------

export function seedChatModel(): void {
  resetConfig({
    models: {
      defaults: { chat: 'test-chat' },
      available: [
        {
          id: 'test-chat',
          provider: 'openai',
          model: 'gpt-4o-test',
          displayName: 'Test Chat',
          roles: ['chat'],
          capabilities: [],
          providerConfig: { apiKey: 'test-key' },
        },
      ],
    },
    raw: {},
  });
}

// ---------------------------------------------------------------------------
// Embedding stub — prevent real embedding network calls during source ingest.
// ---------------------------------------------------------------------------

/**
 * Stub EmbedStrategy.indexSource to a noop so source ingest tests don't hit
 * the embedding API. Uses prototype reassignment (not bun:test mock), so it
 * is safe to call before or after installAiMock.
 */
export async function stubEmbedding(): Promise<void> {
  const { EmbedStrategy } = await import('../../src/rag/embed-strategy.ts');
  EmbedStrategy.prototype.indexSource = async () => {};
  // Query-time KNN must never touch the network either: bun 1.4's mock.module
  // does not cover modules first loaded via dynamic import (ragRegistry), so
  // the real SDK could otherwise leak into RAG search and hang tests.
  EmbedStrategy.prototype.retrieve = async () => [];
}

// Re-export beforeAll/afterAll so test files can import everything from here.
export { beforeAll, afterAll };
