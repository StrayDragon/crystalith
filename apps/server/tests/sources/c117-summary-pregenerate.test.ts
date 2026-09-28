// c117 — r284: ingest async-pregenerates the summary after ready.
//
// The LLM call is parked on a test-controlled deferred so we can prove:
// 1. the ingest success response is NOT blocked by summary pregeneration;
// 2. the pregeneration eventually writes metadata.autoSummary;
// 3. a pregeneration failure never flips the source to failed.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

type Deferred = { resolve: (text: string) => void; reject: (error: Error) => void };

// FIFO of parked LLM calls; tests settle them explicitly.
const parkedCalls: Deferred[] = [];
let parkNext = false;

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async ({ prompt }: { prompt?: string }) => {
    if (parkNext && prompt?.includes('请为以下文档')) {
      return new Promise<{ text: string }>((resolve, reject) => {
        parkedCalls.push({
          resolve: (text) => resolve({ text }),
          reject,
        });
      });
    }
    return { text: 'mocked' };
  },
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
  ToolLoopAgent: class {
    async generate() {
      return { text: 'mocked' };
    }
  },
  isStepCount: () => ({ stopWhen: 'stepCount' }),
}));

mock.module('../../src/rag/embedder.ts', () => ({
  getEmbedModel: async () => null,
  embedSingle: async () => new Float32Array(1024),
  embedBatch: async (texts: string[]) => texts.map(() => new Float32Array(1024)),
}));

import { eq } from 'drizzle-orm';

import { db } from '../../src/db/index.ts';
import { notebooks, sources } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import {
  getOrm,
  seedChatModel,
  setupIntegrationEnv,
  stubEmbedding,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;

beforeAll(async () => {
  setupIntegrationEnv();
  await stubEmbedding();
  seedChatModel();
  app = createApp();
  getOrm().insert(notebooks).values({ name: 'c117-pregen-nb' }).returning().get();
});

afterAll(teardownIntegrationEnv);

async function uploadFile(notebookId: number, filename: string, content: string) {
  const fd = new FormData();
  fd.append('file', new File([content], filename, { type: 'text/plain' }));
  const res = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/sources/upload`, {
      method: 'POST',
      body: fd,
    }),
  );
  return { status: res.status, body: (await res.json()) as { sourceId: number; status: string } };
}

async function readSource(sourceId: number) {
  return db().select().from(sources).where(eq(sources.id, sourceId)).get();
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000, stepMs = 25): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await Bun.sleep(stepMs);
  }
  throw new Error('condition not met within timeout');
}

describe('c117 r284: async summary pregenerate after ready', () => {
  it('does not block the ingest response and eventually writes metadata.autoSummary', async () => {
    const nb = getOrm()
      .select()
      .from(notebooks)
      .all()
      .find((n) => n.name === 'c117-pregen-nb')!;
    parkNext = true;
    const { status, body } = await uploadFile(
      nb.id,
      'pregen.txt',
      'pregenerate summary content. '.repeat(20),
    );

    // Ingest success response arrived while the LLM call is still parked.
    expect(status).toBe(200);
    expect(body.status).toBe('ready');
    await Bun.sleep(60);
    let row = await readSource(body.sourceId);
    expect(row?.status).toBe('ready');
    expect((row?.metadata as { autoSummary?: unknown } | null)?.autoSummary).toBeUndefined();

    // Settle the parked pregeneration → autoSummary gets written.
    expect(parkedCalls.length).toBeGreaterThan(0);
    parkedCalls
      .shift()!
      .resolve(
        '摘要：预生成摘要正文\n要点：\n- 要点一\n- 要点二\n- 要点三\n- 要点四\n主题：主题一、主题二、主题三',
      );
    await waitFor(async () => {
      row = await readSource(body.sourceId);
      return (row?.metadata as { autoSummary?: unknown } | null)?.autoSummary != null;
    });
    row = await readSource(body.sourceId);
    const meta = row?.metadata as { autoSummary: { summary: string } } | undefined;
    expect(meta?.autoSummary.summary).toBe('预生成摘要正文');
    expect(row?.status).toBe('ready');
    parkedCalls.length = 0;
    parkNext = false;
  });

  it('never flips the source to failed when the pregeneration fails', async () => {
    const nb = getOrm()
      .select()
      .from(notebooks)
      .all()
      .find((n) => n.name === 'c117-pregen-nb')!;
    parkNext = true;
    const { status, body } = await uploadFile(
      nb.id,
      'pregen-fail.txt',
      'failing pregenerate content. '.repeat(20),
    );
    expect(status).toBe(200);
    expect(body.status).toBe('ready');
    await Bun.sleep(60);
    let row = await readSource(body.sourceId);
    expect(row?.status).toBe('ready'); // not blocked, not failed

    // Parked LLM call rejects → pregeneration fails…
    expect(parkedCalls.length).toBeGreaterThan(0);
    parkedCalls.shift()!.reject(new Error('summary provider exploded'));
    // …but the source stays ready (and the internal template fallback still caches).
    await waitFor(async () => {
      row = await readSource(body.sourceId);
      return (row?.metadata as { autoSummary?: unknown } | null)?.autoSummary != null;
    });
    row = await readSource(body.sourceId);
    expect(row?.status).toBe('ready');
    expect(row?.errorCode).toBeNull();
    parkedCalls.length = 0;
    parkNext = false;
  });
});
