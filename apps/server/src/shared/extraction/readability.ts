// Readability extractor — local content extraction via @mozilla/readability + cheerio.
// Replaces v1's trafilatura (C/Python, no JS equivalent). Used as the first
// fallback extractor because it requires zero API keys.
//
// Extracts: title, content (markdown-like cleaned text), and optional meta
// tags for author, date, language.
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';

import { getSecurityPolicy } from '../config.ts';
import { fetchWithRedirectGuard } from '../net/fetch-with-redirect-guard.ts';
import type { ExtractedContent, Extractor } from './types.ts';

export const readabilityExtractor: Extractor = {
  name: 'readability',

  isAvailable(): boolean {
    return true; // always available — local, no API key needed
  },

  async extract(url: string, _config: unknown): Promise<ExtractedContent> {
    // P0-3: fetch directly on this process, so walk redirects with SSRF guard
    // (validates the initial URL and every redirect hop). Jina/Firecrawl fetch
    // on their own infra and do not need this.
    const res = await fetchWithRedirectGuard(url, getSecurityPolicy());
    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    }
    const html = await res.text();

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    // Extract meta tags with cheerio.
    const $ = cheerio.load(html);
    const author =
      $('meta[name="author"]').attr('content') ??
      $('meta[property="article:author"]').attr('content');
    const publishedDate =
      $('meta[name="date"]').attr('content') ??
      $('meta[property="article:published_time"]').attr('content');
    const description =
      $('meta[name="description"]').attr('content') ??
      $('meta[property="og:description"]').attr('content');
    const language = $('html').attr('lang') ?? $('meta[name="language"]').attr('content');

    return {
      title: article?.title ?? url,
      content: article?.textContent ?? '',
      author: author ?? undefined,
      publishedDate: publishedDate ?? undefined,
      description: description ?? undefined,
      language: language ?? undefined,
      extractorUsed: 'readability',
    };
  },
};
