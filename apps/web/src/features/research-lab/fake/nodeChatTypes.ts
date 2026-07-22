import type { ResearchConclusionStatus } from '@crystalith/shared';

import type { LabNodeRole } from './types';

/**
 * Node-scoped chat ↔ graph mutation contract (product-shaped).
 *
 * Swap path when backend lands:
 *   Fake `proposeNodeChatTurn`  →  POST …/nodes/:id/chat (SSE)
 *   FE still only renders text + ActionProposal cards
 *   Accept → existing REST: prune / fork / confirm / patch node / set status
 *
 * Chat NEVER auto-mutates the graph. Proposals require explicit user accept
 * (same safety model as edge prune/fork dialogs and awaiting_confirm).
 */

/** Stable action kinds — map 1:1 onto Research Lab mutation ports / future HTTP. */
export type LabNodeActionKind =
  | 'prune_node'
  | 'fork_sibling'
  | 'rewrite_query'
  | 'set_status'
  | 'confirm_finish'
  | 'confirm_continue'
  | 'open_report';

export type LabNodeActionStatus = 'pending' | 'accepted' | 'dismissed';

export interface LabNodeActionProposal {
  id: string;
  kind: LabNodeActionKind;
  /** Button label */
  label: string;
  /** Short guidance shown on the card */
  rationale: string;
  status: LabNodeActionStatus;
  /** Kind-specific payload (wire-stable field names). */
  params?: {
    /** rewrite_query */
    query?: string;
    /** fork_sibling */
    title?: string;
    summary?: string;
    /** set_status */
    conclusionStatus?: ResearchConclusionStatus;
  };
}

/** One assistant turn after a user message (stream text, then optional proposals). */
export interface LabNodeChatTurn {
  assistantText: string;
  proposals: LabNodeActionProposal[];
}

export interface ProposeNodeChatTurnInput {
  nodeId: string;
  role: LabNodeRole;
  title: string;
  query?: string;
  userText: string;
  /** Run-level phase — enables confirm_* proposals only when relevant. */
  phase: string;
  reportAvailable?: boolean;
  conclusionStatus?: ResearchConclusionStatus;
}

/** Role → which action kinds the node session may surface. */
export const LAB_NODE_ACTION_CATALOG: Record<LabNodeRole, readonly LabNodeActionKind[]> = {
  question: ['rewrite_query', 'confirm_finish', 'confirm_continue'],
  research: ['prune_node', 'fork_sibling', 'rewrite_query', 'set_status'],
  conclusion: ['set_status', 'confirm_finish', 'confirm_continue', 'open_report'],
} as const;
