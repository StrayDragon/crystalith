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

describe('parseArxivId', () => {
  test('accepts abs URLs with optional version / hosts', () => {
    expect(parseArxivId('https://arxiv.org/abs/1706.03762')).toBe('1706.03762');
    expect(parseArxivId('http://arxiv.org/abs/2401.12345v2')).toBe('2401.12345v2');
    expect(parseArxivId('https://export.arxiv.org/abs/1706.03762')).toBe('1706.03762');
    expect(parseArxivId('https://arxiv.org/pdf/1706.03762')).toBeNull();
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
        return new Response(ATOM_FIXTURE, { status: 200 });
      }) as typeof globalThis.fetch,
    });
    const result = await impl.extract('https://arxiv.org/abs/1706.03762', {});
    expect(requestedUrl).toContain('export.arxiv.org/api/query?id_list=1706.03762');
    expect(result.title).toBe('Attention Is All You Need');
    expect(result.extractorUsed).toBe('arxiv');
    expect(result.publishedDate).toBe('2017-06-12T17:57:34Z');
    expect(result.content).toContain('- Authors: Ashish Vaswani, Noam Shazeer');
    expect(result.content).toContain('- Category: cs.CL');
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
