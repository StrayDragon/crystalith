// webSearch tool — queries a SearXNG instance and returns result snippets.
//
// Mirrors v1's SearXNG integration but simplified: a single fetch to the
// configured `search.searxng.host` endpoint with the `format=json` parameter.
// When no SearXNG host is configured, the tool returns an empty list (the
// research agent degrades gracefully).
import { tool } from 'ai';
import { z } from 'zod';

export const WebSearchArgs = z.object({
  query: z.string().min(1).describe('The web search query.'),
  maxResults: z.number().int().positive().max(50).default(10),
});

export type WebSearchArgs = z.infer<typeof WebSearchArgs>;

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebSearchConfig {
  host: string;
  timeoutMs: number;
  maxResults: number;
}

const DEFAULT_CONFIG: WebSearchConfig = {
  host: '',
  timeoutMs: 10_000,
  maxResults: 10,
};

/**
 * Raw web search via SearXNG (used by /sources/search endpoint).
 * Returns empty list if SearXNG is not configured or unavailable.
 */
export async function searchWeb(
  query: string,
  opts?: { maxResults?: number; host?: string; timeoutMs?: number },
): Promise<WebSearchResultItem[]> {
  const host = opts?.host ?? DEFAULT_CONFIG.host;
  if (!host) return [];
  const maxResults = opts?.maxResults ?? DEFAULT_CONFIG.maxResults;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_CONFIG.timeoutMs;

  const url = new URL('/search', host);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('safesearch', '1');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { results?: Array<Record<string, unknown>> };
    const results = data.results ?? [];
    return results.slice(0, maxResults).map((r) => ({
      title: String(r.title ?? ''),
      url: String(r.url ?? ''),
      snippet: String(r.content ?? ''),
      source: String(r.engine ?? ''),
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/** Build a webSearch tool bound to a SearXNG config. */
export function webSearchTool(config: Partial<WebSearchConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return tool({
    description:
      "Search the web for information on a topic. Returns titles, URLs, and snippets. Use when the notebook's sources don't cover the query.",
    inputSchema: WebSearchArgs,
    execute: async ({ query, maxResults }): Promise<WebSearchResultItem[]> => {
      if (!cfg.host) {
        // Web search disabled — return empty so the agent can fall back.
        return [];
      }

      const url = new URL('/search', cfg.host);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('safesearch', '1');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

      try {
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) return [];

        const data = (await resp.json()) as { results?: Array<Record<string, unknown>> };
        const results = data.results ?? [];

        return results.slice(0, maxResults).map((r) => ({
          title: String(r.title ?? ''),
          url: String(r.url ?? ''),
          snippet: String(r.content ?? ''),
          source: String(r.engine ?? ''),
        }));
      } catch {
        return [];
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}
