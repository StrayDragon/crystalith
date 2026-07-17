import { describe, expect, it } from 'vitest';

import { countUniqueCitationSources, formatCitationScopeLabel } from './citationLabels';

describe('citationLabels', () => {
  it('counts unique sources from camelCase Citation fields', () => {
    const citations = [
      { sourceId: 1, sourceTitle: 'a.md' },
      { sourceId: 1, sourceTitle: 'a.md' },
      { sourceId: 1, sourceTitle: 'a.md' },
    ];
    expect(countUniqueCitationSources(citations)).toBe(1);
    expect(formatCitationScopeLabel(1, 3)).toBe('来自 1 个来源 · 3 个片段');
  });

  it('counts distinct source ids', () => {
    const citations = [
      { sourceId: 1, sourceTitle: 'a.md' },
      { sourceId: 2, sourceTitle: 'b.md' },
    ];
    expect(countUniqueCitationSources(citations)).toBe(2);
    expect(formatCitationScopeLabel(2, 2)).toBe('来自 2 个来源 · 2 个片段');
  });

  it('falls back to snake_case API fields when present', () => {
    expect(
      countUniqueCitationSources([
        { source_id: 9, source_name: 'x.md' },
        { source_id: 9, source_name: 'x.md' },
      ]),
    ).toBe(1);
  });
});
