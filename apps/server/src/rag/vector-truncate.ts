// MRL 截断的向量切片 + L2 再归一化（c133 r494 路径②，engine 与 eval 共用 SSOT）。
// 截断后模长 ≠ 1，cosine 得分会整体失真——再归一化是硬约束，无开关。
/** 切前 dims 维并 L2 归一化；零维/越界/零向量直接抛错（配置错误应当显式失败）。 */
export function sliceNormalize(vec: readonly number[] | Float32Array, dims: number): Float32Array {
  if (!Number.isInteger(dims) || dims <= 0 || dims > vec.length) {
    throw new Error(`sliceNormalize: dims must be an integer in (0, ${vec.length}], got ${dims}`);
  }
  const out = new Float32Array(dims);
  for (let i = 0; i < dims; i += 1) out[i] = vec[i];
  let norm = 0;
  for (let i = 0; i < dims; i += 1) norm += out[i] * out[i];
  norm = Math.sqrt(norm);
  if (norm === 0) throw new Error('sliceNormalize: zero-norm vector');
  for (let i = 0; i < dims; i += 1) out[i] /= norm;
  return out;
}

/** L2 模长（网关返回向量的模长校验与 fixture 完整性检查共用）。 */
export function l2Norm(vec: readonly number[] | Float32Array): number {
  let s = 0;
  for (const v of vec) s += v * v;
  return Math.sqrt(s);
}
