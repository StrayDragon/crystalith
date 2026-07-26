# Tasks: c106-research-parallel-branch-units

## Propose（本阶段）

- [x] proposal + design + live specs（runtime r327 修订 / r336）
- [x] attach `sdd/c106-…` + validate `--stage spec`

## Apply（后续 `llman-sdd-apply`）

### 1. Config

- [x] 1.1 `parallelBranchUnits` Zod + app.yaml + schema gen check
- [x] 1.2 读取 helper（clamp 1..8）

### 2. Kernel

- [x] 2.1 per-Run LLM 队列 + write锁
- [x] 2.2 `drainResearchWorkUnits` 批量并行（N）；`N=1` 等价串行
- [x] 2.3 `runNodeWorkUnit` LLM 走队列

### 3. 测试

- [x] 3.1 并行完成 + merge 保留；LLM 不重叠；cancel 干净
- [x] 3.2 现有 research suite 全绿

### 4. 验证

- [x] 4.1 `bun test apps/server/tests/research/` + typecheck
- [x] 4.2 `llman sdd validate c106-… --strict`
