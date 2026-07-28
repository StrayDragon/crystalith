// fetchPage tool — ExtractorFactory chain (readability → jina → firecrawl).
// Used by Deep Research work_unit / node_chat (c107). No second crawler.
import { tool } from 'ai';
import { z } from 'zod';

import { config } from '../../shared/config.ts';
import { extractUrl, ExtractionError } from '../../shared/extraction/factory.ts';

export const FetchPageArgs = z.object({
  url: z.string().url().describe('Absolute URL of the page to fetch and extract.'),
});

export type FetchPageArgs = z.infer<typeof FetchPageArgs>;

export type FetchPageResult =
  | { ok: true; url: string; title: string; content: string }
  | { ok: false; url: string; error: string };

/**
 * Extract page body via ExtractorFactory. Never throws to the agent loop —
 * failures return `{ ok: false }` so the work-unit can continue with SERP snippets.
 */
export async function fetchPageContent(url: string): Promise<FetchPageResult> {
  try {
    // Pass full raw config (extraction keys + source_ingestion) like other call sites.
    const extracted = await extractUrl(url, config().raw);
    return {
      ok: true,
      url,
      title: extracted.title?.trim() || url,
      content: extracted.content,
    };
  } catch (error) {
    const message =
      error instanceof ExtractionError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return { ok: false, url, error: message };
  }
}

/** Build a fetchPage tool bound to ExtractorFactory. */
export function fetchPageTool() {
  return tool({
    description:
      'Fetch and extract the main text of a web page by URL (readability → jina → firecrawl). Prefer after webSearch when a hit looks worth reading. On failure, keep using the SERP snippet.',
    inputSchema: FetchPageArgs,
    execute: async ({ url }): Promise<FetchPageResult> => fetchPageContent(url),
  });
}
