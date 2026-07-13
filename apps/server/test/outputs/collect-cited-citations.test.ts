// Unit tests for collectCitedCitations — the content-tree walker that collects
// the cited-subset of citations (v1 _collect_output_citations parity, P1-6).
// Verifies dedup by chunk_id, first-seen ordering, nested-tree traversal, and
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
              source_id: 7,
              source_name: 'doc.md',
              chunk_id: 42,
              chunk_index: 3,
              page_number: 2,
              paragraph_index: null,
              snippet: 'Y is defined here.',
              score: 0.81,
            },
          ],
        },
      ],
    };
    const result = collectCitedCitations(content);
    expect(result).toHaveLength(1);
    expect(result[0].chunk_id).toBe(42);
    expect(result[0].source_name).toBe('doc.md');
  });

  it('deduplicates by chunk_id across multiple leaf nodes (first-seen order)', () => {
    const content = {
      items: [
        {
          citations: [
            { source_id: 1, source_name: 'a', chunk_id: 10, chunk_index: 1, snippet: 's1' },
          ],
        },
        {
          citations: [
            { source_id: 2, source_name: 'b', chunk_id: 20, chunk_index: 2, snippet: 's2' },
          ],
        },
        {
          citations: [
            { source_id: 1, source_name: 'a', chunk_id: 10, chunk_index: 1, snippet: 's1 dup' },
          ],
        },
      ],
    };
    const result = collectCitedCitations(content);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.chunk_id)).toEqual([10, 20]);
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
                    { source_id: 5, source_name: 'n', chunk_id: 50, chunk_index: 5, snippet: 'x' },
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
            citations: [
              { source_id: 6, source_name: 'm', chunk_id: 60, chunk_index: 6, snippet: 'y' },
            ],
          },
        ],
      },
    };
    const result = collectCitedCitations(content);
    expect(result.map((c) => c.chunk_id).sort((a, b) => a - b)).toEqual([50, 60]);
  });

  it('preserves page_number and paragraph_index fields for markdown export', () => {
    const content = {
      points: [
        {
          citations: [
            {
              source_id: 1,
              source_name: 'doc',
              chunk_id: 1,
              chunk_index: 1,
              page_number: 4,
              paragraph_index: 7,
              snippet: 'page-para info',
            },
          ],
        },
      ],
    };
    const result = collectCitedCitations(content);
    expect(result[0].page_number).toBe(4);
    expect(result[0].paragraph_index).toBe(7);
  });

  it('ignores malformed citation entries (non-object / missing chunk_id)', () => {
    const content = {
      points: [
        {
          citations: [
            'not-an-object',
            { source_id: 1, source_name: 'n' /* no chunk_id */ },
            null,
            42,
          ],
        },
      ],
    };
    expect(collectCitedCitations(content)).toEqual([]);
  });
});
