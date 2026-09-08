// extractor-arxiv exemplar plugin — host gating, Atom parsing, registry discovery.
import { beforeAll, describe, expect, test } from 'bun:test';

import extractorArxiv, { parseArxivId } from '@crystalith-plugin/extractor-arxiv';

import { pluginRegistry } from '../../src/plugins/registry.ts';

const ATOM_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/1706.03762v7</id>
    <updated>2023-08-02T16:XX:XXZ</updated>
    <published>2017-06-12T17:57:34Z</published>
    <title>Attention Is All You Need</title>
    <summary>  The dominant sequence transduction models are based on
    complex recurrent or convolutional neural networks. </summary>
    <author><name>Ashish Vaswani</name></author>
    <author><name>Noam Shazeer</name></author>
    <arxiv:primary_category term="cs.CL" />
    <link href="http://arxiv.org/pdf/1706.03762v7" type="application/pdf" />
  </entry>
</feed>`;

function stubFetch(body: string, status = 200) {
  return (async () => new Response(body, { status })) as typeof globalThis.fetch;
}

/** Minimal single-page PDF with correct xref offsets (enough for pdf.js). */
function buildMinimalPdf(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<</Type /Catalog /Pages 2 0 R>>',
    '<</Type /Pages /Kids [3 0 R] /Count 1>>',
    '<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 5 0 R>>>> /Contents 4 0 R>>',
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
    '<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  const size = objects.length + 1;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `${xref}trailer\n<</Size ${size} /Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

describe('parseArxivId', () => {
  test('accepts abs URLs with optional version / hosts', () => {
    expect(parseArxivId('https://arxiv.org/abs/1706.03762')).toBe('1706.03762');
    expect(parseArxivId('http://arxiv.org/abs/2401.12345v2')).toBe('2401.12345v2');
    expect(parseArxivId('https://export.arxiv.org/abs/1706.03762')).toBe('1706.03762');
    expect(parseArxivId('https://arxiv.org/pdf/1706.03762')).toBe('1706.03762');
    expect(parseArxivId('https://export.arxiv.org/pdf/2401.12345v2')).toBe('2401.12345v2');
    expect(parseArxivId('https://example.com')).toBeNull();
  });
});

describe('extractor-arxiv behavior', () => {
  test('non-arxiv URL returns empty content (chain falls through)', async () => {
    const impl = await extractorArxiv.factory({
      config: {},
      dataRoot: '/tmp',
      fetch: stubFetch(ATOM_FIXTURE),
    });
    const result = await impl.extract('https://example.com/post', {});
    expect(result.content).toBe('');
    expect(result.extractorUsed).toBe('arxiv');
  });

  test('abs URL → structured markdown via Atom API', async () => {
    let requestedUrl = '';
    const impl = await extractorArxiv.factory({
      config: {},
      dataRoot: '/tmp',
      fetch: (async (input: RequestInfo | URL) => {
        requestedUrl = String(input);
        // PDF endpoint unreachable in this test → degrade to abstract-only.
        return new Response(requestedUrl.includes('/pdf/') ? '' : ATOM_FIXTURE, {
          status: requestedUrl.includes('/pdf/') ? 404 : 200,
        });
      }) as typeof globalThis.fetch,
    });
    const result = await impl.extract('https://arxiv.org/abs/1706.03762', {});
    expect(requestedUrl).toContain('arxiv.org/pdf/1706.03762');
    expect(result.title).toBe('Attention Is All You Need');
    expect(result.extractorUsed).toBe('arxiv');
    expect(result.publishedDate).toBe('2017-06-12T17:57:34Z');
    expect(result.content).toContain('- Authors: Ashish Vaswani, Noam Shazeer');
    expect(result.content).toContain('- Category: cs.CL');
    expect(result.content).toContain('## Abstract');
    expect(result.content).not.toContain('## Full Text');
  });

  test('full paper text: PDF fetched, parsed and appended; failure degrades', async () => {
    const impl = await extractorArxiv.factory({
      config: {},
      dataRoot: '/tmp',
      fetch: (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/pdf/')) {
          return new Response(buildMinimalPdf('Hello arXiv full text fixture'), {
            status: 200,
            headers: { 'Content-Type': 'application/pdf' },
          });
        }
        return new Response(ATOM_FIXTURE, { status: 200 });
      }) as typeof globalThis.fetch,
    });
    const result = await impl.extract('https://arxiv.org/abs/1706.03762', {});
    expect(result.content).toContain('## Full Text');
    expect(result.content).toContain('Hello arXiv full text fixture');
    expect(result.content).toContain('## Abstract');
  });

  test('API error surfaces as thrown failure (orchestration records it)', async () => {
    const impl = await extractorArxiv.factory({
      config: {},
      dataRoot: '/tmp',
      fetch: stubFetch('oops', 500),
    });
    expect(impl.extract('https://arxiv.org/abs/1706.03762', {})).rejects.toThrow(
      /arXiv API returned 500/,
    );
  });
});

describe('registry discovery (workspace symlink)', () => {
  beforeAll(async () => {
    await pluginRegistry.ensureLoaded();
  });

  test('extractor-arxiv is discovered from node_modules scope and loaded', () => {
    expect(pluginRegistry.isLoaded('extractor-arxiv')).toBeTrue();
    const impl = pluginRegistry.implOf<{ extract: (u: string) => Promise<unknown> }>(
      'extractor-arxiv',
    );
    expect(typeof impl?.extract).toBe('function');
  });
});
