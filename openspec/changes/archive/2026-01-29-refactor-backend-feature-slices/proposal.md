## Why
当前后端模块扁平，API 层与业务/基础设施层之间存在运行时循环导入（例如 `api` 与 `analysis`、`tasks` 互相引用），随着模块继续增长会降低可维护性与可测试性。此次重构采用“业务域切片”与并行包迁移策略，降低切换风险并便于回归对照。

## What Changes
- 引入 feature-sliced 结构：`crystalith2/features/<feature>/...`，按业务域聚合逻辑与 API 路由。
- 引入共享层：`crystalith2/shared/` 放置跨域基础设施与通用类型（config/db/ai/vector_storage/utils/search/parsers/schemas 等）。
- 引入 Web 层：`crystalith2/web/` 负责 FastAPI 应用创建与路由注册。
- 明确依赖方向与禁止规则，避免运行时循环导入。
- 采用并行迁移：新结构落在 `crystalith2/` 与 `tests2/`，TDD 驱动开发；旧包与 tests 冻结，仅在最终切换时替换目录名。

## Impact
- 受影响规范：新增 `backend-module-structure` 规范。
- 受影响代码：`backend/py/src/crystalith2/*`（新增）、最终切换时的 `backend/py/src/crystalith/*` 与 `backend/py/tests/*`。
- 风险：模块迁移引发导入路径变更；通过并行包 + TDD 测试集对照降低切换风险。
