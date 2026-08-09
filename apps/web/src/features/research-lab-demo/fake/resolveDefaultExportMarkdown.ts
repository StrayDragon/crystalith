import type {
  LabCitation,
  LabEdge,
  LabGraphMutations,
  LabNode,
  LabScenario,
} from '../../research-lab/model/types';
import { buildSuggestedReportFromNodes } from './buildSuggestedReport';

/** Prefer handcrafted scenario report when graph is pristine; else synthesize from nodes. */
export function resolveDefaultExportMarkdown(input: {
  scenario: LabScenario;
  nodes: LabNode[];
  mutations: LabGraphMutations;
  edges?: LabEdge[];
}): string {
  const { scenario, nodes, mutations, edges } = input;
  const mutated =
    mutations.extraNodes.length > 0 ||
    mutations.prunedNodeIds.length > 0 ||
    Object.keys(mutations.nodeEdits).length > 0;
  if (!mutated && scenario.reportMarkdown.trim()) {
    return scenario.reportMarkdown;
  }
  return buildSuggestedReportFromNodes({
    topic: scenario.topic,
    nodes,
    citations: scenario.citations as Record<string, LabCitation>,
    edges,
  });
}
