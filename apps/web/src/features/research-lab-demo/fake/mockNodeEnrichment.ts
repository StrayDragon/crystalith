import type { ResearchConclusionStatus } from '@crystalith/shared';

import type { LabNode } from './types';

const STATUS_ZH: Record<ResearchConclusionStatus, string> = {
  clear: '明确',
  partial: '待完善',
  missing: '无法结论',
  pending: '处理中',
  pruned: '已剪枝',
};

/**
 * Enrich node fields after a status settle so the graph/meta feel "researched"
 * rather than only flipping an enum (Fake / pre-API).
 */
export function mockEnrichAfterStatus(
  node: LabNode,
  nextStatus: ResearchConclusionStatus,
): Partial<LabNode> {
  const patch: Partial<LabNode> = {
    conclusionStatus: nextStatus,
    phase: 'idle',
  };

  if (nextStatus === 'pruned') return patch;

  const base =
    (node.conclusion ?? node.summary ?? '').trim() ||
    (node.query ? `围绕「${node.query}」的支路发现` : `「${node.title}」支路`);

  if (nextStatus === 'clear') {
    patch.conclusion = `${stripMockSuffix(base)} —— 已收束为明确结论：证据链可支撑当前判断。（Fake 定态）`;
    if (!node.summary) {
      patch.summary = `定态：明确 · ${node.title}`;
    }
  } else if (nextStatus === 'partial') {
    patch.conclusion = `${stripMockSuffix(base)} —— 仍有缺口，建议补检索或对照支路后再定稿。（Fake 定态）`;
  } else if (nextStatus === 'missing') {
    patch.conclusion = `${stripMockSuffix(base)} —— 现有证据不足以形成可靠结论。（Fake 定态）`;
  }

  return patch;
}

function stripMockSuffix(text: string): string {
  return text
    .replace(/\s*——\s*已收束为明确结论[。.].*$/u, '')
    .replace(/\s*——\s*仍有缺口[。.].*$/u, '')
    .replace(/\s*——\s*现有证据不足以[。.].*$/u, '')
    .replace(/\s*（Fake 定态）\s*$/u, '')
    .trim();
}

export function formatStatusChangeNote(
  title: string,
  from: ResearchConclusionStatus,
  to: ResearchConclusionStatus,
): string {
  return `定态「${title}」：${STATUS_ZH[from]} → ${STATUS_ZH[to]}`;
}

/** Richer fork placeholder finding once the branch is created. */
export function mockForkSeed(input: {
  title: string;
  query?: string;
  siblingTitle?: string;
}): Pick<LabNode, 'conclusion' | 'summary' | 'conclusionStatus' | 'phase'> {
  const q = input.query?.trim();
  return {
    conclusionStatus: 'pending',
    phase: 'idle',
    summary: input.siblingTitle
      ? `对照「${input.siblingTitle}」分出的探索支路。`
      : `用户分叉：${input.title}`,
    conclusion: q
      ? `待探索：将用查询「${q}」补证据，并与主支路交叉验证。`
      : `待探索：对照「${input.title}」收集替代证据。`,
  };
}
