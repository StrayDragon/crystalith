import { describe, expect, it } from 'vitest';

import type { Citation } from '../../types';
import { countUniqueCitationSources, formatCitationScopeLabel } from './citationLabels';

function cite(partial: Partial<Citation> & Pick<Citation, 'sourceName'>): Citation {
  return {
    id: partial.id ?? '1',
    chunkId: partial.chunkId ?? 1,
    sourceId: partial.sourceId ?? null,
    sourceName: partial.sourceName,
    snippet: partial.snippet ?? '',
    chunkIndex: partial.chunkIndex ?? 0,
    pageNumber: partial.pageNumber ?? null,
    paragraphIndex: partial.paragraphIndex ?? null,
  };
}

describe('citationLabels', () => {
  it('counts unique sources from camelCase Citation fields', () => {
    const citations = [
      cite({ sourceId: 1, sourceName: 'a.md', chunkId: 10 }),
      cite({ sourceId: 1, sourceName: 'a.md', chunkId: 11 }),
      cite({ sourceId: 1, sourceName: 'a.md', chunkId: 12 }),
    ];
    expect(countUniqueCitationSources(citations)).toBe(1);
    expect(formatCitationScopeLabel(1, 3)).toBe('来自 1 个来源 · 3 个片段');
  });

  it('counts distinct source ids', () => {
    const citations = [
      cite({ sourceId: 1, sourceName: 'a.md' }),
      cite({ sourceId: 2, sourceName: 'b.md' }),
    ];
    expect(countUniqueCitationSources(citations)).toBe(2);
    expect(formatCitationScopeLabel(2, 2)).toBe('来自 2 个来源 · 2 个片段');
  });

  it('falls back to sourceName when sourceId is missing', () => {
    expect(
      countUniqueCitationSources([
        cite({ sourceId: null, sourceName: 'same.md' }),
        cite({ sourceId: null, sourceName: 'same.md' }),
      ]),
    ).toBe(1);
  });
});
