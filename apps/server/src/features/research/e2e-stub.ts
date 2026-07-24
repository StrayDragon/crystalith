/**
 * Research e2e acceleration (c100 / L1=A).
 * When CL_RESEARCH_E2E_STUB=1, skip live LLM for decompose and inject stub web hits.
 */
import type { ResearchDecomposePlan } from '@crystalith/shared';

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
