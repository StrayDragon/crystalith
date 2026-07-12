---
depends_on: []
batch: all
---

# c50-fix-v2-outputs-slides-guard-validation — Outputs SLIDES 守卫 + source_id 校验 + citation sanitize + LLM repair loop

## Why

2026-07-12 第四轮深度复核发现 outputs 域存在 **4 个 P1**（c42 P0 真对齐，但 c38 承诺的 sanitize 与 v1 的 SLIDES 守卫/repair loop 未兑现；PROGRESS.v2.md 标注的 "SLIDES 缺 postprocess case" 根因被误判）。

### P1-1 — SLIDES 未被 outputs 端点拒绝（"SLIDES 缺 postprocess case" 的真根因）

- **v1** (`api.py:205-206`): outputs 端点对 `type=SLIDES` 显式返回 400 "Use slides endpoints for SLIDES output"；SLIDES 由独立 studio 特性处理，根本不进 `output_postprocess.py`。
- **v2** (`router.ts:97-180`): 接受 SLIDES 并走通用 `runOutputPipeline`；`pipeline.ts:220-252`（`ensureMinimumContentFields`）和 `pipeline.ts:258-276`（`isContentEmpty`）都缺 SLIDES case。
- PROGRESS.v2.md 反复标注 "SLIDES 缺 postprocess case"（line 194/199/253）作为 MEDIUM 债务——但根因不是 "缺 case"，而是 **SLIDES 不该进此路径**。正确修复是 400 拒绝（对齐 v1），而非给 SLIDES 加 postprocess。

### P1-2 — source_id 不校验归属

- **v1** (`output_graph.py:151-176`): `_normalize_source_ids` + `_validate_source_ids`，未知/不属于 notebook 的 id 抛 `ValueError("Unknown source_id in source_ids")` → 400。
- **v2** (`pipeline.ts`): 把 `sourceIds` 直接透传给 `ragRegistry.retrieveWith`，无存在性/归属校验。id 不存在时静默检索空结果而非 400；router.ts:168 的 `msg.includes('retrieval')` 也捕获不到。

### P1-3 — Citation 索引未 sanitize（c38 第 3 项承诺未兑现）

- **v1** (`output_postprocess.py:293-346`): `sanitize_citations_indices` 递归剥离越界/重复/非整数索引，设 `_warnings`/`citations_sanitized` 标记，并对所有 content 设 `_postprocessed: true`（line 377）。
- **v2** (`pipeline.ts:421-449`): `mapCitationsIntoContent` 只做 `.filter((c): c is Citation => c !== undefined)` 静默丢弃未解析索引，不 dedupe、不发警告、不设 `_postprocessed`。c38 proposal 第 3 项明确承诺 `sanitizeCitationsIndices` 但未实现。

### P1-4 — preference=quality 的 LLM repair loop 缺失

- **v1** (`output_graph.py:595-719`): `PostprocessOutput` 节点在 `preference=quality` 且 `needs_repair`（`output_postprocess.py:192-290`）检测到空/缺字段时，跑第二次 LLM pass 修补可挽救的输出。
- **v2** (`pipeline.ts:185-199`): 无 repair loop、无 `needs_repair` 等价物，生成失败直接降级到 fallback。对 quality 请求降级更激进。

## What Changes

1. **SLIDES 400 守卫**: `router.ts` POST handler 对 `type=SLIDES` 返回 400 "Use slides endpoints for SLIDES output"（对齐 v1 `api.py:205-206`）。从 pipeline 移除（不会到达的）SLIDES 处理。
2. **source_id 校验**: pipeline 入口校验每个 source_id 属于 notebook，未知 id → 400（对齐 v1 `_validate_source_ids`）。
3. **citation sanitize**: 实现 `sanitizeCitationsIndices`（越界/重复/非整数剥离 + `_postprocessed`/`_warnings` 标记），对齐 v1 `output_postprocess.py:293-346,377`。
4. **LLM repair loop**: preference=quality 时跑 repair loop（needs_repair 检测 + 第二次 LLM pass），对齐 v1 `output_graph.py:595-719`。

## Capabilities

- `output-rendering-and-typing`（spec delta: SLIDES 400 守卫 + source_id 校验）
- `typed-generation-framework`（spec delta: citation sanitize + LLM repair loop）

## Impact

- **SLIDES 路由正确**: SLIDES 走 studio 而非 outputs，消除 "缺 postprocess case" 债务。
- **source_id 错误显式**: 不存在的 id 返回 400 而非静默空检索。
- **citation 更干净**: 越界/重复索引被剥离并标记，消费方可读 `_postprocessed`/`_warnings`。
- **quality 输出更完整**: 可挽救的输出被 repair 而非直接 fallback。
- **无 BREAKING**: 端点路径不变；400 是契约对齐（v1 一直 400）；新增 `_postprocessed` 为额外字段。
