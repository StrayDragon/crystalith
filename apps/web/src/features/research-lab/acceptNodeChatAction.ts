import type { ResearchConclusionStatus } from '@crystalith/shared';
import { RESEARCH_TERMINAL_STATUSES } from '@crystalith/shared';

import { formatStatusChangeNote, mockEnrichAfterStatus } from './model/mockNodeEnrichment';
/**
 * Map a confirmed ActionProposal onto Lab mutation ports / Eden command HTTP.
 * Aligns r417 / r439 — never silent local-only graph authority in Eden mode.
 */
import type { LabNodeActionProposal } from './model/nodeChatTypes';
import { findInboundEdgeForNode } from './model/proposeNodeChatTurn';
import type { LabEdge, LabNode } from './model/types';

const TERMINAL_RUN_STATUSES = new Set<string>(RESEARCH_TERMINAL_STATUSES);
// r105：终态 Run 只读——结构/意图提案与 confirm 类提案（finish/continue 在终态
// 必然被服务端 RESEARCH_INVALID_STATE 拒绝）一律在执行前闸掉。
const READONLY_PROPOSAL_KINDS = new Set([
  'prune_node',
  'fork_sibling',
  'rewrite_query',
  'set_status',
  'confirm_finish',
  'confirm_continue',
]);

/** rewrite_query：question/root 改意图，其余改查询（PATCH seam）。 */
function applyRewriteQuery(input: AcceptNodeChatActionInput, node: LabNode): boolean {
  const q = input.proposal.params?.query?.trim();
  if (!q) return false;
  if (node.role === 'question' || node.id === 'root') {
    input.lab.setTopicDraft(q);
    input.lab.editNode(node.id, { query: q, conclusion: q });
  } else {
    input.lab.editNode(node.id, { query: q });
  }
  return true;
}

function editNodeStatus(
  input: AcceptNodeChatActionInput,
  node: LabNode,
  status: ResearchConclusionStatus | undefined,
): ResearchConclusionStatus | null {
  if (!status || status === 'pruned') return null;
  if (input.mode === 'eden') {
    input.lab.editNode(node.id, { conclusionStatus: status });
    return status;
  }
  // fixture：mock enrich（r417 语义）。
  input.lab.editNode(node.id, mockEnrichAfterStatus(node, status));
  return status;
}

/** set_status：eden 直 PATCH；fixture 走 mock enrich（r417 语义）。 */
function applySetStatus(input: AcceptNodeChatActionInput, node: LabNode): boolean {
  const next = editNodeStatus(input, node, input.proposal.params?.conclusionStatus);
  if (next === null) return false;
  input.onStatusNote?.(formatStatusChangeNote(node.title, node.conclusionStatus, next));
  return true;
}

/** r105：终态 Run 只读——剪枝/fork/改查询/定态不再继续发命令口（chat 提案与徽章同闸）。 */
function blockedInTerminalRun(
  mode: 'fixture' | 'eden',
  runStatus: string | null | undefined,
  kind: LabNodeActionProposal['kind'],
): boolean {
  return (
    mode === 'eden' &&
    TERMINAL_RUN_STATUSES.has(runStatus ?? '') &&
    READONLY_PROPOSAL_KINDS.has(kind)
  );
}

export type AcceptNodeChatLabPorts = {
  pruneAlongEdge: (edgeId: string) => void;
  forkAlongEdge: (
    edgeId: string,
    draft: { title: string; query?: string; summary?: string },
  ) => void;
  editNode: (nodeId: string, patch: Partial<LabNode>) => void;
  setTopicDraft: (topic: string) => void;
  finishReport: () => void;
  continueDig: () => void;
  addBudget: () => void;
  setConfirmChoice: (choice: string | null) => void;
  /** When set, confirm_continue routes to addBudget if not awaiting budget confirm. */
  runStatus?: string | null;
  confirmKind?: string | null;
};

export type AcceptNodeChatActionInput = {
  proposal: LabNodeActionProposal;
  node: LabNode;
  edges: LabEdge[];
  nodes: LabNode[];
  mode: 'fixture' | 'eden';
  lab: AcceptNodeChatLabPorts;
  openReport: () => void;
  /** Optional toast/info hook (fixture status note). */
  onStatusNote?: (message: string) => void;
};

export function acceptNodeChatAction(input: AcceptNodeChatActionInput): boolean {
  const { proposal, node, edges, nodes, mode, lab, openReport } = input;
  if (blockedInTerminalRun(mode, lab.runStatus, proposal.kind)) return false;

  switch (proposal.kind) {
    case 'prune_node': {
      const edge = findInboundEdgeForNode(node.id, edges, nodes);
      if (!edge) return false;
      lab.pruneAlongEdge(edge.id);
      return true;
    }
    case 'fork_sibling': {
      const edge = findInboundEdgeForNode(node.id, edges, nodes);
      if (!edge) return false;
      lab.forkAlongEdge(edge.id, {
        title: proposal.params?.title ?? `对照：${node.title}`,
        query: proposal.params?.query ?? node.query,
        summary: proposal.params?.summary,
      });
      return true;
    }
    case 'rewrite_query':
      return applyRewriteQuery(input, node);
    case 'set_status':
      return applySetStatus(input, node);
    case 'confirm_finish': {
      lab.finishReport();
      lab.setConfirmChoice('finish_report');
      return true;
    }
    case 'confirm_continue': {
      // c108: awaiting budget confirm → continue (+K resume); otherwise proactive add-budget
      const awaitingBudget =
        lab.runStatus === 'awaiting_confirm' &&
        (lab.confirmKind === 'budget' || lab.confirmKind === null);
      if (awaitingBudget) {
        lab.continueDig();
        lab.setConfirmChoice('continue_dig');
      } else {
        lab.addBudget();
        lab.setConfirmChoice('add_budget');
      }
      return true;
    }
    case 'open_report': {
      openReport();
      return true;
    }
    default:
      return false;
  }
}
