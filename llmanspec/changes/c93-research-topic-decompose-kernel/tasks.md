# Tasks: c93-research-topic-decompose-kernel

## Propose（本阶段）

- [x] proposal + design + delta `deep-research-runtime` r326 + scenarios
- [x] `llman sdd validate c93-research-topic-decompose-kernel --strict --no-interactive`

## Apply（`llman-sdd-apply` · 全程 main）

### 1. Planner schema + 模块

- 1.1 结构化 planner 输出 Zod（shared 或 server 局部，禁止异形）
- 1.2 `planTopicDecomposition` + `applyDecomposePlan` 纯函数（可单测）

### 2. runLoop 集成

- 2.1 seed 后调用 planner；成功则 graph_patch 批量 upsert
- 2.2 失败回退 question-only；progress + log 事件
- 2.3 maxNodes 裁剪与违规拒绝

### 3. 测试

- 3.1 server research：成功拆解拓扑（decompose + merge）
- 3.2 server research：规划失败仍完成单路径 Run
- 3.3 对照 design §6 checklist（注释或测试表）

### 4. 验证

- 4.1 `just test` research 子集 + `bun typecheck`
- 4.2 `llman sdd validate c93-research-topic-decompose-kernel --strict --no-interactive`
