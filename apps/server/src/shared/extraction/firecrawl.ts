// Firecrawl extractor — mirrors v1 shared/extraction/firecrawl_extractor.py.
// Calls the Firecrawl REST API (POST /v2/scrape) without the SDK.
import type { ExtractedContent, Extractor } from './types.ts';

interface FirecrawlConfig {
  extraction?: {
    firecrawl_api_key?: string;
  };
}

export const firecrawlExtractor: Extractor = {
  name: 'firecrawl',

  isAvailable(config: unknown): boolean {
    const c = config as FirecrawlConfig;
    return !!c?.extraction?.firecrawl_api_key;
  },

  async extract(url: string, config: unknown): Promise<ExtractedContent> {
    const apiKey = (config as FirecrawlConfig)?.extraction?.firecrawl_api_key;
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

    const data = (await res.json()) as {
      success?: boolean;
      data?: { markdown?: string; title?: string; description?: string };
    };

    return {
      title: data?.data?.title ?? url,
      content: data?.data?.markdown ?? '',
      description: data?.data?.description,
      extractorUsed: 'firecrawl',
    };
  },
};
