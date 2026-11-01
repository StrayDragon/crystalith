// r495 检索质量指标（二值相关性）：recall@k 与 nDCG@k，纯函数可单测。
/** recall@k：前 k 命中里相关文档的召回比例。 */
export function recallAtK(retrieved: string[], relevant: ReadonlySet<string>, k: number): number {
  if (relevant.size === 0) return 0;
  let hit = 0;
  for (const id of retrieved.slice(0, k)) {
    if (relevant.has(id)) hit += 1;
  }
  return hit / relevant.size;
}

/** nDCG@k：二值增益（rel=1）的折损累计与理想排列之比。 */
export function ndcgAtK(retrieved: string[], relevant: ReadonlySet<string>, k: number): number {
  let dcg = 0;
  retrieved.slice(0, k).forEach((id, i) => {
    if (relevant.has(id)) dcg += 1 / Math.log2(i + 2);
  });
  const idealCount = Math.min(relevant.size, k);
  if (idealCount === 0) return 0;
  let idcg = 0;
  for (let i = 0; i < idealCount; i += 1) idcg += 1 / Math.log2(i + 2);
  return dcg / idcg;
}

/** 相对基线的 recall 衰减百分比（go/no-go 判据输入）。 */
export function decayPct(baseline: number, candidate: number): number {
  if (baseline <= 0) return 0;
  return (1 - candidate / baseline) * 100;
}

/** r495 no-go 阈值：256 维 recall@10 相对基线衰减超过该百分比即 no-go。 */
export const NOGO_DECAY_PCT = 5;

export interface VerdictInput {
  dims: number;
  recall10: number;
}

/**
 * go/no-go 判定（r495：256 维 recall@10 相对基线衰减 > 5% 即 no-go）。
 * 256 档缺失时硬失败而非判 go——判据只在 256 档存在时才有意义（例如用
 * 非 768 维模型重录 fixture 会静默缺档，缺档即 no-go 证据缺失）。
 */
export function computeVerdict(results: VerdictInput[]): { decay256: number; verdict: string } {
  const baseline = results[0];
  if (!baseline) throw new Error('eval 判据缺输入：results 为空');
  const at256 = results.find((r) => r.dims === 256);
  if (!at256) {
    throw new Error(
      `eval 判据缺档：results 中没有 256 维档（dims=[${results.map((r) => r.dims).join('/')}])——` +
        '请用声明 ≥768 维的模型重录 fixture（bun tests/rag/mrl-eval/generate.ts），缺档不得判 go',
    );
  }
  const decay = decayPct(baseline.recall10, at256.recall10);
  return { decay256: decay, verdict: decay > NOGO_DECAY_PCT ? 'no-go' : 'go' };
}
