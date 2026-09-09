// plugin-interface-ssot tests — registry policy/load semantics (r7/r11) and
// extractor metadata derivation over the registry-backed factory.
import { describe, expect, test } from 'bun:test';
import { afterAll, beforeAll } from 'bun:test';

import { z } from 'zod';

import { pluginRegistry, PluginRegistry } from '../../src/plugins/registry.ts';
import type { PluginSettings, RegistryDeps } from '../../src/plugins/registry.ts';
import type { CrystalithPlugin } from '../../src/plugins/types.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { listExtractorMetadata } from '../../src/shared/extraction/factory.ts';

function fakePlugin(id: string, opts: { fail?: boolean } = {}): CrystalithPlugin {
  return {
    id,
    kind: 'parser',
    displayName: id,
    configSchema: z.object({}),
    capabilities: [],
    factory: async () => {
      if (opts.fail) throw new Error('boom');
      return { id };
    },
  };
}

const NO_SETTINGS: PluginSettings = { enabled: [], disabled: [], load_order: [] };

function makeRegistry(
  builtins: CrystalithPlugin[],
  opts: {
    settings?: Partial<PluginSettings>;
    external?: { discover?: string[]; failIds?: string[] };
  } = {},
): PluginRegistry {
  const deps: RegistryDeps = {
    builtins: () => builtins,
    discoverExternal: () => opts.external?.discover ?? [],
    importExternal: async (id) => {
      if (opts.external?.failIds?.includes(id)) throw new Error(`cannot import ${id}`);
      return fakePlugin(id);
    },
    nodeModuleDirs: () => [],
    settings: () => ({ ...NO_SETTINGS, ...opts.settings }),
    dataRoot: () => '/tmp',
  };
  return new PluginRegistry(deps);
}

describe('PluginRegistry load semantics', () => {
  test('builtins load in registration order when policy is empty', async () => {
    const registry = makeRegistry([fakePlugin('a'), fakePlugin('b')]);
    const report = await registry.ensureLoaded();
    expect(report.loaded).toEqual(['a', 'b']);
    expect(report.skipped).toEqual({});
    expect(registry.isLoaded('a')).toBeTrue();
  });

  test('factory failure lands in skipped without blocking others', async () => {
    const registry = makeRegistry([fakePlugin('ok'), fakePlugin('bad', { fail: true })]);
    const report = await registry.ensureLoaded();
    expect(report.loaded).toEqual(['ok']);
    expect(report.skipped['bad']?.errorCode).toBe('PLUGIN_FACTORY_FAILED');
  });

  test('denylist always wins', async () => {
    const registry = makeRegistry([fakePlugin('a'), fakePlugin('b')], {
      settings: { disabled: ['b'] },
    });
    const report = await registry.ensureLoaded();
    expect(report.loaded).toEqual(['a']);
    expect(report.skipped['b']?.errorCode).toBe('PLUGIN_DISABLED');
  });

  test('non-empty allowlist skips unlisted ids', async () => {
    const registry = makeRegistry([fakePlugin('a'), fakePlugin('b')], {
      settings: { enabled: ['b'] },
    });
    const report = await registry.ensureLoaded();
    expect(report.loaded).toEqual(['b']);
    expect(report.skipped['a']?.errorCode).toBe('PLUGIN_NOT_ALLOWLISTED');
  });

  test('disabled beats allowlist when both list an id', async () => {
    const registry = makeRegistry([fakePlugin('a')], {
      settings: { enabled: ['a'], disabled: ['a'] },
    });
    const report = await registry.ensureLoaded();
    expect(report.loaded).toEqual([]);
    expect(report.skipped['a']?.errorCode).toBe('PLUGIN_DISABLED');
  });

  test('load_order reorders instantiation (listed first, list order)', async () => {
    const registry = makeRegistry([fakePlugin('x'), fakePlugin('y'), fakePlugin('z')], {
      settings: { load_order: ['z', 'y'] },
    });
    const report = await registry.ensureLoaded();
    expect(report.loaded).toEqual(['z', 'y', 'x']);
    // Consumer-facing chains follow the instantiation order, not registration.
    expect(registry.loadedByKind('parser').map((r) => r.plugin.id)).toEqual(['z', 'y', 'x']);
  });

  test('same-id registration: later wins', async () => {
    const registry = makeRegistry([]);
    registry.register({ plugin: fakePlugin('dup'), source: 'builtin' });
    registry.register({ plugin: fakePlugin('dup'), source: 'external' });
    const report = await registry.ensureLoaded();
    expect(report.loaded).toEqual(['dup']);
    expect(registry.allRegistrations().length).toBe(1);
    expect(registry.allRegistrations()[0]?.source).toBe('external');
  });

  test('external import failure is recorded as skipped', async () => {
    const registry = makeRegistry([], {
      external: { discover: ['missing-ext'], failIds: ['missing-ext'] },
    });
    const report = await registry.ensureLoaded();
    expect(report.loaded).toEqual([]);
    expect(report.skipped['missing-ext']?.errorCode).toBe('PLUGIN_IMPORT_FAILED');
  });
});

describe('extractor metadata over the registry', () => {
  // The live singleton snapshots plugin policy on first ensureLoaded — seed an
  // explicit default-order config FIRST so repo app.yaml extras (e.g. the
  // `load_order: ["extractor-arxiv"]` trial) cannot leak into the assertion.
  beforeAll(() => {
    resetConfig({
      models: { defaults: { chat: 'test-chat' }, available: [] },
      raw: {},
    });
    pluginRegistry.reset();
  });

  afterAll(() => {
    pluginRegistry.reset();
  });

  test('built-in extractors keep v1/v2 wire names and fallback order', async () => {
    await pluginRegistry.ensureLoaded();
    const meta = listExtractorMetadata({});
    // Built-ins in registration (fallback) order; external exemplar plugin
    // (workspace symlink) lands after built-ins.
    expect(meta.map((m) => m.name)).toEqual(['readability', 'jina', 'firecrawl', 'arxiv']);
    expect(meta.map((m) => m.priority)).toEqual([10, 20, 30, 40]);
    expect(meta[0]?.requiresApiKey).toBeFalse();
    expect(meta[1]?.requiresApiKey).toBeTrue();
    expect(meta[2]?.recoveryHint).toContain('CL_FIRECRAWL_API_KEY');
    expect(meta[3]?.enabled).toBeTrue();
  });
});
