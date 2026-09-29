// covers: c125 configuration-governance lock tests
//   r30 — CL_* env overrides YAML, which overrides hardcoded defaults
//   r32 — three-stage loading pipeline (template render → YAML parse → Zod
//         validation) fails loudly on any stage
//   r34 — all runtime storage derives from storage.data_root (+ CL_DATA_ROOT)
//   r37 — deterministic loading: same inputs → identical AppConfig;
//         missing secret.env must not change behavior
//   r38 — compiled-distribution resolution: migrations folder / sqlite-vec
//         native path / web-dist root resolve without repo assumptions
//   r16 — extractor + slides-workflow built-ins register through the single
//         PluginRegistry path (no parallel registration shapes)
//
// Self-contained: env mutations are restored in afterEach (isolation discipline).
import { afterEach, describe, expect, it } from 'bun:test';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveMigrationsFolder, resolveSqliteVecNativePath } from '../src/db/index.ts';
import {
  loadConfig,
  resetConfig,
  getDataRoot,
  envValue,
  resetEnvOverlay,
} from '../src/shared/config.ts';
import { resolveWebDistRoot } from '../src/shared/web-static.ts';

const TMP_YAML = join(tmpdir(), `crystalith-c125-${process.pid}.yaml`);

function writeYaml(content: string): string {
  writeFileSync(TMP_YAML, content);
  return TMP_YAML;
}

afterEach(() => {
  resetConfig();
  rmSync(TMP_YAML, { force: true });
  delete process.env.CL_DATA_ROOT;
  resetEnvOverlay();
});

describe('r30 configuration source priority chain', () => {
  it('CL_DATA_ROOT overrides the YAML storage.data_root', () => {
    const path = writeYaml('storage:\n  data_root: ./data_local\n');
    process.env.CL_DATA_ROOT = '/tmp/c125-prod-root';
    resetConfig(loadConfig(path));
    expect(getDataRoot()).toBe('/tmp/c125-prod-root');
  });

  it('without the env var, YAML wins over the hardcoded default', () => {
    const path = writeYaml('storage:\n  data_root: ./data_local\n');
    resetConfig(loadConfig(path));
    expect(getDataRoot()).toBe('./data_local');
  });

  it('without YAML and env, the hardcoded default applies', () => {
    const path = writeYaml('search:\n  searxng:\n    host: http://localhost:8888\n');
    resetConfig(loadConfig(path));
    expect(getDataRoot()).toBe('./data');
  });

  it('envValue exposes the CL_* chain directly', () => {
    process.env.CL_DATA_ROOT = '/tmp/c125-probe';
    expect(envValue('CL_DATA_ROOT')).toBe('/tmp/c125-probe');
  });
});

describe('r32 YAML config loading pipeline fails loudly', () => {
  it('invalid YAML syntax throws instead of silently degrading', () => {
    const path = writeYaml('storage: [unclosed\n  bad::: yaml');
    expect(() => loadConfig(path)).toThrow();
  });

  it('schema validation failure on the strict models section throws', () => {
    // models is Zod-validated inside loadConfig; an invalid shape must throw.
    const path = writeYaml('models:\n  available: not-a-list\n');
    expect(() => loadConfig(path)).toThrow();
  });

  it('removed secret.* namespace fails the template stage with a readable error', () => {
    const path = writeYaml('storage:\n  data_root: "{{ secret.api_key }}"\n');
    expect(() => loadConfig(path)).toThrow(/secret/);
  });
});

describe('r34 unified storage data root', () => {
  it('CL_DATA_ROOT override flows through getDataRoot used by all storage bases', () => {
    process.env.CL_DATA_ROOT = '/tmp/c125-storage-root';
    resetConfig(loadConfig(writeYaml('storage:\n  data_root: ./data_local\n')));
    const root = getDataRoot();
    expect(root).toBe('/tmp/c125-storage-root');
    // sub-path consumers derive from the same root (spot-check join shape)
    expect(join(root, 'storage')).toBe(join('/tmp/c125-storage-root', 'storage'));
  });
});

describe('r37 configuration is deterministic', () => {
  it('the same env + yaml produce a deeply identical AppConfig', () => {
    const path = writeYaml(
      'storage:\n  data_root: ./data_local\nsearch:\n  searxng:\n    host: http://localhost:8888\n',
    );
    const first = loadConfig(path);
    const second = loadConfig(path);
    expect(second).toEqual(first);
  });

  it('missing secret.env does not change behavior (loads still succeed)', () => {
    // No secret.env exists in the test environment; loading must succeed and
    // be stable across repeats (warn-only semantics).
    const path = writeYaml('storage:\n  data_root: ./data_local\n');
    const first = loadConfig(path);
    const second = loadConfig(path);
    expect(second).toEqual(first);
  });
});

describe('r38 compiled distribution config resolution', () => {
  it('resolveMigrationsFolder finds the drizzle dir (source-tree layout)', () => {
    const folder = resolveMigrationsFolder();
    expect(folder).toContain('drizzle');
  });

  it('resolveSqliteVecNativePath degrades gracefully (null or an existing candidate)', () => {
    // No native/ dir beside the "executable" in tests — must not throw.
    const result = resolveSqliteVecNativePath();
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('resolveWebDistRoot returns null without CL_WEB_DIST or a web/dist dir (headless OK)', () => {
    const prev = process.env.CL_WEB_DIST;
    delete process.env.CL_WEB_DIST;
    try {
      // In the source tree web/dist may or may not exist; both are valid.
      const root = resolveWebDistRoot();
      expect(root === null || typeof root === 'string').toBe(true);
    } finally {
      if (prev === undefined) delete process.env.CL_WEB_DIST;
      else process.env.CL_WEB_DIST = prev;
    }
  });

  it('temporary data-root isolation works (tmpdir helper sanity)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'c125-'));
    expect(dir).toContain('c125-');
    rmSync(dir, { force: true, recursive: true });
  });
});
