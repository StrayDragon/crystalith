// Unit tests for collectCitedCitations — the content-tree walker that collects
// the cited-subset of citations (v1 _collect_output_citations parity, P1-6).
// Verifies dedup by chunkId, first-seen ordering, nested-tree traversal, and
// that non-cited chunks from the retrieval superset are excluded.
import { describe, expect, it } from 'bun:test';

import { collectCitedCitations } from '../../src/features/outputs/router.ts';

describe('collectCitedCitations — cited-subset walker', () => {
  it('returns [] for null content', () => {
    expect(collectCitedCitations(null)).toEqual([]);
  });

  it('returns [] when no citations are embedded', () => {
    expect(collectCitedCitations({ items: [{ q: 'q', a: 'a' }] })).toEqual([]);
  });

  it('collects a single citation embedded on a leaf node', () => {
    const content = {
      items: [
        {
          q: 'What is X?',
          a: 'It is Y.',
          citations: [
            {
              sourceId: 7,
              sourceName: 'doc.md',
              chunkId: 42,
              chunkIndex: 3,
              pageNumber: 2,
              paragraphIndex: null,
              snippet: 'Y is defined here.',
              score: 0.81,
            },
          ],
        },
      ],
    };
    const result = collectCitedCitations(content);
    expect(result).toHaveLength(1);
    expect(result[0].chunkId).toBe(42);
    expect(result[0].sourceName).toBe('doc.md');
  });

  it('deduplicates by chunkId across multiple leaf nodes (first-seen order)', () => {
    const content = {
      items: [
        {
          citations: [{ sourceId: 1, sourceName: 'a', chunkId: 10, chunkIndex: 1, snippet: 's1' }],
        },
        {
          citations: [{ sourceId: 2, sourceName: 'b', chunkId: 20, chunkIndex: 2, snippet: 's2' }],
        },
        {
          citations: [
            { sourceId: 1, sourceName: 'a', chunkId: 10, chunkIndex: 1, snippet: 's1 dup' },
          ],
        },
      ],
    };
    const result = collectCitedCitations(content);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.chunkId)).toEqual([10, 20]);
  });

  it('traverses nested arrays and objects of arbitrary depth', () => {
    const content = {
      sections: [
        {
          subsections: [
            {
              points: [
                {
                  text: 'p1',
                  citations: [
                    { sourceId: 5, sourceName: 'n', chunkId: 50, chunkIndex: 5, snippet: 'x' },
                  ],
                },
              ],
            },
          ],
        },
      ],
      timeline: {
        events: [
          {
            date: '2026',
            event: 'e',
            citations: [{ sourceId: 6, sourceName: 'm', chunkId: 60, chunkIndex: 6, snippet: 'y' }],
          },
        ],
      },
    };
    const result = collectCitedCitations(content);
    expect(result.map((c) => c.chunkId).sort((a, b) => a - b)).toEqual([50, 60]);
  });

  it('preserves pageNumber and paragraphIndex fields for markdown export', () => {
    const content = {
      points: [
        {
          citations: [
            {
              sourceId: 1,
              sourceName: 'doc',
              chunkId: 1,
              chunkIndex: 1,
              pageNumber: 4,
              paragraphIndex: 7,
              snippet: 'page-para info',
            },
          ],
        },
      ],
    };
    const result = collectCitedCitations(content);
    expect(result[0].pageNumber).toBe(4);
    expect(result[0].paragraphIndex).toBe(7);
  });

  it('ignores malformed citation entries (non-object / missing chunkId)', () => {
    const content = {
      points: [
        {
          citations: ['not-an-object', { sourceId: 1, sourceName: 'n' /* no chunkId */ }, null, 42],
        },
      ],
    };
    expect(collectCitedCitations(content)).toEqual([]);
  });
});
