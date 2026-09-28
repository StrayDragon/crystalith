// c117 — extractor selection bare rules (web-extractor-plugins):
// - r332: single-fetch preference + controlled, observable fallback order
// - r468: preferredExtractor=X is attempted first when X is available
// - r469: no available extractor in the configured chain → stable failure, no
//   fabricated success (orchestration level)
// - r334: global policy (config) + per-notebook policy (DB, inherit_global|custom)
// - r337: urlPatterns are metadata-only UI hints and never alter fall-through
//
// Fake extractor plugins are registered into the real plugin registry so the
// orchestration (extractUrl) and the HTTP from-url surface are both exercised
// without any outbound network call.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked' }),
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

import { z } from 'zod';

import { notebooks } from '../../src/db/schema.ts';
import { pluginRegistry } from '../../src/plugins/registry.ts';
import type { CrystalithPlugin } from '../../src/plugins/types.ts';
import { createApp } from '../../src/server.ts';
import { resetConfig } from '../../src/shared/config.ts';
import {
  ExtractionError,
  extractUrl,
  listExtractorMetadata,
} from '../../src/shared/extraction/factory.ts';
import type { ExtractedContent } from '../../src/shared/extraction/types.ts';
import {
  getOrm,
  seedChatModel,
  setupIntegrationEnv,
  stubEmbedding,
  teardownIntegrationEnv,
} from '../helpers/integration.ts';

const attempts: string[] = [];

function fakeExtractorPlugin(opts: {
  id: string;
  urlPatterns?: string[];
  available?: boolean;
  fail?: boolean;
  hint?: string;
}): CrystalithPlugin {
  return {
    id: opts.id,
    kind: 'extractor',
    displayName: opts.id,
    description: `fake extractor ${opts.id}`,
    recoveryHint: opts.hint,
    configSchema: z.object({}),
    capabilities: [],
    urlPatterns: opts.urlPatterns,
    factory: async () => ({
      name: opts.id,
      isAvailable: () => opts.available ?? true,
      extract: async (url: string): Promise<ExtractedContent> => {
        const wire = opts.id.replace(/^extractor-/, '');
        attempts.push(wire);
        if (opts.fail) throw new Error(`${wire} boom`);
        return {
          title: `${wire} title`,
          content: `content extracted by ${wire} from ${url}`,
          extractorUsed: wire,
        };
      },
    }),
  };
}

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;

beforeAll(async () => {
  setupIntegrationEnv();
  await stubEmbedding();
  // Config-defined fallback order puts the fake extractors ahead of the real
  // built-ins (r332: fallback order is configuration-defined).
  resetConfig({
    models: { defaults: { chat: 'test-chat' }, available: [] },
    raw: { plugins: { load_order: ['extractor-alpha', 'extractor-beta', 'extractor-patterned'] } },
  });
  seedChatModel();
  pluginRegistry.reset();
  pluginRegistry.register({
    plugin: fakeExtractorPlugin({ id: 'extractor-alpha' }),
    source: 'builtin',
  });
  pluginRegistry.register({
    plugin: fakeExtractorPlugin({ id: 'extractor-beta' }),
    source: 'builtin',
  });
  pluginRegistry.register({
    plugin: fakeExtractorPlugin({ id: 'extractor-gamma', fail: true }),
    source: 'builtin',
  });
  pluginRegistry.register({
    plugin: fakeExtractorPlugin({ id: 'extractor-delta', available: false, hint: 'enable delta' }),
    source: 'builtin',
  });
  pluginRegistry.register({
    plugin: fakeExtractorPlugin({
      id: 'extractor-patterned',
      urlPatterns: ['^https://hinted\\.example\\.com/'],
    }),
    source: 'builtin',
  });
  await pluginRegistry.ensureLoaded();
  app = createApp();
  notebookId = getOrm()
    .insert(notebooks)
    .values({ name: 'c117-extractor-nb' })
    .returning()
    .get().id;
});

afterAll(() => {
  pluginRegistry.reset();
  resetConfig(null);
  teardownIntegrationEnv();
});

const URL_HINTED = 'https://hinted.example.com/article';
// IP-literal URL skips DNS in validateUrlForFetch — required for hermetic from-url tests.
const URL_FETCHABLE = 'https://93.184.216.34/article';

async function postFromUrl(extractor?: string): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const res = await app.handle(
    new Request(`${BASE}/v2/notebooks/${notebookId}/sources/from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: URL_FETCHABLE,
        mode: 'fetch',
        ...(extractor ? { extractor } : {}),
      }),
    }),
  );
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

describe('c117 r468: preferred extractor attempted first', () => {
  it('orchestration tries the preferred extractor before any default-chain entry', async () => {
    attempts.length = 0;
    // Default chain starts with alpha, but the preference pins beta first.
    const result = await extractUrl(URL_HINTED, {}, ['beta']);
    expect(result.extractorUsed).toBe('beta');
    expect(attempts).toEqual(['beta']);
  });

  it('from-url honors the single-fetch extractor preference at the HTTP surface', async () => {
    attempts.length = 0;
    const { status, body } = await postFromUrl('beta');
    expect(status).toBe(200);
    expect(body.extractedBy).toBe('beta');
    expect(attempts).toEqual(['beta']);
  });
});

describe('c117 r332: preference and controlled, observable fallback', () => {
  it('uses the config-defined fallback order when no preference is given', async () => {
    attempts.length = 0;
    const result = await extractUrl(URL_HINTED, {}, undefined);
    expect(result.extractorUsed).toBe('alpha'); // load_order puts alpha first
    expect(attempts).toEqual(['alpha']);
  });

  it('does not silently fall through to other extractors when the preferred one fails', async () => {
    attempts.length = 0;
    // gamma fails; alpha/beta are available but the explicit order pins gamma.
    await expect(extractUrl(URL_HINTED, {}, ['gamma'])).rejects.toThrow('All extractors failed');
    expect(attempts).toEqual(['gamma']); // no alpha/beta attempt
  });

  it('records every failed attempt observably in the extraction error', async () => {
    attempts.length = 0;
    // Chain gamma (throws) → delta (unavailable) → nothing succeeds.
    let message = '';
    try {
      await extractUrl(URL_HINTED, {}, ['gamma', 'delta']);
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain('gamma: Error: gamma boom');
    // Unavailable extractors are skipped by availability (never attempted), and
    // the chain never fabricates a success.
    expect(attempts).toEqual(['gamma']); // delta skipped (unavailable), no silent success
  });
});

describe('c117 r337: urlPatterns are hints, not fall-through logic', () => {
  it('does not prefer a urlPatterns-matching extractor in the execution chain', async () => {
    attempts.length = 0;
    // The hinted URL matches extractor-patterned's urlPatterns, but the chain
    // still follows config order — alpha (no urlPatterns) executes first.
    const result = await extractUrl(URL_HINTED, {}, undefined);
    expect(result.extractorUsed).toBe('alpha');
    expect(attempts).toEqual(['alpha']);
  });

  it('exposes urlPatterns transparently in the extractors metadata', () => {
    const meta = listExtractorMetadata({});
    const patterned = meta.find((m) => m.name === 'patterned');
    const alpha = meta.find((m) => m.name === 'alpha');
    expect(patterned?.urlPatterns).toEqual(['^https://hinted\\.example\\.com/']);
    expect(alpha?.urlPatterns).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// r334 — global policy (config) + per-notebook policy (DB)
// ---------------------------------------------------------------------------

interface ExtractorWire {
  type: string;
  enabled: boolean;
  available: boolean;
}

interface ExtractorsListWire {
  notebookId: number;
  policy: { mode: string; enabledExtractors: string[] | null };
  extractors: ExtractorWire[];
  defaultExtractor: string;
  fallbackEnabled: boolean;
}

async function getExtractors(nid: number): Promise<{ status: number; body: ExtractorsListWire }> {
  const res = await app.handle(new Request(`${BASE}/v2/notebooks/${nid}/extractors`));
  return { status: res.status, body: (await res.json()) as ExtractorsListWire };
}

async function patchExtractors(
  nid: number,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: ExtractorsListWire & { errorCode?: string } }> {
  const res = await app.handle(
    new Request(`${BASE}/v2/notebooks/${nid}/extractors`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
  const text = await res.text();
  return {
    status: res.status,
    body: JSON.parse(text) as ExtractorsListWire & { errorCode?: string },
  };
}

function registerFakeSlice(): void {
  pluginRegistry.register({
    plugin: fakeExtractorPlugin({ id: 'extractor-alpha' }),
    source: 'builtin',
  });
  pluginRegistry.register({
    plugin: fakeExtractorPlugin({ id: 'extractor-beta' }),
    source: 'builtin',
  });
  pluginRegistry.register({
    plugin: fakeExtractorPlugin({ id: 'extractor-patterned' }),
    source: 'builtin',
  });
}

describe('c117 r334: global policy and per-notebook policy', () => {
  it('GET defaults to inherit_global with fallbackEnabled and global enabled flags', async () => {
    const { status, body } = await getExtractors(notebookId);
    expect(status).toBe(200);
    expect(body.policy.mode).toBe('inherit_global');
    expect(body.policy.enabledExtractors).toBeNull();
    expect(body.fallbackEnabled).toBe(true);
    // Global edge (plugin_enabled): the loaded-plugin set from config policy.
    const alpha = body.extractors.find((e) => e.type === 'alpha');
    expect(alpha?.enabled).toBe(true);
  });

  it('PATCH persists a custom notebook policy and flips fallbackEnabled off', async () => {
    const patch = await patchExtractors(notebookId, {
      mode: 'custom',
      enabledExtractors: ['alpha'],
    });
    expect(patch.status).toBe(200);
    expect(patch.body.policy).toEqual({ mode: 'custom', enabledExtractors: ['alpha'] });
    expect(patch.body.fallbackEnabled).toBe(false);

    // Persisted: a fresh GET reads the same notebook policy back.
    const fresh = await getExtractors(notebookId);
    expect(fresh.body.policy).toEqual({ mode: 'custom', enabledExtractors: ['alpha'] });
    expect(fresh.body.fallbackEnabled).toBe(false);

    // Unlisted extractors inherit the global default: the explicit notebook
    // override list stays exactly what was configured (no silent rewriting).
    expect(fresh.body.extractors.find((e) => e.type === 'beta')).toBeDefined();
  });

  it('PATCH rejects unknown extractor names and keeps the stored policy', async () => {
    const patch = await patchExtractors(notebookId, {
      mode: 'custom',
      enabledExtractors: ['alpha', 'not-a-real-extractor'],
    });
    expect(patch.status).toBe(400);
    expect(patch.body.errorCode).toBe('INVALID_REQUEST');

    const fresh = await getExtractors(notebookId);
    expect(fresh.body.policy).toEqual({ mode: 'custom', enabledExtractors: ['alpha'] });
  });

  it('global denylist (config) drives which extractors the list exposes', async () => {
    // Restore inherit_global for this notebook first so only the global edge varies.
    await patchExtractors(notebookId, { mode: 'inherit_global' });

    resetConfig({
      models: { defaults: { chat: 'test-chat' }, available: [] },
      raw: {
        plugins: {
          load_order: ['extractor-alpha', 'extractor-beta', 'extractor-patterned'],
          disabled: ['extractor-beta'],
        },
      },
    });
    pluginRegistry.reset();
    registerFakeSlice();
    await pluginRegistry.ensureLoaded();
    try {
      const { status, body } = await getExtractors(notebookId);
      expect(status).toBe(200);
      // Denylisted beta is not loaded → never exposed as usable; alpha stays.
      expect(body.extractors.find((e) => e.type === 'beta')).toBeUndefined();
      const alpha = body.extractors.find((e) => e.type === 'alpha');
      expect(alpha?.enabled).toBe(true);
    } finally {
      // Restore the suite slice for any later test / file-level cleanup.
      resetConfig({
        models: { defaults: { chat: 'test-chat' }, available: [] },
        raw: {
          plugins: { load_order: ['extractor-alpha', 'extractor-beta', 'extractor-patterned'] },
        },
      });
      pluginRegistry.reset();
      registerFakeSlice();
      await pluginRegistry.ensureLoaded();
    }
  });
});

describe('c117 r469: no available extractor yields a stable failure', () => {
  it('configured chain without any available extractor fails stably, fabricating nothing', async () => {
    attempts.length = 0;
    // The configured chain holds only an unavailable extractor — no attempt
    // can succeed, and the orchestration must fail stably instead of
    // fabricating a success or pulling in extractors outside the chain.
    let message = '';
    let failed: string[] = [];
    try {
      await extractUrl(URL_HINTED, {}, ['delta']);
    } catch (error) {
      if (error instanceof ExtractionError) {
        message = error.message;
        failed = error.failedExtractors;
      } else {
        throw error;
      }
    }
    expect(message).toContain('All extractors failed');
    expect(failed).toEqual(['delta']);
    expect(attempts).toEqual([]); // nothing attempted, nothing fabricated
  });
});
