// External plugin discovery/loading (r11): plugins are npm dependencies under
// the `@crystalith-plugin/*` scope. Install/upgrade/disable takes effect on
// server restart — no runtime hot-swap. Pure-JS only (no native addons).
//
// Official workspace exemplars that ship in the compiled single binary MUST be
// statically imported here: bun compile cannot see runtime node_modules, so a
// purely dynamic `import('@crystalith-plugin/${id}')` would 415 after
// `just build-binary`. Third-party installs still go through discovery +
// dynamic import when node_modules is present.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import parserDocx from '@crystalith-plugin/parser-docx';

import type { CrystalithPlugin } from './types.ts';

const EXTERNAL_PLUGIN_SCOPE = '@crystalith-plugin';

/** Official workspace plugins compiled into the server binary. */
const BUNDLED_EXTERNAL_PLUGINS: Record<string, CrystalithPlugin> = {
  'parser-docx': parserDocx,
};

/**
 * Plugin ids discovered from installed packages: `<dir>/@crystalith-plugin/<id>`.
 * Directories are candidate node_modules roots (cwd + repo root cover dev and
 * compiled-binary layouts). Bundled official exemplars are always included so
 * the single binary does not depend on a sibling node_modules tree.
 */
export function discoverExternalPluginIds(nodeModuleDirs: readonly string[]): string[] {
  const ids = new Set<string>(Object.keys(BUNDLED_EXTERNAL_PLUGINS));
  for (const dir of nodeModuleDirs) {
    const scopeDir = join(dir, EXTERNAL_PLUGIN_SCOPE);
    if (!existsSync(scopeDir)) continue;
    let entries: string[] = [];
    try {
      entries = readdirSync(scopeDir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      ids.add(name);
    }
  }
  return [...ids];
}

/**
 * Node modules directories considered for discovery: CWD first, then the
 * repo-root layout derived from this module's location
 * (apps/server/src/plugins → repo root/node_modules).
 */
export function nodeModuleDirCandidates(): string[] {
  const dirs = [join(process.cwd(), 'node_modules')];
  // Walk up from this module (…/apps/server/src/plugins) to the repo root so
  // both bun's per-package layout (apps/server/node_modules) and a hoisted
  // root node_modules are covered; self-hosted installs `bun add` plugins
  // next to the server entry and get discovered the same way.
  let dir = import.meta.dirname;
  for (let i = 0; i < 5; i++) {
    dirs.push(join(dir, 'node_modules'));
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return [...new Set(dirs)];
}

/**
 * Dynamic import of an external plugin package. Must export a
 * `CrystalithPlugin` as the package default.
 */
export async function importExternalPlugin(id: string): Promise<CrystalithPlugin> {
  const bundled = BUNDLED_EXTERNAL_PLUGINS[id];
  if (bundled) return bundled;
  // eslint-disable-next-line typescript/no-unsafe-type-assertion -- 动态 import 的模块形状边界
  const mod = (await import(`${EXTERNAL_PLUGIN_SCOPE}/${id}`)) as {
    default?: CrystalithPlugin;
  };
  const plugin = mod?.default;
  if (
    !plugin ||
    typeof plugin.id !== 'string' ||
    typeof plugin.factory !== 'function' ||
    typeof plugin.kind !== 'string'
  ) {
    throw new Error(
      `package '${EXTERNAL_PLUGIN_SCOPE}/${id}' does not default-export a CrystalithPlugin`,
    );
  }
  return plugin;
}
