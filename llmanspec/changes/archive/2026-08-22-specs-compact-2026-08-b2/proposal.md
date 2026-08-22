---
branch: sdd/specs-compact-2026-08-b2
base_sha: e2294c7793b104e2b03a7e57c24e8a4d4c0e1c72
checkpointed: true
checkpoint_sha: e2294c7793b104e2b03a7e57c24e8a4d4c0e1c72
---

# Proposal — specs-compact-2026-08-b2

## Why

b1（2026-08-22-specs-compact-2026-08）完成了正确性修复、守则违规清理与 capability 级合并，
但遗留两类工作：约 20 条 type-a 函数名/路径锚定，以及 11 组跨 requirement 冗余。
本批次完成这些收尾，使 spec 语料完全符合「Spec 书写守则」并消除多处一稿多维护。

## What Changes

- type-a 去锚定：scenarios/MUST 中的函数名、文件名、组件内部标识改为行为语义（不改语义）
- intra-spec 合并：chat-prompt-presets（R6/R7）、source-ingestion-management-and-tags（R9/R10）、
  workspace-api-contract notebook-scoped 四条收敛为两条（R4）
- 跨 spec 引用化：R1 camelCase wire、R11/R12/R14/R17 改 canonical 引用
- 不改变任何规范行为；strict 校验全绿

## BREAKING

无（纯 spec 文档收敛，wire/代码零改动）。
