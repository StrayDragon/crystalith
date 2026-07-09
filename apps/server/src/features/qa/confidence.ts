// QA confidence scoring — ports v1 `qa/service.py:79` confidence_score.
//
// Confidence blends three signals into a single [0,1] score:
//   similarity_avg  — average retrieval score of cited chunks
//   coverage_ratio  — fraction of notebook sources cited (breadth)
//   citation_ratio  — how fully the top-K slots were filled (depth)
// (similarity_avg + coverage_ratio + citation_ratio) / 3, clamped [0,1].
import type { Citation } from '@crystalith/shared';

/**
 * Compute QA confidence from the cited chunks.
 *
 * @param citations       The citations attached to the answer.
 * @param notebookSources Total source count in the notebook (for coverage).
 * @param topK            The top-K used for retrieval (for citation depth).
 */
export function computeConfidence(
  citations: Citation[],
  notebookSources: number,
  topK: number,
): number {
  if (citations.length === 0) return 0;

  const similarityAvg = avg(citations.map((c) => c.score ?? 0));
  const uniqueSources = new Set(citations.map((c) => c.source_id)).size;
  const coverageRatio = notebookSources > 0 ? uniqueSources / notebookSources : 0;
  const citationRatio = Math.min(1, citations.length / Math.max(1, topK));

  const score = (similarityAvg + coverageRatio + citationRatio) / 3;
  return Math.max(0, Math.min(1, score));
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
