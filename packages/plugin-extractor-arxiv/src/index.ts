// @crystalith-plugin/extractor-arxiv — first exemplar external plugin.
//
// Extracts structured metadata + abstract markdown from arXiv abs pages via
// the stable export.arxiv.org Atom API (no API key, pure JS).
//
// Contract notes:
// - `isAvailable` is always true; host gating happens per-URL in `extract`:
//   non-arXiv URLs return empty content so the extractor chain falls through
//   to the next extractor (web-extractor-plugins orchestration semantics).
// - Outbound HTTP goes through `ctx.fetch` — the host transport that honors
//   the global proxy SSOT (proxy_settings + CL_PROXY_* overlay). Plugins must
//   not use global fetch directly.
import { z } from 'zod';

import type {
  CrystalithPlugin,
  CrystalithPluginContext,
} from '../../../apps/server/src/plugins/types.ts';
import type {
  ExtractedContent,
  Extractor,
} from '../../../apps/server/src/shared/extraction/types.ts';

const ARXIV_ABS_URL = /^https?:\/\/(?:www\.|export\.)?arxiv\.org\/abs\/([^\s?#]+?)\/?$/iu;
const ATOM_API = 'http://export.arxiv.org/api/query';

/** arXiv abs URL → id (e.g. '1706.03762' / '2401.12345v2'), or null. */
export function parseArxivId(url: string): string | null {
  const match = url.match(ARXIV_ABS_URL);
  return match ? match[1] : null;
}

function decodeXmlEntities(text: string): string {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function tagText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'iu'));
  return match ? decodeXmlEntities(match[1].trim()) : '';
}

interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  primaryCategory: string;
  pdfUrl: string | null;
}

function parseAtomEntry(xml: string): ArxivEntry | null {
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/iu);
  if (!entry) return null;
  const body = entry[1];
  const authors = [...body.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/giu)].map(
    (m) => decodeXmlEntities(m[1].trim()),
  );
  const pdfLink = body.match(/<link[^>]*type="application\/pdf"[^>]*href="([^"]+)"/iu);
  const category = body.match(/<arxiv:primary_category[^>]*term="([^"]+)"/iu);
  return {
    id: tagText(body, 'id'),
    title: tagText(body, 'title').replaceAll(/\s+/gu, ' '),
    summary: tagText(body, 'summary').replaceAll(/\s+/gu, ' '),
    authors,
    published: tagText(body, 'published'),
    updated: tagText(body, 'updated'),
    primaryCategory: category ? category[1] : '',
    pdfUrl: pdfLink ? pdfLink[1] : null,
  };
}

function entryToMarkdown(sourceUrl: string, entry: ArxivEntry): string {
  const meta: string[] = [];
  if (entry.authors.length > 0) meta.push(`- Authors: ${entry.authors.join(', ')}`);
  if (entry.published) meta.push(`- Published: ${entry.published.slice(0, 10)}`);
  if (entry.primaryCategory) meta.push(`- Category: ${entry.primaryCategory}`);
  if (entry.id) meta.push(`- arXiv: ${entry.id}`);
  if (entry.pdfUrl) meta.push(`- PDF: ${entry.pdfUrl}`);
  return [`# ${entry.title}`, '', ...meta, '', '## Abstract', '', entry.summary, ''].join('\n');
}

async function extract(ctx: CrystalithPluginContext, url: string): Promise<ExtractedContent> {
  const arxivId = parseArxivId(url);
  // Non-arXiv URL → empty content: the extractor chain falls through (r55).
  if (!arxivId) {
    return { title: url, content: '', extractorUsed: 'arxiv' };
  }

  const res = await ctx.fetch(`${ATOM_API}?id_list=${encodeURIComponent(arxivId)}&max_results=1`);
  if (!res.ok) {
    throw new Error(`arXiv API returned ${res.status}: ${res.statusText}`);
  }
  const entry = parseAtomEntry(await res.text());
  if (!entry || !entry.title) {
    throw new Error(`arXiv API returned no entry for '${arxivId}'`);
  }

  return {
    title: entry.title,
    content: entryToMarkdown(url, entry),
    description: entry.summary,
    publishedDate: entry.published || undefined,
    extractorUsed: 'arxiv',
  };
}

export const extractorArxiv: CrystalithPlugin = {
  id: 'extractor-arxiv',
  kind: 'extractor',
  displayName: 'arXiv',
  description: 'arXiv abs 页结构化抽取（Atom API，无需 key）',
  recoveryHint: '检查目标是否为 arxiv.org/abs/* 页面；网络问题请配置 CL_PROXY_* 或 proxy_settings',
  configSchema: z.object({}),
  capabilities: [],
  factory: async (ctx: CrystalithPluginContext): Promise<Extractor> => ({
    name: 'arxiv',
    isAvailable: () => true,
    extract: (url: string) => extract(ctx, url),
  }),
};

export default extractorArxiv;
