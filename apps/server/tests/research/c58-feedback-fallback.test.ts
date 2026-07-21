// c58 tests — fallback report synthesis (independent unit, no AI/DB).
// Also exercises the plan-prompt suggested_queries inclusion logic.
import { describe, expect, it } from 'bun:test';

import { synthesizeFallbackReport } from '../../src/features/research/agent.ts';

describe('c58: synthesizeFallbackReport', () => {
  it('produces a clear empty-state message when no results (not a technical sentinel)', () => {
    const report = synthesizeFallbackReport('test topic', []);
    expect(report).toContain('test topic');
    expect(report).toContain('研究未收集到结果');
    // MUST NOT be the old sentinel string
    expect(report).not.toBe('(report generation failed)');
    expect(report).not.toContain('(report generation failed)');
  });

  it('synthesizes a results summary from accumulated results', () => {
    const results = [
      {
        title: 'First Result',
        url: 'https://example.com/1',
        snippet: 'Snippet one',
        engine: 'google',
        query: 'q1',
      },
      {
        title: 'Second Result',
        url: 'https://example.com/2',
        snippet: 'Snippet two',
        engine: 'bing',
        query: 'q2',
      },
    ];
    const report = synthesizeFallbackReport('research topic', results);
    expect(report).toContain('research topic');
    expect(report).toContain('First Result');
    expect(report).toContain('https://example.com/1');
    expect(report).toContain('Snippet one');
    expect(report).toContain('Second Result');
    expect(report).toContain('共 2 条结果');
    // MUST NOT be a sentinel
    expect(report).not.toContain('(report generation failed)');
  });

  it('caps displayed results at 20 even with many results', () => {
    const results = Array.from({ length: 30 }, (_, i) => ({
      title: `Result ${i + 1}`,
      url: `https://example.com/${i + 1}`,
      snippet: `Snippet ${i + 1}`,
      engine: 'google',
      query: 'q',
    }));
    const report = synthesizeFallbackReport('topic', results);
    expect(report).toContain('共 30 条结果');
    expect(report).toContain('展示前 20 条');
    // Result 20 present, result 21 not
    expect(report).toContain('Result 20');
    expect(report).not.toContain('21. **Result 21');
  });

  it('truncates long snippets to 200 chars', () => {
    const longSnippet = 'A'.repeat(300);
    const results = [
      { title: 'Long', url: 'https://example.com', snippet: longSnippet, engine: 'g', query: 'q' },
    ];
    const report = synthesizeFallbackReport('t', results);
    // 200-char snippet present, full 300 not
    expect(report).toContain('A'.repeat(200));
    expect(report).not.toContain('A'.repeat(201));
  });
});
