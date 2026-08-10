import type { LabNode } from './types';

export type LabNodePanelTab = 'chat' | 'meta';

/**
 * Default drawer tab at the moment of node selection.
 * Non-final → meta (status / cites / query); settled → chat for follow-up tools.
 */
export function resolveDefaultNodePanelTab(node: LabNode): LabNodePanelTab {
  if (node.phase === 'retrieving' || node.phase === 'synthesizing') return 'meta';
  if (node.conclusionStatus === 'pending') return 'meta';
  // clear | partial | missing | pruned
  return 'chat';
}
