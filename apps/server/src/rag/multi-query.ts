// Multi-query expansion + RRF fusion (ports v1 context.py:168-232).
//
// Generates query seeds from the original query + output type hints, runs
// retrieval for each, then fuses results via Reciprocal Rank Fusion. This
// broadens recall when the user's phrasing differs from the source text.
import type { ChunkResult } from './types.ts';

const RRF_K = 60;
// max seeds (incl. original) to bound cost
const SEED_CAP = 3;

// Output-type → seed suffix hints (v1 _build_query_seeds).
const OUTPUT_HINTS: Record<string, string[]> = {
  FAQ: ['常见问题', '疑问', '解答'],
  GUIDE: ['指南', '步骤', '方法'],
  TIMELINE: ['时间线', '顺序', '发展'],
  MINDMAP: ['要点', '结构', '关系'],
  QUIZ: ['考点', '关键概念', '重点'],
  BRIEFING: ['摘要', '概述', '要点'],
  SLIDES: ['主题', '核心观点', '要点'],
};

/**
 * Build query seeds: the original query plus hint-augmented variants based on
 * the output type. Capped at SEED_CAP to bound retrieval cost.
 */
export function buildQuerySeeds(query: string, outputType?: string): string[] {
  const seeds = new Set<string>([query]);
  const hints = outputType ? OUTPUT_HINTS[outputType] : undefined;
  if (hints) {
    for (const hint of hints) {
      if (seeds.size >= SEED_CAP) break;
      seeds.add(`${query} ${hint}`);
    }
  }
  return Array.from(seeds).slice(0, SEED_CAP);
}

/**
 * Fuse multiple retrieval result lists via Reciprocal Rank Fusion.
 * score = Σ 1/(k + rank) across lists, then normalized to [0,1].
 */
export function rrfFuseSeeds(resultLists: ChunkResult[][], topK: number): ChunkResult[] {
  const acc = new Map<number, { chunk: ChunkResult; rrf: number }>();

  for (const list of resultLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const c = list[rank];
      const contribution = 1 / (RRF_K + rank + 1);
      const existing = acc.get(c.chunk_id);
      if (existing) {
        existing.rrf += contribution;
      } else {
        acc.set(c.chunk_id, { chunk: c, rrf: contribution });
      }
    }
  }

  const sorted = Array.from(acc.values())
    .toSorted((a, b) => b.rrf - a.rrf)
    .slice(0, topK);
  const maxRrf = sorted[0]?.rrf ?? 1;
  return sorted.map(({ chunk, rrf }) => ({
    ...chunk,
    score: maxRrf > 0 ? rrf / maxRrf : 0,
  }));
}
