---
depends_on: []
branch: sdd/c110-specs-compact
base_sha: 6fbd37f2cf0d1db919060a74ab615774487d2281
checkpointed: true
checkpoint_sha: 6fbd37f2cf0d1db919060a74ab615774487d2281
---

## Why

specs 经过 63+ 个变更积累后出现三类问题：

1. **过度约束**：部分 requirement 把实现细节写进规范（具体文件路径、函数名、行号、魔法数字），
   限制后续重构与设计优化。例如 `apps/server/src/features/<feature>/router.ts`、
   `sanitizeCitationsIndices（pipeline.ts）`、`minScore 默认 0.2`、`short=6-8` 等。
2. **重复**：同一行为在多个 capability 中重复声明（outbound 代理 4 处、epoch 失效 3 处、
   ContextStats 3 处、ErrorEnvelope 3 处等），改一处漏一处。
3. **过时/矛盾**：迁移期残留与现行行为冲突（E1 深研 Tab 要求 vs Fast-only 现行实现）、
   空壳 scenario（tasks-removed 等）、v1 行号引用（v1 已删）。

## What Changes

- **llmanspec/AGENTS.md**：新增「Spec 书写守则」rule——禁止把代码路径/文件名/函数名/行号/
  魔法数字写进 MUST/SHALL 语句；默认值与实现细节归 config/代码，spec 只约束可验证行为。
- **A. 放松过度约束**（architecture-core / configuration-governance / generation-core /
  typed-generation-framework / generation-presets-and-constraints / retrieval-and-cache /
  source-ingestion-summary-and-conversion / output-rendering-and-typing /
  studio-slides-workflow / deep-research-runtime）：
  去除文件路径、内部 API 名、v1 行号、硬编码默认值，保留行为语义
  （「可配置」「默认对齐 v1 语义」由 config 承载）。
- **B. 合并重复**（约 23 组）：出站代理 4→1、epoch 3→1、sourceIds 5→3、ContextStats 3→1、
  stats preset 2→1、commands 2→1、ErrorEnvelope 3→1、SLIDES/tools 可用性 5→3、SSRF 2→1、
  上传限制 2→1、qa-to-source 2→1、outputs pipeline 3 组各 2→1、stale-running 2→1、
  SSE 流式 2→1、深研入口 3→1、fixture 过渡约束族→1 等。
- **C. 移除过时/矛盾**：E1 深研 Tab 矛盾要求 2 条、workspace-api-contract 空壳 scenario 4 条、
  evidence-review-workflow 整 capability（被 generation-core 覆盖）、
  frontend-extractor-types-must-not-duplicate（迁移期临时约束）。
- 每个保留 requirement 至少保留一个有效 scenario；`llman sdd validate --specs --strict` 全绿。

## Specs Landing

本次为 specs-only 变更：直接改写 `llmanspec/specs/**/spec.toon`（live specs 走绑定分支，
不做 changes/<id>/specs/ 副本）。无代码变更。
