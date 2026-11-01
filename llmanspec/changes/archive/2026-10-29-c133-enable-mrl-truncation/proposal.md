---
title: MRL 截断可选启用——eval 基准先行、网关参数优先、客户端兜底
depends_on: [c130-extend-embedding-capability]
branch: sdd/c133-enable-mrl-truncation
base_branch: main
base_sha: 608ef9d92d81ea83b289c5e0695a44404f1deb29
---

# MRL 截断可选启用（eval 基准先行）

> **定位**：性能优化 + 新增可选行为，非主线能力。eval 基准不达标则关闭本 change（保留调研结论）。
> 前置事实（2026-10-13 调研）：EmbeddingGemma 2 原生 768 维支持套娃截断 768/512/256/128
> （模型卡：256 近无损、128 仅文本近无损）；网关不代做截断（但 tufa:50233 实测支持
> `dimensions` 参数）；256 维 batch×32 约 650/s，快于 768 维约 500/s（BENCHMARK.md）。

## Why

- 每向量存储 3 KB（768 维 f32）→ 1 KB（256 维）；sqlite-vec KNN 为暴力扫描，耗时 ∝ 维度。
- 个人 KB 规模（数千块）收益可忽略——因此**默认关闭**，作为用户可选配置启用。
- 直接启用有真实回归风险：截断后若不 L2 再归一化，cosine 得分全失真；维度变更需整库
  re-embed（vec_chunks 建表定维，r478 已锁 EMBEDDING_DIM_MISMATCH）。**必须先有 eval
  基准才能前后验证**——这也是 c73 移除全量 Eval Harness 后第一个有明确消费者的
  scoped 评估回归（见 design 论证）。

## What Changes

1. **eval 基准先行**（第一批 tasks）：固定语料 + 已知查询对 → recall@k / nDCG 基线
   （768 维），产物入库 `apps/server/tests/rag/mrl-eval/`；跑 512/256 对比，**数据达标
   才继续**（判据写入 tasks）。
2. **截断实现二选一 + 兜底**：① 网关侧——embed 请求带
   `providerOptions: { openai: { dimensions: N } }`（网关截断并归一化）；② server 侧
   兜底——engine 收到全维向量后切片前 N 维 + L2 再归一化。倾向 ①+②：网关支持走参数，
   不支持走客户端截断。
3. **可选配置**（默认关闭）：config schema 新增 embedding 截断开关（语义：目标维度；
   null/缺省 = 不截断）；启用时 MUST 强制再归一化（issue #7 验收承接）。
4. **维度变更迁移**：开关变更导致的 dims 漂移走既有 vec_chunks 维度守卫与重建入口
   （c131/r478 语义），不在本 change 另造迁移机制。

## Capabilities

- **新增 `embedding-mrl-truncation`**（本 change 的合约落点）：配置开关、再归一化强制、
  双路径行为、eval 基准产物约束。embedding-runtime 的 purpose 已声明 c133 不在其内。

## Impact

- `apps/server/src/rag/embedding-engine`（双路径）、`shared/config.ts`（开关）、
  `apps/server/tests/rag/`（eval 基准 + 行为锁测）。
- wire 面（`/v2/models`）**零变化**：mrlDims 声明已由 c130/r474 透出，本 change 只消费它。
- 不改 OpenAPI/AsyncAPI；不影响 e2e。

## Further Notes

- **diff 内 1 行跨主题改动**（verify W1）：`LabNodeDrawer.tsx` 的 fallow
  `css-broken-reference` 抑制注释——`shadow-xl` 为 tw4 引擎生成类的已知误报
  （apps/web/AGENTS.md 记载、LabProgressBar 有同款先例）；本分支过 `just qa`
  的 audit-fallow diff 门所需，随本 change 一并落地。
- 实现细节与 verify 报告：T1.3 实测数据见 tasks.md 结论区；S2（非整数
  truncation_dims 的类型守卫）已按 verify 建议修复并补测。
