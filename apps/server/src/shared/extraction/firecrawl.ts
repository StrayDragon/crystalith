// Firecrawl extractor — mirrors v1 shared/extraction/firecrawl_extractor.py.
// Calls the Firecrawl REST API (POST /v2/scrape) without the SDK.
import { isWebExtractorEnabled, resolveFirecrawlApiKey } from './config.ts';
import type { ExtractedContent, Extractor } from './types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const firecrawlExtractor: Extractor = {
  name: 'firecrawl',

  isAvailable(config: unknown): boolean {
    return isWebExtractorEnabled(config, 'firecrawl') && !!resolveFirecrawlApiKey(config);
  },

  async extract(url: string, config: unknown): Promise<ExtractedContent> {
    const apiKey = resolveFirecrawlApiKey(config);
    if (!apiKey) throw new Error('Firecrawl API key required');

    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (res.status === 429) throw new Error('Firecrawl rate limit (429).');
    if (!res.ok) throw new Error(`Firecrawl returned ${res.status}: ${res.statusText}`);

    const raw: unknown = await res.json();
    const data = isRecord(raw) ? raw : {};
    const payload = isRecord(data.data) ? data.data : {};

    return {
      title: typeof payload.title === 'string' ? payload.title : url,
      content: typeof payload.markdown === 'string' ? payload.markdown : '',
      description: typeof payload.description === 'string' ? payload.description : undefined,
      extractorUsed: 'firecrawl',
    };
  },
};
