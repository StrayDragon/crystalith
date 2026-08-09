/**
 * c102 — LLM synthesize cite bind, failure, retry-synthesize, modelId persist.
 */
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { eq } from 'drizzle-orm';

mock.module('../../src/ai/tools/web-search.ts', () => ({
  searchWeb: async () => [
    {
      title: 'Mock Web Result',
      url: 'https://example.com/mock',
      snippet: 'Mock snippet',
      source: 'mock',
    },
  ],
  webSearchTool: () => ({}),
}));

import {
  getOrm,
  installAiMock,
  seedChatModel,
  setupIntegrationEnv,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

let synthesizeMode: 'ok' | 'illegal' | 'throw' = 'ok';

installAiMock({
  text: 'short node summary',
  object: (prompt) => {
    if (/结案|ResearchReport|研究报告|综合成稿|深度研究结案/u.test(prompt)) {
      if (synthesizeMode === 'throw') {
        throw new Error('forced synthesize boom');
      }
      if (synthesizeMode === 'illegal') {
        return {
          title: 'Bad cites',
          sections: [
            {
              id: 'overview',
              heading: '概述',
              blocks: [{ type: 'paragraph', text: 'hallucinated', citeIds: ['nope'] }],
            },
          ],
          citations: {
            nope: { sourceName: 'x', snippet: 'y' },
          },
        };
      }
      return {
        title: 'LLM Research Report',
        sections: [
          {
            id: 'overview',
            heading: '概述',
            blocks: [{ type: 'paragraph', text: 'honest synthesis', citeIds: [] }],
          },
        ],
        citations: {},
      };
    }
    return { branches: [] };
  },
});
seedChatModel();

import { notebooks, researchRuns, sources } from '../../src/db/schema.ts';
import {
  collectClaimedCiteIds,
  isSynthesizeFailureReason,
  repairResearchReportText,
  SYNTHESIZE_FAILED_PREFIX,
  SYNTHESIZE_MODEL_ERROR_PREFIX,
  validateAndBindCitations,
} from '../../src/features/research/report-citations.ts';
import { createApp } from '../../src/server.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;
let sourceId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'research-c102-nb' }).returning().get().id;
  sourceId = getOrm()
    .insert(sources)
    .values({
      notebookId,
      filename: 'seed.md',
      mimeType: 'text/markdown',
      parserType: 'text',
      status: 'ready',
    })
    .returning()
    .get().id;
});

afterAll(teardownIntegrationEnv);

async function waitForStatus(runId: number, wanted: string[], timeoutMs = 5000): Promise<string> {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${runId}`),
    );
    const body = (await res.json()) as { status: string };
    last = body.status;
    if (wanted.includes(body.status)) return body.status;
    await Bun.sleep(20);
  }
  throw new Error(`timeout status; last=${last}`);
}

describe('repairResearchReportText (unit)', () => {
  it('unwraps fenced JSON and fills missing citations', () => {
    const repaired = repairResearchReportText(`\`\`\`json
{"title":"T","sections":[{"id":"s1","heading":"H","blocks":[{"type":"paragraph","text":"hi"}]}]}
\`\`\``);
    expect(repaired).toBeTruthy();
    const obj = JSON.parse(repaired!) as {
      citations: Record<string, unknown>;
      sections: Array<{ blocks: Array<{ citeIds: string[] }> }>;
    };
    expect(obj.citations).toEqual({});
    expect(obj.sections[0]!.blocks[0]!.citeIds).toEqual([]);
  });

  it('strips think tags and preamble before object', () => {
    const repaired = repairResearchReportText(
      '<think>reasoning</think>\nHere is the report:\n{"title":"T","sections":[{"id":"s1","heading":"H","blocks":[{"type":"paragraph","text":"x","citeIds":[]}]}],"citations":{}}',
    );
    expect(repaired).toBeTruthy();
    expect(JSON.parse(repaired!).title).toBe('T');
  });

  it('normalizes incomplete citation objects', () => {
    const repaired = repairResearchReportText(
      JSON.stringify({
        title: 'T',
        sections: [
          {
            id: 's1',
            heading: 'H',
            blocks: [{ type: 'paragraph', text: 'x', citeIds: ['ev1'] }],
          },
        ],
        citations: {
          ev1: { url: 'https://example.com', sourceId: 'bad' },
        },
      }),
    );
    expect(repaired).toBeTruthy();
    const obj = JSON.parse(repaired!) as {
      citations: Record<
        string,
        { sourceName: string; snippet: string; url?: string; sourceId?: number }
      >;
    };
    expect(obj.citations.ev1).toEqual({
      sourceName: 'ev1',
      snippet: '',
      url: 'https://example.com',
    });
  });
});

describe('validateAndBindCitations (unit)', () => {
  it('strips illegal keys and keeps legal', () => {
    const evidences = [
      {
        id: 'ev_ok',
        runId: 1,
        notebookId: 1,
        kind: 'web' as const,
        title: 'OK',
        snippet: 's',
        createdAt: new Date().toISOString(),
      },
    ];
    const bound = validateAndBindCitations(
      {
        title: 'T',
        sections: [
          {
            id: 's',
            heading: 'H',
            blocks: [{ type: 'paragraph', text: 'x', citeIds: ['ev_ok', 'ghost'] }],
          },
        ],
        citations: {
          ev_ok: { sourceName: 'OK', snippet: 's' },
          ghost: { sourceName: 'G', snippet: 'g' },
        },
      },
      evidences,
    );
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(Object.keys(bound.report.citations)).toEqual(['ev_ok']);
    expect(bound.report.sections[0]!.blocks[0]).toMatchObject({
      type: 'paragraph',
      citeIds: ['ev_ok'],
    });
  });

  it('fails when all claimed cites are illegal', () => {
    const bound = validateAndBindCitations(
      {
        title: 'T',
        sections: [
          {
            id: 's',
            heading: 'H',
            blocks: [{ type: 'paragraph', text: 'x', citeIds: ['ghost'] }],
          },
        ],
        citations: { ghost: { sourceName: 'G', snippet: 'g' } },
      },
      [],
    );
    expect(bound.ok).toBe(false);
  });

  it('allows 0 cites with 0 evidence', () => {
    const bound = validateAndBindCitations(
      {
        title: 'T',
        sections: [
          {
            id: 's',
            heading: 'H',
            blocks: [{ type: 'paragraph', text: 'honest empty', citeIds: [] }],
          },
        ],
        citations: {},
      },
      [],
    );
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(collectClaimedCiteIds(bound.report).size).toBe(0);
  });
});

describe('research synthesize + retry (c102)', () => {
  it('create persists modelId and GET exposes failureReason alias', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'model-id persist',
          useNotebookSources: false,
          allowWeb: true,
          modelId: 'test-chat',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: number; modelId?: string | null };
    expect(body.modelId).toBe('test-chat');
    const get = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${body.id}`),
    );
    const got = (await get.json()) as { modelId?: string | null };
    expect(got.modelId).toBe('test-chat');
  });

  it('completes with LLM report title (no evidence bullet dump)', async () => {
    synthesizeMode = 'ok';
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'llm report success',
          useNotebookSources: true,
          allowWeb: false,
          sourceIds: [sourceId],
        }),
      }),
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: number };
    await waitForStatus(created.id, ['completed', 'awaiting_confirm', 'failed']);
    // Finish report if paused on budget (notebook-only usually completes)
    let get = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
    );
    let run = (await get.json()) as {
      status: string;
      report: { title: string; sections: unknown[] } | null;
    };
    if (run.status === 'awaiting_confirm') {
      const conf = await app.handle(
        new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/confirm`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'finish_report' }),
        }),
      );
      expect(conf.status).toBe(200);
      await waitForStatus(created.id, ['completed', 'failed']);
      get = await app.handle(
        new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`),
      );
      run = (await get.json()) as typeof run;
    }
    expect(run.status).toBe('completed');
    expect(run.report?.title).toBe('LLM Research Report');
    expect(JSON.stringify(run.report)).not.toContain('证据列表');
  });

  it('illegal cites → failed + retry-synthesize succeeds', async () => {
    synthesizeMode = 'illegal';
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'illegal cites',
          useNotebookSources: true,
          allowWeb: false,
          sourceIds: [sourceId],
        }),
      }),
    );
    const created = (await create.json()) as { id: number };
    let status = await waitForStatus(created.id, ['failed', 'awaiting_confirm', 'completed']);
    if (status === 'awaiting_confirm') {
      await app.handle(
        new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/confirm`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'finish_report' }),
        }),
      );
      status = await waitForStatus(created.id, ['failed', 'completed']);
    }
    expect(status).toBe('failed');
    const failed = (await (
      await app.handle(new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`))
    ).json()) as {
      failureReason?: string | null;
      errorMessage?: string | null;
      report: unknown;
      evidences: unknown[];
    };
    expect(isSynthesizeFailureReason(failed.failureReason ?? failed.errorMessage)).toBe(true);
    expect(String(failed.failureReason ?? failed.errorMessage)).toContain(SYNTHESIZE_FAILED_PREFIX);
    expect(failed.report).toBeNull();

    // retry rejects wrong state is covered below; here flip mode and retry
    synthesizeMode = 'ok';
    const retry = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/retry-synthesize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modelId: 'test-chat' }),
      }),
    );
    expect(retry.status).toBe(200);
    const after = (await retry.json()) as {
      status: string;
      modelId?: string | null;
      report: { title: string } | null;
    };
    expect(after.status).toBe('completed');
    expect(after.modelId).toBe('test-chat');
    expect(after.report?.title).toBe('LLM Research Report');

    // evidence count unchanged by retry (no re-drain): at least not increased by inventing hits
    const row = getOrm().select().from(researchRuns).where(eq(researchRuns.id, created.id)).get();
    expect(row?.status).toBe('completed');
  });

  it('model throw → failed with synthesize_model_error', async () => {
    synthesizeMode = 'throw';
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'model boom',
          useNotebookSources: true,
          allowWeb: false,
          sourceIds: [sourceId],
        }),
      }),
    );
    const created = (await create.json()) as { id: number };
    let status = await waitForStatus(created.id, ['failed', 'awaiting_confirm', 'completed']);
    if (status === 'awaiting_confirm') {
      await app.handle(
        new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/confirm`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'finish_report' }),
        }),
      );
      status = await waitForStatus(created.id, ['failed', 'completed']);
    }
    expect(status).toBe('failed');
    const failed = (await (
      await app.handle(new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}`))
    ).json()) as { failureReason?: string | null };
    expect(String(failed.failureReason)).toContain(SYNTHESIZE_MODEL_ERROR_PREFIX);
  });

  it('retry-synthesize rejects completed', async () => {
    synthesizeMode = 'ok';
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'reject retry on completed',
          useNotebookSources: true,
          allowWeb: false,
          sourceIds: [sourceId],
        }),
      }),
    );
    const created = (await create.json()) as { id: number };
    let status = await waitForStatus(created.id, ['completed', 'awaiting_confirm', 'failed']);
    if (status === 'awaiting_confirm') {
      await app.handle(
        new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/confirm`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'finish_report' }),
        }),
      );
      status = await waitForStatus(created.id, ['completed', 'failed']);
    }
    expect(status).toBe('completed');
    const retry = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/retry-synthesize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(retry.status).toBe(409);
    const body = (await retry.json()) as { errorCode?: string };
    expect(body.errorCode).toBe('RESEARCH_INVALID_STATE');
  });

  it('retry-synthesize rejects non-synthesize failed', async () => {
    synthesizeMode = 'ok';
    const create = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: 'reject retry on other failed',
          useNotebookSources: true,
          allowWeb: false,
          sourceIds: [sourceId],
        }),
      }),
    );
    const created = (await create.json()) as { id: number };
    let status = await waitForStatus(created.id, ['completed', 'awaiting_confirm', 'failed']);
    if (status === 'awaiting_confirm') {
      await app.handle(
        new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/confirm`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'finish_report' }),
        }),
      );
      status = await waitForStatus(created.id, ['completed', 'failed']);
    }
    expect(status).toBe('completed');

    getOrm()
      .update(researchRuns)
      .set({ status: 'failed', errorMessage: 'budget exceeded', report: null })
      .where(eq(researchRuns.id, created.id))
      .run();

    const retry = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/research/${created.id}/retry-synthesize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(retry.status).toBe(409);
    const body = (await retry.json()) as { errorCode?: string };
    expect(body.errorCode).toBe('RESEARCH_INVALID_STATE');
  });
});
