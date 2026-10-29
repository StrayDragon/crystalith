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
