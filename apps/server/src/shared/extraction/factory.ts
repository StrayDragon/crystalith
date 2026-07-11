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
  available: boolean;
  display_name: string;
  priority: number;
  requires_api_key: boolean;
  recovery_hint: string | null;
}

const DISPLAY_NAMES: Record<string, string> = {
  readability: 'Readability (built-in)',
  jina: 'Jina Reader',
  firecrawl: 'Firecrawl',
};

const RECOVERY_HINTS: Record<string, string> = {
  jina: 'Set extraction.jina_api_key in config',
  firecrawl: 'Set extraction.firecrawl_api_key in config',
};

/**
 * List all extractors with availability + metadata (v1 ExtractorsListResponse).
 * Uses each extractor's isAvailable() against the real config object, not env vars.
 */
export function listExtractorMetadata(config: unknown): ExtractorMetadata[] {
  return DEFAULT_ORDER.map((name, index) => {
    const ext = extractors[name];
    return {
      name,
      available: ext ? ext.isAvailable(config) : false,
      display_name: DISPLAY_NAMES[name] ?? name,
      priority: (index + 1) * 10,
      requires_api_key: name !== 'readability',
      recovery_hint: RECOVERY_HINTS[name] ?? null,
    };
  });
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
