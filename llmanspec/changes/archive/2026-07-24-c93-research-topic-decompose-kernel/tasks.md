# Tasks: c93-research-topic-decompose-kernel

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-runtime` r326 + scenarios
- [x] `llman sdd validate c93-research-topic-decompose-kernel --strict --no-interactive`

## Apply（`llman-sdd-apply` · 全程 main）

### 1. Planner schema + 模块

- [x] 1.1 shared Zod `ResearchDecomposePlanSchema` + config `research.decomposeModelId`（可选，默认继承 chat）
- [x] 1.2 `planTopicDecomposition` + `applyDecomposePlanToGraph` / clamp（可单测）

### 2. runLoop 集成

- [x] 2.1 seed 后调用 planner；成功则 graph_patch 批量 upsert（不跑支路 work-unit）
- [x] 2.2 失败/空 branches 回退 question-only；progress + log
- [x] 2.3 maxNodes / depth 建议上限裁剪

### 3. 测试

- [x] 3.1 unit：成功拆解拓扑（decompose + merge）
- [x] 3.2 unit：非法/超限裁剪与空计划回退
- [x] 3.3 design §6 checklist 注释对照

### 4. 验证

- [x] 4.1 `bun test apps/server/tests/research/` + `bun typecheck` + `just check-app-schema`
- [x] 4.2 `llman sdd validate c93-research-topic-decompose-kernel --strict --no-interactive`
