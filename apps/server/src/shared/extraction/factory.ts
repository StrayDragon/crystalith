// Extractor orchestration — fallback chain for web content extraction.
// Mirrors v1 shared/extraction/factory.py.
//
// Since plugin-interface-ssot (r7), the extractor implementations register as
// built-in `CrystalithPlugin`s (kind: 'extractor'); this module keeps only the
// kind-level orchestration required by web-extractor-plugins r55: ordered
// fallback, availability gating and the metadata/availability report.
// Wire extractor names ('readability' | 'jina' | 'firecrawl') are derived from
// plugin ids by stripping the `extractor-` prefix.
import { pluginRegistry } from '../../plugins/registry.ts';
import type { CrystalithPlugin } from '../../plugins/types.ts';
import type { ExtractedContent, Extractor } from './types.ts';

const EXTRACTOR_ID_PREFIX = 'extractor-';

export class ExtractionError extends Error {
  constructor(
    message: string,
    public failedExtractors: string[],
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

export interface ExtractorMetadata {
  name: string;
  type: string;
  available: boolean;
  enabled: boolean;
  displayName: string;
  description: string;
  priority: number;
  requiresApiKey: boolean;
  requiresService: boolean;
  recoveryHint: string | null;
}

function wireName(plugin: CrystalithPlugin): string {
  return plugin.id.startsWith(EXTRACTOR_ID_PREFIX)
    ? plugin.id.slice(EXTRACTOR_ID_PREFIX.length)
    : plugin.id;
}

/** Loaded extractor plugins in fallback order (registration order). */
function loadedExtractorEntries(): {
  name: string;
  plugin: CrystalithPlugin;
  extractor: Extractor;
}[] {
  return pluginRegistry.loadedByKind('extractor').map(({ plugin }) => ({
    name: wireName(plugin),
    plugin,
    extractor: pluginRegistry.implOf<Extractor>(plugin.id)!,
  }));
}

/**
 * List all extractors with availability + metadata (v1 ExtractorsListResponse).
 * Availability uses each extractor's isAvailable() against the real config
 * object; `enabled` reflects the plugin registry load state (plugins
 * allowlist/denylist).
 */
export function listExtractorMetadata(config: unknown): ExtractorMetadata[] {
  return loadedExtractorEntries().map(({ name, plugin, extractor }, index) => ({
    name,
    // v1 uses `type`; `name` is the v2 alias
    type: name,
    available: extractor.isAvailable(config),
    enabled: pluginRegistry.isLoaded(plugin.id),
    displayName: plugin.displayName,
    description: plugin.description ?? '',
    priority: (index + 1) * 10,
    requiresApiKey: plugin.capabilities.includes('requires-api-key'),
    requiresService: plugin.capabilities.includes('requires-service'),
    recoveryHint: plugin.recoveryHint ?? null,
  }));
}

/** Derive defaultExtractor by availability (first available), v1 parity. */
export function getDefaultExtractor(config: unknown): string {
  return listExtractorMetadata(config).find((e) => e.available)?.name ?? 'readability';
}

/** Loaded extractor wire names in fallback order (policy validation, etc.). */
export function extractorNames(): string[] {
  return loadedExtractorEntries().map((entry) => entry.name);
}

/**
 * Extract URL content by trying extractors in order. Returns the first
 * successful result. Throws ExtractionError if all extractors fail.
 */
export async function extractUrl(
  url: string,
  config: unknown,
  order?: string[],
): Promise<ExtractedContent> {
  await pluginRegistry.ensureLoaded();
  const entries = loadedExtractorEntries();
  const byName = new Map(entries.map((entry) => [entry.name, entry.extractor]));
  const extractorOrder = order && order.length > 0 ? order : entries.map((entry) => entry.name);
  const failures: string[] = [];

  for (const name of extractorOrder) {
    const ext = byName.get(name);
    if (!ext) {
      failures.push(`${name}: unknown extractor`);
      continue;
    }
    if (!ext.isAvailable(config)) {
      continue;
    }
    try {
      const result = await ext.extract(url, config);
      if (result.content && result.content.trim().length > 0) {
        return result;
      }
      failures.push(`${name}: empty content`);
    } catch (error) {
      failures.push(`${name}: ${String(error)}`);
    }
  }

  throw new ExtractionError(`All extractors failed: ${failures.join('; ')}`, extractorOrder);
}
