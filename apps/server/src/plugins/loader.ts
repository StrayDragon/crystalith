// External plugin discovery/loading (r11): plugins are npm dependencies under
// the `@crystalith-plugin/*` scope. Install/upgrade/disable takes effect on
// server restart — no runtime hot-swap. Pure-JS only (no native addons).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { CrystalithPlugin } from './types.ts';

export const EXTERNAL_PLUGIN_SCOPE = '@crystalith-plugin';

/**
 * Plugin ids discovered from installed packages: `<dir>/@crystalith-plugin/<id>`.
 * Directories are candidate node_modules roots (cwd + repo root cover dev and
 * compiled-binary layouts).
 */
export function discoverExternalPluginIds(nodeModuleDirs: readonly string[]): string[] {
  const ids = new Set<string>();
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
  // import.meta.dirname = <root>/apps/server/src/plugins → root/node_modules
  dirs.push(join(import.meta.dirname, '..', '..', '..', 'node_modules'));
  return [...new Set(dirs)];
}

/**
 * Dynamic import of an external plugin package. Must export a
 * `CrystalithPlugin` as the package default.
 */
export async function importExternalPlugin(id: string): Promise<CrystalithPlugin> {
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
