// Plain text parser — pass-through, just decodes UTF-8 bytes.
import type { Parser, ParseResult } from '../parser-registry.ts';

export const textParser: Parser = {
  id: 'text',
  name: 'Plain Text Parser',
  mimeTypes: ['text/plain', 'text/markdown', 'text/csv', 'application/json'],
  extensions: ['.txt', '.md', '.csv', '.json', '.xml'],
  async parse(buf: Uint8Array, _filename?: string): Promise<ParseResult> {
    const text = new TextDecoder().decode(buf);
    return { text };
  },
};
