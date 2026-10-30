import type { ResearchConclusionStatus } from '@crystalith/shared';

import type { LabNodeActionProposal } from './nodeChatTypes';
import type { LabNode, LabPhase } from './types';

export type QuickActionGroupId = 'status' | 'structure' | 'close';

export interface NodeQuickAction {
  id: string;
  label: string;
  title: string;
  /** Visual tone for badge */
  tone: 'neutral' | 'primary' | 'danger' | 'success' | 'warning';
  /** Highlight when this is the node's current status */
  active?: boolean;
  disabled?: boolean;
  proposal: LabNodeActionProposal;
}

export interface NodeQuickActionGroup {
  id: QuickActionGroupId;
  label: string;
  actions: NodeQuickAction[];
}

function pid(kind: string): string {
  return `qa-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function proposal(
  kind: LabNodeActionProposal['kind'],
  label: string,
  rationale: string,
  params?: LabNodeActionProposal['params'],
): LabNodeActionProposal {
  return {
    id: pid(kind),
    kind,
    label,
    rationale,
    status: 'pending',
    params,
  };
}

function statusAction(
  status: ResearchConclusionStatus,
  label: string,
  tone: NodeQuickAction['tone'],
  current: ResearchConclusionStatus,
): NodeQuickAction {
  const active = current === status;
  return {
    id: `status-${status}`,
    label,
    title: active ? `当前已是「${label}」` : `将状态定为「${label}」`,
    tone,
    active,
    disabled: active,
    proposal: proposal('set_status', `定为${label}`, `快捷定态 → ${status}`, {
      conclusionStatus: status,
    }),
  };
}

function statusGroupFor(node: LabNode): NodeQuickActionGroup | null {
  const role = node.role ?? 'research';
  if (role !== 'research' && role !== 'conclusion') return null;
  const actions: NodeQuickAction[] = [
    statusAction('clear', '明确', 'success', node.conclusionStatus),
    statusAction('partial', '待完善', 'warning', node.conclusionStatus),
    statusAction('missing', '无法结论', 'neutral', node.conclusionStatus),
  ];
  return { id: 'status', label: '定态', actions };
}

function forkQueryFor(node: LabNode): string {
  return node.query ? `${node.query} · 对照角` : `${node.title} 对照`;
}

function researchStructureGroup(node: LabNode): NodeQuickActionGroup {
  return {
    id: 'structure',
    label: '结构',
    actions: [
      {
        id: 'rewrite',
        label: '改查询',
        title: '改写检索查询并触发 reshape',
        tone: 'primary',
        proposal: proposal('rewrite_query', '改写检索查询', '结构：改 query', {
          query: node.query ?? '',
        }),
      },
      {
        id: 'fork',
        label: '分叉对照',
        title: '从同一父节点另开对照支路',
        tone: 'primary',
        proposal: proposal('fork_sibling', '分叉对照支路', '结构：fork', {
          title: `对照：${node.title}`,
          query: forkQueryFor(node),
          summary: `从「${node.title}」分出的对照探索。`,
        }),
      },
      {
        id: 'prune',
        label: '剪枝',
        title: '剪掉本支路',
        tone: 'danger',
        proposal: proposal('prune_node', '剪枝本支路', '结构：prune'),
      },
    ],
  };
}

function questionStructureGroup(node: LabNode): NodeQuickActionGroup {
  return {
    id: 'structure',
    label: '结构',
    actions: [
      {
        id: 'rewrite-intent',
        label: '改意图',
        title: '更新研究问题 / 意图',
        tone: 'primary',
        proposal: proposal('rewrite_query', '更新研究意图', '结构：改意图', {
          query: node.conclusion ?? node.query ?? '',
        }),
      },
    ],
  };
}

function structureGroupFor(node: LabNode): NodeQuickActionGroup | null {
  const role = node.role ?? 'research';
  if (role === 'research') return researchStructureGroup(node);
  if (role === 'question') return questionStructureGroup(node);
  return null;
}

function confirmActions(node: LabNode): NodeQuickAction[] {
  const role = node.role ?? 'research';
  if (!(role === 'question' || role === 'conclusion')) return [];
  return [
    {
      id: 'confirm-finish',
      label: '结束出报告',
      title: '确认结束并生成报告',
      tone: 'success',
      proposal: proposal('confirm_finish', '结束并出报告', '收束：finish'),
    },
    {
      id: 'confirm-continue',
      label: '继续深挖',
      title: '确认后继续探索',
      tone: 'primary',
      proposal: proposal('confirm_continue', '继续深挖', '收束：continue'),
    },
  ];
}

function openReportAction(node: LabNode, reportAvailable?: boolean): NodeQuickAction | null {
  if ((node.role ?? 'research') !== 'conclusion' || !reportAvailable) return null;
  return {
    id: 'open-report',
    label: '打开报告',
    title: '打开独立报告页',
    tone: 'primary',
    proposal: proposal('open_report', '打开报告页', '收束：报告'),
  };
}

function closeGroupFor(
  node: LabNode,
  awaiting: boolean,
  reportAvailable?: boolean,
): NodeQuickActionGroup | null {
  const actions: NodeQuickAction[] = [];
  const report = openReportAction(node, reportAvailable);
  if (report) actions.push(report);
  if (awaiting) actions.push(...confirmActions(node));
  return actions.length > 0 ? { id: 'close', label: '收束', actions } : null;
}

/**
 * Grouped procedural badges for the node chat composer.
 * Rows: 定态 | 结构 | 收束 — client-side, same ActionProposal ports.
 *
 * r105：completed/failed 终态 inspector 只读——只保留只读导航（打开报告），
 * 不再提供剪枝/fork/定态/改查询等会改图的入口。
 */
export function buildNodeQuickActionGroups(input: {
  node: LabNode;
  phase: LabPhase;
  reportAvailable?: boolean;
}): NodeQuickActionGroup[] {
  const { node, phase, reportAvailable } = input;
  if (phase === 'completed' || phase === 'failed') {
    const group = closeGroupFor(node, false, reportAvailable);
    return group ? [group] : [];
  }

  const groups: NodeQuickActionGroup[] = [];
  const status = statusGroupFor(node);
  if (status) groups.push(status);
  const structure = structureGroupFor(node);
  if (structure) groups.push(structure);
  const close = closeGroupFor(node, phase === 'awaiting_confirm', reportAvailable);
  if (close) groups.push(close);
  return groups;
}

/** Flat list (tests / callers that do not need grouping). */
export function buildNodeQuickActions(input: {
  node: LabNode;
  phase: LabPhase;
  reportAvailable?: boolean;
}): NodeQuickAction[] {
  return buildNodeQuickActionGroups(input).flatMap((g) => g.actions);
}

export const QUICK_ACTION_TONE_CLASS: Record<NodeQuickAction['tone'], string> = {
  neutral: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  primary: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
  danger: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
};

export const QUICK_ACTION_ACTIVE_CLASS =
  'ring-2 ring-offset-1 ring-slate-400 cursor-default opacity-90';
