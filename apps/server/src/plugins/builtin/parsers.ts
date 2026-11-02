// Built-in parser plugins (kind: 'parser'). Wraps the four core parsers
// previously registered by pipeline import-time registerParser — behavior
// unchanged, registration now goes through the plugin registry (r16/r496).
// Wire parserType keeps v1/v2 values ('pdf' | 'html' | 'csv' | 'text'):
// derived from the plugin id by stripping the `parser-` prefix.
import { z } from 'zod';

import type { Parser } from '../../features/sources/parser-registry.ts';
import { csvParser } from '../../features/sources/parsers/csv.ts';
import { htmlParser } from '../../features/sources/parsers/html.ts';
import { pdfParser } from '../../features/sources/parsers/pdf.ts';
import { textParser } from '../../features/sources/parsers/text.ts';
import type { CrystalithPlugin } from '../types.ts';

const NO_CONFIG = z.object({}) as z.ZodObject;

interface ParserPluginOpts {
  id: string;
  displayName: string;
  description: string;
  parser: Parser;
}

function parserPlugin(opts: ParserPluginOpts): CrystalithPlugin {
  return {
    id: opts.id,
    kind: 'parser',
    displayName: opts.displayName,
    description: opts.description,
    configSchema: NO_CONFIG,
    capabilities: [],
    factory: async () => opts.parser,
  };
}

/** Registration order matches the former pipeline bootstrap (pdf → html → csv → text). */
export const parserPlugins: CrystalithPlugin[] = [
  parserPlugin({
    id: 'parser-pdf',
    displayName: 'PDF (built-in)',
    description: '基于 unpdf 的本地 PDF 解析，按页抽出正文',
    parser: pdfParser,
  }),
  parserPlugin({
    id: 'parser-html',
    displayName: 'HTML (built-in)',
    description: '基于 cheerio + Readability 的 HTML 正文解析',
    parser: htmlParser,
  }),
  parserPlugin({
    id: 'parser-csv',
    displayName: 'CSV (built-in)',
    description: 'CSV 解析为 markdown 表格分块，带行号元数据',
    parser: csvParser,
  }),
  parserPlugin({
    id: 'parser-text',
    displayName: 'Plain Text (built-in)',
    description: '纯文本 / Markdown / JSON 透传解码',
    parser: textParser,
  }),
];
