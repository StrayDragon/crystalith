// Integration test helpers — fresh temp DB + AI SDK mock setup.
//
// Usage in a test file:
//   import { setupIntegrationEnv, teardownIntegrationEnv, getOrm } from '../helpers/integration.ts';
//   beforeAll(setupIntegrationEnv);
//   afterAll(teardownIntegrationEnv);
import { afterAll, beforeAll } from 'bun:test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { createDb, resetDb, type Orm } from '../../src/db/index.ts';

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

/**
 * Install an AI SDK mock that returns deterministic objects for generateObject
 * and deterministic text for generateText/streamText. Must be called at module
 * top-level BEFORE importing the module under test (bun:test mock.module).
 *
 * `objectOverrides` lets a test supply schema-specific return values keyed by
 * a tag the test controls via the prompt content.
 */
export function mockAi(opts: { object?: (prompt: string) => unknown; text?: string }): void {
  const { mock } = require('bun:test');
  mock.module('ai', () => ({
    generateObject: async ({ prompt }: { prompt?: string }) => ({
      object: opts.object?.(prompt ?? '') ?? {},
    }),
    generateText: async () => ({ text: opts.text ?? 'mocked answer' }),
    streamText: () => ({
      fullStream: (async function* () {
        yield { type: 'text-delta', text: opts.text ?? 'mocked' };
      })(),
    }),
    tool: (def: unknown) => def,
    ToolLoopAgent: class {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async generate() {
        return { text: opts.text ?? 'mocked' };
      }
    },
    isStepCount: () => ({ stopWhen: 'stepCount' }),
  }));
}

// Re-export beforeAll/afterAll so test files can import everything from here.
export { beforeAll, afterAll };
