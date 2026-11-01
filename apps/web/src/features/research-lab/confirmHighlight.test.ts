// covers: r107（deep-research-ui）——M1 确认高亮集合含分支节点及其直接邻居。
import { describe, expect, it } from '@rstest/core';

import { confirmHighlightIds } from './confirmHighlight';

describe('confirmHighlightIds)', () => {
  it('includes branch and direct neighbors', () => {
    expect(
      confirmHighlightIds('b', [
        { source: 'q', target: 'b' },
        { source: 'b', target: 'c' },
        { source: 'q', target: 'other' },
      ]).sort(),
    ).toEqual(['b', 'c', 'q']);
  });

  it('returns empty when no branch id', () => {
    expect(confirmHighlightIds(null, [{ source: 'a', target: 'b' }])).toEqual([]);
  });
});
