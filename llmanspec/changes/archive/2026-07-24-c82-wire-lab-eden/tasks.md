# Tasks: c82-wire-lab-eden

## 1. Port 真实现

- [x] 1.1 实现 `EdenResearchSessionPort`（**create / list** / get / stream / 命令口 / revisions / report / progress）
- [x] 1.2 任务抽屉双入口改接 `listRuns`；Compose 接 `create`；去掉默认 demoResearchTasks 权威
- [x] 1.3 默认主路径切换到 Eden；fixture 仅显式开关
- [x] 1.4 错误码 `RESEARCH_*` 与信封展示

## 2. shared / Eden

- [x] 2.1 仅用 `@crystalith/shared` + Eden 推断；无平行 wire DTO
- [x] 2.2 graph_patch / chat proposal 适配器与 c81 合约一致

## 3. 验证

- [x] 3.1 Lab Vitest + 定向 e2e（抽屉 + Compose + badge）
- [x] 3.2 `bun typecheck`；server `tests/research` 回归绿
- [x] 3.3 `llman sdd validate c82-wire-lab-eden --strict --no-interactive`
- [x] 3.4 （可选）`bun scripts/smoke-research-live.ts` — 慢模型不阻塞归档
