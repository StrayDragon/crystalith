import {
  formatStatusChangeNote,
  mockEnrichAfterStatus,
} from '../research-lab-demo/fake/mockNodeEnrichment';
/**
 * Map a confirmed ActionProposal onto Lab mutation ports / Eden command HTTP.
 * Aligns r417 / r439 — never silent local-only graph authority in Eden mode.
 */
import type { LabNodeActionProposal } from '../research-lab-demo/fake/nodeChatTypes';
import { findInboundEdgeForNode } from '../research-lab-demo/fake/proposeNodeChatTurn';
import type { LabEdge, LabNode } from '../research-lab-demo/fake/types';

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
  setConfirmChoice: (choice: string | null) => void;
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
  const { proposal, node, edges, nodes, mode, lab, openReport, onStatusNote } = input;

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
    case 'rewrite_query': {
      const q = proposal.params?.query?.trim();
      if (!q) return false;
      if (node.role === 'question' || node.id === 'root') {
        lab.setTopicDraft(q);
        lab.editNode(node.id, { query: q, conclusion: q });
      } else {
        lab.editNode(node.id, { query: q });
      }
      return true;
    }
    case 'set_status': {
      const status = proposal.params?.conclusionStatus;
      if (!status || status === 'pruned') return false;
      if (mode === 'eden') {
        lab.editNode(node.id, { conclusionStatus: status });
      } else {
        const enriched = mockEnrichAfterStatus(node, status);
        lab.editNode(node.id, enriched);
      }
      onStatusNote?.(formatStatusChangeNote(node.title, node.conclusionStatus, status));
      return true;
    }
    case 'confirm_finish': {
      lab.finishReport();
      lab.setConfirmChoice('finish_report');
      return true;
    }
    case 'confirm_continue': {
      lab.continueDig();
      lab.setConfirmChoice('continue_dig');
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
