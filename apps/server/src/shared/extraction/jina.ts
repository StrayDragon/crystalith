// Jina Reader extractor — mirrors v1 shared/extraction/jina_extractor.py.
// Calls the r.jina.ai API (GET) with optional auth key and markdown format.
import type { ExtractedContent, Extractor } from './types.ts';

interface JinaConfig {
  extraction?: {
    jina_api_key?: string;
  };
}

export const jinaExtractor: Extractor = {
  name: 'jina',

  isAvailable(config: unknown): boolean {
    const c = config as JinaConfig;
    return !!c?.extraction?.jina_api_key;
  },

  async extract(url: string, config: unknown): Promise<ExtractedContent> {
    const c = config as JinaConfig;
    const apiKey = c?.extraction?.jina_api_key;
    const headers: Record<string, string> = {
      'X-Return-Format': 'markdown',
      Accept: 'text/markdown',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(`https://r.jina.ai/${url}`, { headers });
    if (res.status === 429) {
      throw new Error('Jina rate limit (429). Try again later.');
    }
    if (res.status === 402) {
      throw new Error('Jina quota exceeded (402).');
    }
    if (!res.ok) {
      throw new Error(`Jina returned ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    // Extract title from the first H1 / markdown heading.
    let title = url;
    const h1Match = text.match(/^#\s+(.+)$/m);
    if (h1Match) title = h1Match[1].trim();

    return {
      title,
      content: text,
      extractorUsed: 'jina',
    };
  },
};
