---
depends_on: [c16-fix-v2-rag-foundations]
blocks: [c13-add-v2-distribution, c14-add-v2-cleanup-delivery]
batch: all
---

# c23-fix-v2-studio-and-analysis — Studio 两阶段 + Analysis 聚类

## Why

`docs/V1-V2-DRIFT-ANALYSIS.md` 揭示：(1) v2 Studio 跳过 outline 阶段直接出 markdown（DB schema 支持 stage:input/outline/markdown 但 outline 是标签非独立步骤）；主题硬编码 `seriph`（v1 有 6 预设 + 确定性 frontmatter 重建）；`crystalith-slidev` 包 git 追踪 **0 文件**（前端 `@crystalith-slidev` import 会断）。(2) v2 Analysis 是 8000 字截断 + 单次 LLM（无聚类），v1 是 embedding greedy centroid 聚类 + 相关性检测 + LLM 矛盾检测。

## What Changes

- **MODIFIED** `apps/server/src/features/studio/router.ts` — 两阶段：outline（独立 SSE + 可 review）→ markdown，非直接出
- **NEW** `apps/server/src/features/studio/theme-presets.ts` — 6 主题预设 + 确定性 frontmatter 重建（移植 v1 `config.py`）
- **NEW** `packages/crystalith-slidev/src/index.ts` — 补包源文件（当前 git 0 文件，前端 import 会断）
- **MODIFIED** `apps/server/src/features/analysis/router.ts` — embedding greedy centroid 聚类（移植 v1 `clustering.py`）+ 相关性检测（`correlation.py`）+ LLM 矛盾检测（`contradiction.py`），替代 8000 字截断单次 LLM

## Capabilities

- studio-slides-workflow (spec delta: 两阶段 + 主题)
- typed-generation-framework (spec delta: analysis 聚类)

## Impact

- Studio outline 可独立 review 后再生成 markdown（HITL）
- 6 主题预设可选（非硬编码 seriph）
- 前端 slidev 渲染可用（包源文件补全）
- Analysis 基于真实聚类（非 LLM 猜测），结果可复现
