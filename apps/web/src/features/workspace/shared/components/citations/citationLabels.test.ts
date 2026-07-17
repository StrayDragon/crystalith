import { describe, expect, it } from 'vitest';

import { countUniqueCitationSources, formatCitationScopeLabel } from './citationLabels';

describe('citationLabels', () => {
  it('counts unique sources separately from chunk count', () => {
    const citations = [
      { source_id: 1, source_name: 'a.md' },
      { source_id: 1, source_name: 'a.md' },
      { source_id: 1, source_name: 'a.md' },
    ];
    expect(countUniqueCitationSources(citations)).toBe(1);
    expect(formatCitationScopeLabel(1, 3)).toBe('来自 1 个来源 · 3 个片段');
  });

  it('counts distinct source ids', () => {
    const citations = [
      { source_id: 1, source_name: 'a.md' },
      { source_id: 2, source_name: 'b.md' },
    ];
    expect(countUniqueCitationSources(citations)).toBe(2);
    expect(formatCitationScopeLabel(2, 2)).toBe('来自 2 个来源 · 2 个片段');
  });
});
