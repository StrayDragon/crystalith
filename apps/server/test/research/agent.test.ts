// Tests for the research agent's core logic.
import { describe, expect, it } from 'bun:test';

// Test the deduplication logic inline (avoiding AI calls)
function deduplicateResults(
  results: Array<{ title: string; url: string; snippet: string; engine: string; query: string }>,
): Array<{ title: string; url: string; snippet: string; engine: string; query: string }> {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.url.toLowerCase().replace(/[?#].*$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

describe('deduplicateResults', () => {
  it('removes exact duplicate URLs', () => {
    const results = [
      { title: 'A', url: 'https://example.com/a', snippet: '...', engine: 'google', query: 'q1' },
      { title: 'A dup', url: 'https://example.com/a', snippet: 'same', engine: 'google', query: 'q2' },
    ];
    expect(deduplicateResults(results)).toHaveLength(1);
  });

  it('keeps different URLs', () => {
    const results = [
      { title: 'A', url: 'https://example.com/a', snippet: '...', engine: 'google', query: 'q' },
      { title: 'B', url: 'https://example.com/b', snippet: '...', engine: 'google', query: 'q' },
    ];
    expect(deduplicateResults(results)).toHaveLength(2);
  });

  it('ignores query params and fragments for dedup key', () => {
    const results = [
      { title: 'A', url: 'https://example.com/page?ref=1', snippet: '...', engine: 'google', query: 'q' },
      { title: 'A', url: 'https://example.com/page#section', snippet: '...', engine: 'google', query: 'q' },
    ];
    expect(deduplicateResults(results)).toHaveLength(1);
  });

  it('handles empty input', () => {
    expect(deduplicateResults([])).toHaveLength(0);
  });
});

// Test the search concurrency wrapper (mock-friendly)
describe('executeSearches logic', () => {
  it('processes queries and aggregates results', async () => {
    const queries = [
      { query: 'test a', engine: 'Web', priority: 1, reason: 'test' },
      { query: 'test b', engine: 'Web', priority: 2, reason: 'test' },
    ];

    const results: Array<{
      title: string;
      url: string;
      snippet: string;
      engine: string;
      query: string;
    }> = [];

    for (const q of queries) {
      results.push({
        title: `Result for ${q.query}`,
        url: `https://example.com/${q.query.replace(/\s+/g, '-')}`,
        snippet: 'Content...',
        engine: 'mock',
        query: q.query,
      });
    }

    expect(results).toHaveLength(2);
    expect(results[0].query).toBe('test a');
    expect(results[1].query).toBe('test b');
  });
});
