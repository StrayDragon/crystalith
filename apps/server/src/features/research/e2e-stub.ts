/**
 * Research e2e acceleration (c100 / L1=A; c102 synthesize stub).
 * When CL_RESEARCH_E2E_STUB=1, skip live LLM for decompose/synthesize and inject stub web hits.
 */
import type { ResearchDecomposePlan, ResearchReport } from '@crystalith/shared';

export function isResearchE2eStub(): boolean {
  const v = process.env.CL_RESEARCH_E2E_STUB?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Deterministic multi-branch plan so Lab graph has nodes + edges offline. */
export function e2eStubDecomposePlan(topic: string): ResearchDecomposePlan {
  const t = topic.trim() || 'e2e-topic';
  return {
    branches: [
      { title: '支路A', query: `${t} 维度A`, edgeKind: 'decompose' },
      { title: '支路B', query: `${t} 维度B`, edgeKind: 'decompose' },
    ],
  };
}

export function e2eStubWebHits(query: string): Array<{
  title: string;
  url: string;
  snippet: string;
  source: string;
}> {
  return [
    {
      title: `E2E stub · ${query.slice(0, 48)}`,
      url: 'https://example.com/e2e-research-stub',
      snippet: `Deterministic web hit for e2e research stub (${query}).`,
      source: 'e2e-stub',
    },
  ];
}

/** Deterministic LLM-shaped report without live synthesize (c102). */
export function e2eStubResearchReport(topic: string, evidenceCount: number): ResearchReport {
  const t = topic.trim() || 'e2e-topic';
  return {
    title: `研究报告：${t}`,
    sections: [
      {
        id: 'overview',
        heading: '概述',
        blocks: [
          {
            type: 'paragraph',
            text:
              evidenceCount === 0
                ? `围绕「${t}」未收集到可用证据；本报告为诚实不足说明（e2e stub）。`
                : `围绕「${t}」的深度研究结果（e2e stub）。共收集 ${evidenceCount} 条证据。`,
            citeIds: [],
          },
        ],
      },
    ],
    citations: {},
  };
}

export function e2eStubNodeSummary(title: string, evidenceCount: number): string {
  return evidenceCount > 0
    ? `【stub】${title}：已综合 ${evidenceCount} 条证据。`
    : `【stub】${title}：检索无命中，暂无证据。`;
}
