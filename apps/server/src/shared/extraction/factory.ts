import { firecrawlExtractor } from './firecrawl.ts';
import { jinaExtractor } from './jina.ts';
import { readabilityExtractor } from './readability.ts';
// ExtractorFactory — fallback chain for web content extraction.
// Mirrors v1 shared/extraction/factory.py.
//
// Tries extractors in priority order (configurable per notebook). Returns
// the first non-empty result. Throws ExtractionError if all fail.
import type { ExtractedContent, Extractor } from './types.ts';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All registered extractors keyed by name. */
export const extractors: Record<string, Extractor> = {
  readability: readabilityExtractor,
  jina: jinaExtractor,
  firecrawl: firecrawlExtractor,
};

/** Default fallback order (all readable/jina require no key beyond availability check). */
const DEFAULT_ORDER = ['readability', 'jina', 'firecrawl'];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export class ExtractionError extends Error {
  constructor(
    message: string,
    public failedExtractors: string[],
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

// ---------------------------------------------------------------------------
// Metadata / availability report (v1 ExtractorsListResponse)
// ---------------------------------------------------------------------------

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

const DISPLAY_NAMES: Record<string, string> = {
  readability: 'Readability (built-in)',
  jina: 'Jina Reader',
  firecrawl: 'Firecrawl',
};

const DESCRIPTIONS: Record<string, string> = {
  readability: '基于 @mozilla/readability 的本地正文提取，无需外部服务',
  jina: 'Jina Reader API，适合 JS 重渲染页面',
  firecrawl: 'Firecrawl API，浏览器渲染级提取',
};

const RECOVERY_HINTS: Record<string, string> = {
  jina: 'Set CL_JINA_API_KEY (secret.env / shell); falls back to JINA_API_KEY',
  firecrawl: 'Set CL_FIRECRAWL_API_KEY (+ optional CL_FIRECRAWL_API_BASE for self-hosted)',
};

/**
 * List all extractors with availability + metadata (v1 ExtractorsListResponse).
 * Uses each extractor's isAvailable() against the real config object, not env vars.
 * c62: adds type/enabled/description/requiresService fields + derives default.
 */
export function listExtractorMetadata(config: unknown): ExtractorMetadata[] {
  return DEFAULT_ORDER.map((name, index) => {
    const ext = extractors[name];
    return {
      name,
      // c62: v1 uses `type`; `name` is the v2 alias
      type: name,
      available: ext ? ext.isAvailable(config) : false,
      // v2 has no per-extractor disable config (monolithic)
      enabled: true,
      displayName: DISPLAY_NAMES[name] ?? name,
      description: DESCRIPTIONS[name] ?? '',
      priority: (index + 1) * 10,
      requiresApiKey: name !== 'readability',
      // jina/firecrawl call external services
      requiresService: name !== 'readability',
      recoveryHint: RECOVERY_HINTS[name] ?? null,
    };
  });
}

/** c62: derive defaultExtractor by availability (first available), v1 parity. */
export function getDefaultExtractor(config: unknown): string {
  const meta = listExtractorMetadata(config);
  return meta.find((e) => e.available)?.name ?? 'readability';
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
  const extractorOrder = order && order.length > 0 ? order : DEFAULT_ORDER;
  const failures: string[] = [];

  for (const name of extractorOrder) {
    const ext = extractors[name];
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
