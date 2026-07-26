---
depends_on: []
branch: sdd/c102-research-llm-report-and-retry
base_sha: 6f106b887e70e170ce079a86954166f635d0f5ad
checkpointed: true
checkpoint_sha: 6f106b887e70e170ce079a86954166f635d0f5ad
---

## Why

深研接线与 e2e 生产路径（至 c100）已闭环，但结案仍用证据 bullet **启发式清单**冒充研究报告，对用户无产品意义。节点 work-unit 失败时还会 pragmatic 硬搜「假命中」。需要把结案升级为 **LLM 结构化成稿**，失败时 **failed + 可换模重试**，并补齐节点短综合与 model 绑定，作为后续 B/C 波次的质量基线。

## What Changes

1. **LLM 结案成稿**：`synthesizeAndComplete` MUST 经结构化 LLM 产出同形 `ResearchReport`；MUST NOT 再用启发式证据清单作为成功成稿。
2. **失败语义**：结案模型调用失败或「声称引用但 cite key 全非法」→ Run `failed`（可见 `failureReason`）；MUST NOT 静默回退清单报告。
3. **retry-synthesize**：同 Run `POST …/retry-synthesize`（名以 design 为准），可选 `modelId`；**不**重跑检索/支路；成功→`completed`+report。
4. **model 作用域**：create 可选 `modelId` 持久化；结案与 retry 读 Run 上 model（retry 可覆盖写回）；省略则沿用现有默认 chat / config。
5. **0 证据**：仍可调结案 LLM 做「诚实不足 / 归纳」成稿 → `completed`；引用是充分不必要条件。
6. **cite 校验**：cite key MUST ⊆ 本 Run 证据映射；非法剥离；有证不引合法；仅「幻觉/全非法声称」→ failed。
7. **节点短综合**：drain 写回时 MUST LLM 短综合写入节点摘要字段；空证据合法；模型彻底失败 → 节点 `conclusionStatus=missing`，Run 继续；MUST NOT 假命中回退。
8. **Lab UI**：Compose 可选 model；failed 展示错误 +「重试结案」+ 换模；workspace 本变更仅卫生对齐（无 slash/--go / `@`）。

## Locked decisions（explore 深挖）

- 总序 D→A→B→C1→C2→C3；本 change = **A**
- BDD-off；独立 `sdd/<id>` 分支；串行闭环
- 结案失败不给启发式清单；用户换模重试
- 同 Run 仅重试结案；创建/retry 持久化 modelId
- 引用充分不必要；节点/报告可 0 cite 有结论

## Capabilities

- `deep-research-runtime` — LLM 结案、retry、modelId、节点短综合、失败语义
- `deep-research-ui` — Compose/failed 换模与重试面

## Impact

- 依赖已合入 main 的 service 拆分（c101 quick：`report.ts` / `run-loop.ts` / `commands.ts`）
- shared Zod：create/retry body、`ResearchRun.modelId` / `failureReason`
- Lab：`useEdenLabController` + Compose；不删 fixture（留给 B）
- Follow-up（非本 change）：B fixture→`/demo/...`、`cl-prd-demo` skill；C1 再扩展；C2 revision→新 Run；C3 并行

## Seams

- `apps/server/src/features/research/report.ts` — LLM synthesize + cite 校验 + retry 入口协作
- `apps/server/src/features/research/run-loop.ts` — 节点短综合；去掉假命中回退
- `apps/server/src/features/research/commands.ts` + `router.ts` — create modelId、retry-synthesize
- `packages/shared/src/schemas/research.ts` — 合约字段
- `apps/web/src/features/research-lab/` — Compose model + failed retry UI
- `apps/server/tests/research/` — unit（mock LLM）
