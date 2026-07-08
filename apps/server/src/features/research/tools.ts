// Research tools — webSearch (SearXNG), analyzeResults, writeReport.
//
// AI SDK tools used by the research agent loop. The agent autonomously
// decides when to search/analyze/write via tool calling.
import { tool } from 'ai';
import { z } from 'zod';

import { config } from '../../shared/config.ts';

// ---------------------------------------------------------------------------
// SearXNG integration
// ---------------------------------------------------------------------------

interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  engine: string;
}

interface SearXNGResponse {
  results: SearXNGResult[];
}

/** Get SearXNG host from config or env. */
function getSearXNGOptions(): { host: string; timeout: number } {
  const raw = config().raw;
  const search = raw.search_engine as Record<string, unknown> | undefined;
  return {
    host: String(search?.searxng_host ?? process.env.SEARXNG_HOST ?? 'http://localhost:8080'),
    timeout: Number(search?.timeout ?? 10_000),
  };
}

async function searxngSearch(query: string): Promise<SearXNGResult[]> {
  const { host, timeout } = getSearXNGOptions();
  const url = `${host}/search?q=${encodeURIComponent(query)}&format=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[searxng] HTTP ${res.status} for query "${query}"`);
      return [];
    }
    const data = (await res.json()) as SearXNGResponse;
    return data.results ?? [];
  } catch (error) {
    console.warn(`[searxng] search failed for "${query}":`, (error as Error).message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// AI SDK Tools
// ---------------------------------------------------------------------------

export const WebSearchArgsSchema = z.object({
  query: z.string().describe('Search query string'),
});

export const webSearchTool = tool({
  description:
    'Search the web for information. Returns title, URL, and snippet for each result. Use this to gather external knowledge during research.',
  inputSchema: WebSearchArgsSchema,
  execute: async ({ query }: { query: string }) => {
    const results = await searxngSearch(query);
    return {
      query,
      num_results: results.length,
      results: results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        engine: r.engine,
      })),
    };
  },
});

export const AnalyzeResultsArgsSchema = z.object({
  summary: z.string().describe('Brief summary of findings so far'),
  coverage_estimate: z.number().min(0).max(1).describe('0.0-1.0 how well results cover the topic'),
  need_more: z.boolean().describe('Whether more searches are needed'),
  suggested_queries: z.array(z.string()).describe('Suggested follow-up search queries'),
});

export const analyzeResultsTool = tool({
  description: 'Analyze gathered search results and determine if more searches are needed.',
  inputSchema: AnalyzeResultsArgsSchema,
  execute: async (input: {
    summary: string;
    coverage_estimate: number;
    need_more: boolean;
    suggested_queries: string[];
  }) => input,
});

export const WriteReportArgsSchema = z.object({
  title: z.string().describe('Report title'),
  executive_summary: z.string().describe('2-3 sentence executive summary'),
  findings: z.string().describe('Detailed findings section'),
  conclusions: z.string().describe('Conclusions and recommendations'),
});

export const writeReportTool = tool({
  description:
    'Write the final research report. Include executive summary, methodology, findings, and conclusions.',
  inputSchema: WriteReportArgsSchema,
  execute: async (input: {
    title: string;
    executive_summary: string;
    findings: string;
    conclusions: string;
  }) => ({
    ...input,
    generated_at: new Date().toISOString(),
  }),
});

/** All research tools for the agent loop. */
export const researchTools = {
  webSearch: webSearchTool,
  analyzeResults: analyzeResultsTool,
  writeReport: writeReportTool,
};
