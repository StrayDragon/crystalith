// API contract B-class integration tests — surface endpoints that need no AI
// runtime: health guardrail exemption (r348), models list envelope
// (r363/r367) + provider-availability filter (r364), workspace tools
// descriptors (r360/r361/r362), global-flat process registries (r372), and
// notebook-scoped lists never dumping all notebooks (r381).
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { messages, notebooks, sessions } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { resetSlidesProbeCache } from '../../src/shared/slides-availability.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';

// One model per known provider + one deliberately unknown provider — the
// models router must filter the unknown one out (r364).
const SEED_MODELS = {
  defaults: { chat: 'chat-known', embedding: 'embed-known' },
  available: [
    {
      id: 'chat-known',
      provider: 'openai',
      model: 'gpt-4o-test',
      displayName: 'Known Chat',
      description: '',
      roles: ['chat'],
      capabilities: [],
      providerConfig: { apiKey: 'test-key' },
    },
    {
      id: 'embed-known',
      provider: 'openai',
      model: 'bge-m3-test',
      displayName: 'Known Embed',
      description: '',
      roles: ['embed'],
      capabilities: [],
      providerConfig: { apiKey: 'test-key' },
    },
    {
      id: 'ghost-model',
      provider: 'no-such-provider',
      model: 'ghost-1',
      displayName: 'Ghost',
      description: '',
      roles: ['chat'],
      capabilities: [],
      providerConfig: { apiKey: 'test-key' },
    },
  ],
};

let app: InstanceType<typeof createApp>;
let notebookA: number;

beforeAll(() => {
  setupIntegrationEnv();
  // Pin the Slidev preview probe to a refused loopback port so the tools
  // response is deterministic (SLIDES disabled, descriptors still intact).
  resetConfig({
    models: SEED_MODELS,
    raw: { slides_preview: { base_url: 'http://127.0.0.1:1', probe_timeout_ms: 500 } },
  });
  resetSlidesProbeCache();
  app = createApp();
  const orm = getOrm();
  notebookA = orm.insert(notebooks).values({ name: 'surface-a' }).returning().get().id;
  const notebookB = orm.insert(notebooks).values({ name: 'surface-b' }).returning().get().id;
  const sessionId = orm
    .insert(sessions)
    .values({ notebookId: notebookA, title: 's' })
    .returning()
    .get().id;
  orm.insert(messages).values({ sessionId, role: 'user', content: 'only in A' }).run();
  void notebookB;
});

afterAll(() => {
  teardownIntegrationEnv();
  resetConfig();
});

async function get(path: string) {
  const res = await app.handle(new Request(`${BASE}${path}`));
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

interface ToolShape {
  id: string;
  outputType: string;
  enabled: boolean;
  configSchema: unknown;
  frontendBundle: unknown;
}

async function getTools(): Promise<ToolShape[]> {
  const { status, body } = await get('/v2/workspace/tools');
  expect(status).toBe(200);
  return (body as { tools: ToolShape[] }).tools;
}

describe('r348 health endpoints stay reachable for ops', () => {
  it('health family answers anonymously with guardrails context present', async () => {
    // covers: r348 — /health, /health/dependencies, /v2/health stay usable
    // for ops probes; no guardrail middleware rejects them (no auth headers
    // attached, default guardrail config in effect).
    for (const path of ['/health', '/health/dependencies', '/v2/health']) {
      const { status, body } = await get(path);
      expect(status).toBe(200);
      expect((body as { status?: string }).status).toBe('ok');
    }
  });
});

describe('r363/r367 models list envelope', () => {
  it('list envelope carries a providers field', async () => {
    // covers: r363 — providers lives on the list envelope itself.
    const { status, body } = await get('/v2/models');
    expect(status).toBe(200);
    const list = body as { providers: string[] };
    expect(Array.isArray(list.providers)).toBe(true);
    expect(list.providers).toContain('openai');
  });

  it('list envelope puts defaults at the top level', async () => {
    // covers: r367 — defaults live on the envelope (not inline per-model);
    // list items MAY additionally carry the default markers.
    const { status, body } = await get('/v2/models');
    expect(status).toBe(200);
    const list = body as {
      defaults: Record<string, string | null>;
      models: Array<{ id: string; isDefaultChat: boolean; isDefaultEmbedding: boolean }>;
    };
    expect(list.defaults).toEqual({
      chat: 'chat-known',
      embedding: 'embed-known',
      edit: null,
      autocomplete: null,
    });
    const chat = list.models.find((m) => m.id === 'chat-known');
    expect(chat?.isDefaultChat).toBe(true);
    const embed = list.models.find((m) => m.id === 'embed-known');
    expect(embed?.isDefaultEmbedding).toBe(true);
  });
});

describe('r364 models filter by provider availability', () => {
  it('list excludes models whose provider is not in the registry', async () => {
    // covers: r364
    const { status, body } = await get('/v2/models');
    expect(status).toBe(200);
    const list = body as { models: Array<{ id: string }> };
    expect(list.models.some((m) => m.id === 'ghost-model')).toBe(false);
    expect(list.models.some((m) => m.id === 'chat-known')).toBe(true);
  });

  it('GET single unavailable-provider model returns 404 envelope', async () => {
    // covers: r364
    const { status, body } = await get('/v2/models/ghost-model');
    expect(status).toBe(404);
    expect((body as { errorCode?: string }).errorCode).toBe('NOT_FOUND');
  });

  it('GET single available model returns 200', async () => {
    // covers: r364
    const { status, body } = await get('/v2/models/chat-known');
    expect(status).toBe(200);
    expect((body as { id: string }).id).toBe('chat-known');
  });
});

describe('r360/r361/r362 workspace tools descriptors', () => {
  it('every tool carries a frontendBundle descriptor field', async () => {
    // covers: r360 — frontendBundle is present on tool objects; builtin
    // output types resolve to a concrete bundle descriptor.
    const tools = await getTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect('frontendBundle' in tool).toBe(true);
    }
    const faq = tools.find((t) => t.outputType === 'FAQ');
    expect(faq?.frontendBundle).toMatchObject({ kind: 'builtin', id: 'output-faq' });
  });

  it('SLIDES tool exposes a complete configSchema', async () => {
    // covers: r361 — configSchema covers defaults (incl. frontmatter), all
    // option families, and the active plugin's engine/preview metadata.
    const slides = (await getTools()).find((t) => t.outputType === 'SLIDES');
    const schema = slides?.configSchema as Record<string, unknown> | null;
    expect(schema).not.toBeNull();
    expect(schema?.engine).toBe('slidev');
    expect(schema?.preview).toMatchObject({ service: 'slidev' });
    const defaults = schema?.defaults as Record<string, unknown>;
    for (const key of [
      'quantity',
      'audience',
      'structure',
      'tone',
      'language',
      'density',
      'themePreset',
      'frontmatter',
    ]) {
      expect(key in defaults).toBe(true);
    }
    for (const key of [
      'quantityOptions',
      'audienceOptions',
      'structureOptions',
      'toneOptions',
      'languageOptions',
      'densityOptions',
      'themePresetOptions',
    ]) {
      expect(Array.isArray(schema?.[key])).toBe(true);
    }
  });

  it('tool config endpoint stays consistent with the tools list configSchema', async () => {
    // covers: r362 — /workspace/tools/:id/config returns the same defaults
    // the tools list advertises for SLIDES.
    const slides = (await getTools()).find((t) => t.outputType === 'SLIDES');
    const fromList = slides?.configSchema as { defaults: unknown };
    const { status, body } = await get('/v2/workspace/tools/slides/config');
    expect(status).toBe(200);
    expect((body as { defaults?: unknown }).defaults).toEqual(fromList.defaults);
  });
});

describe('r372 process registry endpoints stay global flat', () => {
  it('GET /v2/sources/parsers returns the parser registry at the flat path', async () => {
    // covers: r372
    const { status, body } = await get('/v2/sources/parsers');
    expect(status).toBe(200);
    const parsers = body as Array<{ id: string; name: string; mimeTypes: string[] }>;
    expect(Array.isArray(parsers)).toBe(true);
    expect(parsers.length).toBeGreaterThan(0);
    for (const parser of parsers) {
      expect(typeof parser.id).toBe('string');
      expect(Array.isArray(parser.mimeTypes)).toBe(true);
    }
  });

  it('parsers registry is not nested under /v2/notebooks/:nid', async () => {
    // covers: r372 — the nested path is NOT served by the parser registry.
    // Implementation note: the request falls into the `:sid` source route and
    // fails path-id validation (422 per r374) instead of a bare 404.
    const { status, body } = await get(`/v2/notebooks/${notebookA}/sources/parsers`);
    expect(status).toBe(422);
    expect((body as { errorCode?: string }).errorCode).toBe('SCHEMA_VALIDATION_FAILED');
    expect(Array.isArray(body)).toBe(false);
  });

  it('other process-level registries stay flat too', async () => {
    // covers: r372 — notebooks list, models, prompt-presets, templates remain
    // global flat endpoints.
    for (const path of ['/v2/notebooks', '/v2/models', '/v2/prompt-presets', '/v2/templates']) {
      const { status } = await get(path);
      expect(status).toBe(200);
    }
  });
});

describe('r381 notebook-scoped lists never dump all notebooks', () => {
  it('flat scoped list paths are rejected, not served as aggregate dumps', async () => {
    // covers: r381 — a scoped list requested without its notebook filter
    // (the flat alias path) MUST be rejected with the unified envelope and
    // MUST NOT return an aggregate of all notebooks. Note: since c90 the
    // flat aliases are removed entirely, so the rejection manifests as 404
    // rather than 400 (see report; rule text unchanged).
    for (const path of [
      '/v2/outputs',
      '/v2/sources',
      '/v2/sessions',
      '/v2/messages',
      '/v2/studio/slides',
    ]) {
      const { status, body } = await get(path);
      expect(status).toBe(404);
      expect((body as { errorCode?: string }).errorCode).toBe('NOT_FOUND');
    }
  });

  it('notebook-scoped list returns only rows of the path notebook', async () => {
    // covers: r381
    const { status, body } = await get(`/v2/notebooks/${notebookA}/sessions`);
    expect(status).toBe(200);
    const page = body as { items: Array<{ notebookId: number }> };
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((s) => s.notebookId === notebookA)).toBe(true);
  });
});
