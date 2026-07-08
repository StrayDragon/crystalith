import { Readability } from '@mozilla/readability';
// HTML parser using cheerio + @mozilla/readability.
// Extracts main content from HTML documents for clean text extraction.
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';

import type { Parser, ParseResult } from '../parser-registry';

export const htmlParser: Parser = {
  id: 'html',
  name: 'HTML Parser',
  mimeTypes: ['text/html'],
  extensions: ['.html', '.htm'],
  async parse(buf: Uint8Array, _filename?: string): Promise<ParseResult> {
    const html = new TextDecoder().decode(buf);

    // Try readability first for article extraction
    const dom = new JSDOM(html);
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    let text: string;
    if (article?.textContent) {
      text = article.textContent;
    } else {
      // Fallback to cheerio body text
      const $ = cheerio.load(html);
      text = $('body').text().replaceAll(/\s+/g, ' ').trim();
    }

    return {
      text,
      metadata: {
        title: article?.title ?? undefined,
      },
    };
  },
};
