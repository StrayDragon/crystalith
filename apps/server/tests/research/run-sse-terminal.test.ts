/**
 * c64 / r13: run SSE terminal wait — broadcast-primary close with slow-poll
 * fallback (replaces the former per-subscriber 100ms hot loop).
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { eq } from 'drizzle-orm';

import { notebooks, researchRuns } from '../../src/db/schema.ts';
import { emitStatus, runEmitters, updateRun } from '../../src/features/research/research-core.ts';
import { createResearchSseResponse } from '../../src/features/research/run-sse.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

let notebookId: number;
let runSeq = 0;

function seedRun(): number {
  runSeq += 1;
  return getOrm()
    .insert(researchRuns)
    .values({
      notebookId,
      topic: `c64 run-sse ${runSeq}`,
      status: 'running',
      useNotebookSources: false,
      allowWeb: false,
      maxSearches: 5,
      maxNodes: 10,
      maxPageFetches: 5,
      graph: { nodes: [], edges: [] },
    })
    .returning()
    .get().id;
}

beforeAll(() => {
  setupIntegrationEnv();
  notebookId = getOrm()
    .insert(notebooks)
    .values({ name: 'research-c64-run-sse' })
    .returning()
    .get().id;
});

afterAll(teardownIntegrationEnv);

describe('run SSE terminal wait (c64)', () => {
  it('status broadcast closes the stream promptly (no hot polling)', async () => {
    const runId = seedRun();
    const res = createResearchSseResponse(notebookId, runId);
    const textPromise = res.text();
    await Bun.sleep(30);
    updateRun(runId, { status: 'completed' });
    emitStatus(runId, 'completed');

    const start = Date.now();
    const text = await textPromise;
    const elapsed = Date.now() - start;
    expect(text).toContain('event: status');
    expect(text).toContain('"status":"running"');
    expect(elapsed).toBeLessThan(2000);
  });

  it('missed broadcast → slow-poll fallback still closes', async () => {
    const runId = seedRun();
    const res = createResearchSseResponse(notebookId, runId);
    const textPromise = res.text();
    await Bun.sleep(30);
    // Bypass emitStatus: no broadcast — only the slow DB poll can notice.
    getOrm().update(researchRuns).set({ status: 'failed' }).where(eq(researchRuns.id, runId)).run();

    const start = Date.now();
    const text = await textPromise;
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(1900);
    expect(elapsed).toBeLessThan(10000);
  }, 20000);

  it('client disconnect unsubscribes promptly', async () => {
    const runId = seedRun();
    const res = createResearchSseResponse(notebookId, runId);
    await Bun.sleep(30);
    expect(runEmitters.get(runId)?.size ?? 0).toBeGreaterThan(0);

    await res.body?.cancel();
    await Bun.sleep(30);
    expect(runEmitters.has(runId)).toBe(false);
  });
});
