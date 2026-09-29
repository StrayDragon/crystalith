// c122 — QA preset whitelist resolution across built-in + custom presets.
//   r23  — unknown presets are rejected with the stable combined list
//   r24  — custom preset systemPrompt overrides the QA system prompt
//   r25  — disabled custom presets are rejected deterministically
//   r422 — bare `/prompt:<name>` (no query) is a deterministic input error
//
// Self-contained per the --parallel isolation discipline: the 'ai' module mock
// is installed BEFORE importing server modules; `lastInstructions` captures the
// system prompt so custom-preset override and directive rendering are asserted
// end-to-end through the real QA route.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

let lastInstructions = '';

mock.module('ai', () => {
  const MOCK_VECTOR = Array.from({ length: 1024 }, () => 0.01);
  const makeParts = (text: string) =>
    (async function* () {
      yield { type: 'text-delta', text };
    })();
  return {
    Output: { object: <T>(spec: T) => spec },
    generateObject: async () => ({ object: {} }),
    generateText: async ({ instructions }: { instructions?: string }) => {
      lastInstructions = instructions ?? '';
      return { text: 'mocked answer [1]' };
    },
    streamText: () => {
      const parts = (async function* () {
        yield { type: 'text-delta', text: 'mocked answer [1]' };
      })();
      return { stream: parts, fullStream: parts, textStream: parts };
    },
    embed: async () => ({ embedding: MOCK_VECTOR }),
    embedMany: async ({ values }: { values: string[] }) => ({
      embeddings: values.map(() => MOCK_VECTOR),
    }),
    tool: (def: unknown) => def,
    ToolLoopAgent: class {
      async generate() {
        return { text: 'mocked answer [1]' };
      }
    },
    isStepCount: () => ({ stopWhen: 'stepCount' }),
  };
});

import { notebooks } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';

let app: InstanceType<typeof createApp>;
let notebookId: number;

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
  notebookId = getOrm().insert(notebooks).values({ name: 'preset-res' }).returning().get().id;
});

afterAll(() => {
  teardownIntegrationEnv();
});

async function post(
  path: string,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await app.handle(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function postQa(question: string, extra: Record<string, unknown> = {}) {
  return post(`/v2/notebooks/${notebookId}/qa`, { question, generationTypeId: 'qa', ...extra });
}

describe('r24 custom preset overrides the QA system prompt', () => {
  it('creates a custom preset and consumes it through /prompt:<trigger>', async () => {
    // covers: r24
    const created = await post('/v2/prompt-presets', {
      trigger: 'pirate',
      systemPrompt: 'You are a pirate. Answer every question in pirate speak. {{directive}}',
      description: 'pirate mode',
    });
    expect(created.status).toBe(201);
    expect((created.body as { generationTypeId: string }).generationTypeId).toBe('qa');

    const { status, body } = await postQa('/prompt:pirate what is cargo');
    expect(status).toBe(200);
    expect(lastInstructions).toContain('pirate speak');
    // {{directive}} placeholder is rendered like built-in presets (default directive: Mixed).
    expect(lastInstructions).toContain('Use both retrieved sources');
    // r189: the resolved preset id is echoed.
    expect((body as { generation: { presetId: string } }).generation.presetId).toBe('pirate');
  });
});

describe('r23 unknown presets are rejected with the stable combined list', () => {
  it('slash directive with an unknown name returns 400 + built-in and custom names', async () => {
    // covers: r23
    const { status, body } = await postQa('/prompt:nonexistent-preset some question');
    expect(status).toBe(400);
    expect((body as { errorCode: string }).errorCode).toBe('INVALID_REQUEST');
    const available = (body as { details: { availablePresets: string[] } }).details
      .availablePresets;
    expect(available).toContain('stats');
    expect(available).toContain('pirate');
    expect(available).not.toContain('nonexistent-preset');
  });

  it('unknown body preset (no directive) hits the same whitelist', async () => {
    // covers: r23
    const { status } = await postQa('plain question', { preset: 'ghost-preset' });
    expect(status).toBe(400);
  });
});

describe('r25 disabled presets are rejected deterministically', () => {
  it('creates a disabled preset and rejects its directive with a stable error', async () => {
    // covers: r25
    const created = await post('/v2/prompt-presets', {
      trigger: 'sleepy',
      systemPrompt: 'Sleepy preset should never be used.',
      enabled: false,
    });
    expect(created.status).toBe(201);

    const { status, body } = await postQa('/prompt:sleepy any question');
    expect(status).toBe(400);
    expect((body as { errorCode: string }).errorCode).toBe('INVALID_REQUEST');
    expect((body as { details: { presetId: string } }).details.presetId).toBe('sleepy');
  });
});

describe('r422 bare /prompt:<name> without query is a deterministic input error', () => {
  it('returns 400 with usage and the available preset list', async () => {
    // covers: r422
    const { status, body } = await postQa('/prompt:stats');
    expect(status).toBe(400);
    expect((body as { errorCode: string }).errorCode).toBe('INVALID_REQUEST');
    const details = (body as { details: { usage: string; availablePresets: string[] } }).details;
    expect(details.usage).toBe('/prompt:<preset> <query>');
    expect(details.availablePresets).toContain('stats');
    expect(details.presetId).toBe('stats');
  });

  it('a directive with query text is accepted (control case)', async () => {
    // covers: r422
    const { status } = await postQa('/prompt:stats 销售数据');
    expect(status).toBe(200);
  });
});
