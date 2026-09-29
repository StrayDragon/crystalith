// c122 typed-generation-framework — generation type registry endpoint + request
// assembly validation + generation metadata echo.
//
// Self-contained per the --parallel isolation discipline: the 'ai' module mock
// is installed BEFORE importing server modules; the captured instructions
// closure lets tests assert control-injection into the system prompt.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// Captured by the mock factory closure — last generateText instructions.
let lastInstructions = '';

mock.module('ai', () => {
  const MOCK_VECTOR = Array.from({ length: 1024 }, () => 0.01);
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
  notebookId = getOrm().insert(notebooks).values({ name: 'gentype' }).returning().get().id;
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

async function get(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await app.handle(new Request(`${BASE}${path}`));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('r466/r323 generation type registry endpoint', () => {
  it('GET /v2/generation-types returns the full contract for each type', async () => {
    // covers: r466, r323
    const { status, body } = await get('/v2/generation-types');
    expect(status).toBe(200);
    const types = (body as { types: Array<Record<string, unknown>> }).types;
    expect(types.map((t) => t.id)).toEqual(['qa', 'output', 'slides']);
    for (const t of types) {
      // r323 minimal contract: every type declares the full descriptor set.
      expect(typeof t.displayName).toBe('string');
      expect(typeof t.inputRequirement).toBe('string');
      expect(Array.isArray(t.allowedOutputTypes)).toBe(true);
      expect(typeof t.defaultOutputType).toBe('string');
      expect(typeof t.completionSemantics).toBe('string');
      expect(Array.isArray(t.allowedControls)).toBe(true);
    }
    const output = types.find((t) => t.id === 'output') as Record<string, unknown>;
    expect(output.defaultOutputType).toBe('PARAGRAPH');
    expect(output.allowedOutputTypes).not.toContain('SLIDES');
  });
});

describe('r324 generationTypeId assembly validation', () => {
  it('rejects missing generationTypeId on the qa surface', async () => {
    // covers: r324
    const { status } = await post(`/v2/notebooks/${notebookId}/qa`, {
      question: 'no type',
    });
    expect(status).toBe(422);
  });

  it('rejects a mismatched generationTypeId with the expected type in details', async () => {
    // covers: r324
    const { status, body } = await post(`/v2/notebooks/${notebookId}/qa`, {
      question: 'wrong type',
      generationTypeId: 'output',
    });
    expect(status).toBe(400);
    expect((body as { errorCode: string }).errorCode).toBe('INVALID_REQUEST');
    expect((body as { details: { expected: string } }).details.expected).toBe('qa');

    const out = await post(`/v2/notebooks/${notebookId}/outputs`, {
      generationTypeId: 'qa',
      type: 'FAQ',
      sourceIds: [1],
    });
    expect(out.status).toBe(400);
    expect((out.body as { details: { expected: string } }).details.expected).toBe('output');
  });

  it('rejects an unknown generationTypeId', async () => {
    // covers: r324
    const { status } = await post(`/v2/notebooks/${notebookId}/qa`, {
      question: 'unknown type',
      generationTypeId: 'codex',
    });
    expect(status).toBe(422);
  });
});

describe('r467 default output type from the contract', () => {
  it('creates a PARAGRAPH output when type is omitted (manual content path)', async () => {
    // covers: r467
    const { status, body } = await post(`/v2/notebooks/${notebookId}/outputs`, {
      generationTypeId: 'output',
      content: { title: 'r467', text: 'default type body' },
    });
    expect(status).toBe(201);
    expect(body.type).toBe('PARAGRAPH');
  });
});

describe('r326/r189 generation metadata echo', () => {
  it('non-stream qa answers echo generationType/outputType/completion + effective controls', async () => {
    // covers: r326, r189, r186
    const { status, body } = await post(`/v2/notebooks/${notebookId}/qa`, {
      question: 'echo question',
      generationTypeId: 'qa',
      preset: 'analysis',
      controls: { lengthHint: 'concise', requireCitations: true },
    });
    expect(status).toBe(200);
    const generation = (body as { generation: Record<string, unknown> }).generation;
    expect(generation.generationTypeId).toBe('qa');
    expect(generation.outputType).toBe('MESSAGE');
    expect(generation.completion).toBe('answer');
    // r189: the effective preset id is echoed (explicit preset, not just default).
    expect(generation.presetId).toBe('analysis');
    expect(generation.effectiveControls).toEqual({ lengthHint: 'concise', requireCitations: true });
    // r186: controls are injected as prompt instructions, not just echoed.
    expect(lastInstructions).toContain('concise');
    expect(lastInstructions).toContain('[N] notation');
  });

  it('output generation persists generationMeta on the row and echoes it in reads', async () => {
    // covers: r326
    const { status, body } = await post(`/v2/notebooks/${notebookId}/outputs`, {
      generationTypeId: 'output',
      content: { title: 'meta', text: 'meta body' },
    });
    expect(status).toBe(201);
    const outputId = (body as { id: number }).id;
    const meta = (body as { generationMeta: Record<string, unknown> | null }).generationMeta;
    expect(meta?.generationTypeId).toBe('output');
    expect(meta?.outputType).toBe('PARAGRAPH');
    expect(meta?.completion).toBe('manual-note');

    const detail = await get(`/v2/notebooks/${notebookId}/outputs/${outputId}`);
    expect(detail.status).toBe(200);
    expect(
      (detail.body as { generationMeta: Record<string, unknown> | null }).generationMeta
        ?.completion,
    ).toBe('manual-note');
  });
});

describe('r205 outputs endpoint rejects SLIDES with studio hint', () => {
  it('a known-but-studio-owned type gets its dedicated 400 message', async () => {
    // covers: r205
    const { status, body } = await post(`/v2/notebooks/${notebookId}/outputs`, {
      generationTypeId: 'output',
      type: 'SLIDES',
      sourceIds: [1],
    });
    expect(status).toBe(400);
    const message = (body as { message: string }).message;
    expect(message).toContain('slides');
  });
});

describe('r166 static output-type registry rejection', () => {
  it('unsupported output types fail with the type and supported list in details', async () => {
    // covers: r166
    const { status, body } = await post(`/v2/notebooks/${notebookId}/outputs`, {
      generationTypeId: 'output',
      type: 'CODEX',
      sourceIds: [1],
    });
    expect(status).toBe(400);
    expect((body as { errorCode: string }).errorCode).toBe('INVALID_REQUEST');
    const details = (body as { details: { outputType: string; supported: string[] } }).details;
    expect(details.outputType).toBe('CODEX');
    expect(details.supported).toContain('FAQ');
    expect(details.supported).not.toContain('SLIDES');
  });
});
