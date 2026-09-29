// chat-prompt-presets wire tests — stats preset QA path over the in-process
// Elysia app with a mutable 'ai' mock:
//   r26  — stats fallback_markdown is persisted as plain assistant content
//   r424 — invalid stats JSON falls back to default text QA (citations /
//          evidence / confidence still returned)
//
// Self-contained per the --parallel isolation discipline: the 'ai' module mock
// below is installed BEFORE importing server modules. `replyText` is captured
// by the mock factory closure so individual tests can switch the mocked
// generateText payload.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// Mutable mocked model reply — tests reassign this before each QA call.
let replyText = 'not json at all';

mock.module('ai', () => {
  const MOCK_VECTOR = Array.from({ length: 1024 }, () => 0.01);
  const makeParts = (text: string) =>
    (async function* () {
      yield { type: 'text-delta', text };
    })();
  return {
    Output: { object: <T>(spec: T) => spec },
    generateObject: async () => ({ object: {} }),
    generateText: async () => ({ text: replyText }),
    streamText: () => ({
      stream: makeParts(replyText),
      fullStream: makeParts(replyText),
      textStream: makeParts(replyText),
    }),
    embed: async () => ({ embedding: MOCK_VECTOR }),
    embedMany: async ({ values }: { values: string[] }) => ({
      embeddings: values.map(() => MOCK_VECTOR),
    }),
    tool: (def: unknown) => def,
    ToolLoopAgent: class {
      async generate() {
        return { text: replyText };
      }
    },
    isStepCount: () => ({ stopWhen: 'stepCount' }),
  };
});

import { and, eq } from 'drizzle-orm';

import { messages, notebooks, sessions } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';

const VALID_STATS_JSON = JSON.stringify({
  fallback_markdown: 'Sales grew [1].',
  chart: {
    title: 'Revenue',
    unit: 'USD',
    items: [
      { label: 'Q1', value: 10 },
      { label: 'Q2', value: 20 },
    ],
  },
  table: {
    columns: ['Q', 'Amt'],
    rows: [
      ['Q1', 10],
      ['Q2', 20],
    ],
  },
});

let app: InstanceType<typeof createApp>;
let notebookId: number;
let sessionId: number;

beforeAll(() => {
  setupIntegrationEnv();
  resetConfig({
    models: {
      defaults: { chat: 'test-chat', embedding: 'test-embed' },
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
        {
          id: 'test-embed',
          provider: 'openai',
          model: 'bge-m3-test',
          displayName: 'Test Embed',
          roles: ['embed'],
          capabilities: [],
          providerConfig: { apiKey: 'test-key' },
        },
      ],
    },
    raw: {},
  });
  app = createApp();

  const orm = getOrm();
  notebookId = orm.insert(notebooks).values({ name: 'presets-wire' }).returning().get().id;
  sessionId = orm.insert(sessions).values({ notebookId, title: '' }).returning().get().id;
});

afterAll(() => {
  teardownIntegrationEnv();
  resetConfig();
});

async function postQa(question: string): Promise<{
  status: number;
  body: {
    answer?: unknown;
    citations?: unknown;
    confidence?: unknown;
    evidence?: unknown;
    noEvidenceReason?: unknown;
  };
}> {
  const res = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, sessionId, generationTypeId: 'qa' }),
    }),
  );
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as object) : {} };
}

function latestAssistantContent(): string | null {
  const rows = getOrm()
    .select({ content: messages.content, role: messages.role })
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.role, 'assistant')))
    .orderBy(messages.createdAt)
    .all();
  return rows.at(-1)?.content ?? null;
}

describe('r26 stats preset persists fallback_markdown as plain assistant content', () => {
  it('valid stats JSON is answered and persisted as fallback_markdown without envelope', async () => {
    // covers: r26
    replyText = VALID_STATS_JSON;
    const { status, body } = await postQa('/prompt:stats 销售数据');
    expect(status).toBe(200);
    // fallback_markdown becomes the answer — a plain string, no UI envelope.
    expect(body.answer).toBe('Sales grew [1].');
    expect(typeof body.answer).toBe('string');

    // The same plain text is what ends up persisted on the assistant message.
    expect(latestAssistantContent()).toBe('Sales grew [1].');
  });
});

describe('r424 invalid stats JSON falls back to default text QA', () => {
  it('unparseable model output is returned as-is with citations/evidence/confidence', async () => {
    // covers: r424
    replyText = '这段输出不是 JSON，也没有结构化图表';
    const { status, body } = await postQa('/prompt:stats 又一次提问');
    expect(status).toBe(200);
    // Conversation stays usable: the raw text generation is the answer.
    expect(body.answer).toBe('这段输出不是 JSON，也没有结构化图表');
    // Contract fields still present on the fallback response.
    expect(Array.isArray(body.citations)).toBe(true);
    expect(typeof body.evidence).toBe('boolean');
    expect(typeof body.confidence).toBe('number');
  });
});
