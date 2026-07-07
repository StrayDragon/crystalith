// PDF parser using unpdf (pdf.js based, MIT license).
// Extracts text per page with page metadata.
import { extractText, getDocumentProxy } from 'unpdf';

import type { Parser, ParseResult } from '../parser-registry';

export const pdfParser: Parser = {
  id: 'pdf',
  name: 'PDF Parser',
  mimeTypes: ['application/pdf'],
  extensions: ['.pdf'],
  async parse(buf: Uint8Array, _filename?: string): Promise<ParseResult> {
    const pdf = await getDocumentProxy(buf);
    const { text: pages } = await extractText(pdf, { mergePages: false });

    const typedPages = (pages as unknown as string[]).map((pageText, i) => ({
      text: String(pageText),
      metadata: { page: i + 1 },
    }));

    const fullText = typedPages.map((p) => p.text).join('\n\n');
    return {
      text: fullText,
      pages: typedPages,
      metadata: { page_count: typedPages.length },
    };
  },
};
