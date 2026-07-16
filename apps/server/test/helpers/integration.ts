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
import { resetConfig } from '../../src/shared/config.ts';

const TMP_DIR = join(import.meta.dirname, '..', '..', 'data');
const TMP_DB = join(TMP_DIR, `test-integration-${process.pid}.db`);

let orm: Orm;

/** Point the db() singleton at a fresh temp DB (runs migrations + vec setup). */
export function setupIntegrationEnv(): void {
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) rmSync(f, { force: true });
  orm = createDb(TMP_DB);
  resetDb(orm);
}

/** Drop the temp DB files. */
export function teardownIntegrationEnv(): void {
  resetDb(null);
  for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) rmSync(f, { force: true });
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

/** A single part yielded by a mocked streamText fullStream. */
export type MockStreamPart =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-result'; toolName: string; output: unknown }
  | { type: 'error'; error: string };

export interface AiMockOptions {
  /** Returns a structured object for a generateObject call (keyed by prompt). */
  object?: (prompt: string) => unknown;
  /** Plain text for generateText / default streamText text-delta. */
  text?: string;
  /**
   * Custom stream parts for streamText's fullStream. When omitted, a single
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
  mock.module('ai', () => ({
    generateObject: async ({ prompt }: { prompt?: string }) => ({
      object: opts.object?.(prompt ?? '') ?? {},
    }),
    generateText: async () => ({ text }),
    streamText: () => ({
      fullStream: (async function* () {
        if (opts.streamParts) {
          for await (const p of opts.streamParts()) yield p;
        } else {
          yield { type: 'text-delta', text } as MockStreamPart;
        }
      })(),
      // streamText consumers in this codebase also read .textStream (QA SSE
      // relay); provide it so they don't crash.
      textStream: (async function* () {
        yield text;
      })(),
    }),
    tool: (def: unknown) => def,
    ToolLoopAgent: class {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async generate() {
        return { text };
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
}

// Re-export beforeAll/afterAll so test files can import everything from here.
export { beforeAll, afterAll };
