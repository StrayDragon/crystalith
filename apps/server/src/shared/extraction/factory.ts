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
