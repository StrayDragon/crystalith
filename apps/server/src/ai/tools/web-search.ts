// webSearch tool — queries a SearXNG instance and returns result snippets.
//
// Mirrors v1's SearXNG integration but simplified: a single fetch to the
// configured `search.searxng.host` endpoint with the `format=json` parameter.
// When no SearXNG host is configured, the tool returns an empty list (the
// research agent degrades gracefully).
import { tool } from 'ai';
import { z } from 'zod';

import { getSearxngHost, getSearchSettings } from '../../shared/config.ts';

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
  timeoutMs: getSearchSettings().searxng.timeout,
  maxResults: 10,
};

/**
 * Raw web search via SearXNG (used by /sources/search endpoint + webSearchTool).
 * Defaults host to getSearxngHost() when not provided, so callers don't need
 * to plumb it explicitly. Returns empty list if SearXNG is unavailable.
 */
export async function searchWeb(
  query: string,
  opts?: { maxResults?: number; host?: string; timeoutMs?: number },
): Promise<WebSearchResultItem[]> {
  const host = opts?.host ?? getSearxngHost();
  if (!host) return [];
  const maxResults = opts?.maxResults ?? DEFAULT_CONFIG.maxResults;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_CONFIG.timeoutMs;

  const url = new URL('/search', host);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  // c53: use reliable engines explicitly — SearXNG's default engine set may
  // include rate-limited engines (Google, DuckDuckGo) that timeout.
  // Bing and Wikipedia are consistently available.
  url.searchParams.set('engines', 'bing,wikipedia,brave,google');

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
      // Delegate to searchWeb — single fetch implementation (no duplication)
      return searchWeb(query, {
        maxResults,
        host: cfg.host || undefined,
        timeoutMs: cfg.timeoutMs,
      });
    },
  });
}
