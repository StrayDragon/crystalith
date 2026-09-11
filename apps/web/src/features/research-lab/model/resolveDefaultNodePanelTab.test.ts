import { describe, expect, it } from '@rstest/core';

import { resolveDefaultNodePanelTab } from './resolveDefaultNodePanelTab';
import type { LabNode } from './types';

function node(partial: Partial<LabNode> & Pick<LabNode, 'conclusionStatus'>): LabNode {
  return {
    id: 'n',
    title: 't',
    citationIds: [],
    ...partial,
  };
}

describe('resolveDefaultNodePanelTab', () => {
  it('pending → meta (not chat)', () => {
    expect(resolveDefaultNodePanelTab(node({ conclusionStatus: 'pending' }))).toBe('meta');
  });

  it('retrieving/synthesizing → meta even if status already set', () => {
    expect(
      resolveDefaultNodePanelTab(node({ conclusionStatus: 'clear', phase: 'retrieving' })),
    ).toBe('meta');
    expect(
      resolveDefaultNodePanelTab(node({ conclusionStatus: 'partial', phase: 'synthesizing' })),
    ).toBe('meta');
  });

  it('settled statuses → chat', () => {
    for (const status of ['clear', 'partial', 'missing', 'pruned'] as const) {
      expect(resolveDefaultNodePanelTab(node({ conclusionStatus: status, phase: 'idle' }))).toBe(
        'chat',
      );
    }
  });
});
