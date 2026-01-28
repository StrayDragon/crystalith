## Context
当前 `crystalith` 后端采用扁平化顶层模块结构，随着功能增加，出现 API 与业务模块互相依赖的运行时循环导入。模块职责边界不清晰，导致新增功能时需要跨多处文件修改，维护成本上升。本次改造采用业务域切片，并通过 `crystalith2/` 与 `tests2/` 的并行迁移降低切换风险。

## Goals / Non-Goals
- Goals:
  - 以业务域切片方式聚合相关逻辑，降低认知负担与跨模块耦合。
  - 明确依赖方向，消除运行时循环导入。
  - 保持对外 API 行为不变（路径、响应结构不变）。
- Non-Goals:
  - 不引入新的业务功能或变更现有 API 语义。
  - 不引入新的外部依赖或框架。

## Decisions
- Decision: 采用三层依赖方向：`web` -> `features` -> `shared`，并在 `crystalith2/` 中落地。
  - `web/`：FastAPI 应用创建、全局依赖注入、路由聚合。
  - `features/`：业务域切片，包含 `api.py`（路由）、`service.py`（业务）、`repo.py`（数据访问）、`schemas.py`（输入输出模型）。
  - `shared/`：跨域基础设施与通用类型（config/db/ai/vector_storage/utils/search/parsers/schemas）。
- Decision: 业务域切片边界采用灵活策略：`notebooks`/`sessions`/`messages` 可单独域或合并为 workspace 域，后续迁移中据复杂度决定。
- Decision: 将跨 feature 的类型与枚举提升到 `shared`，避免 db 与 feature 互相依赖。
  - 示例：`OutputType` 继续位于 shared，outputs 生成逻辑归属 outputs feature。
- Decision: 采用并行迁移策略：新增 `crystalith2/` 与 `tests2/`，TDD 驱动实现；最终一次性切换目录名。
- Decision: 测试期间使用临时命令 `just test2` 执行 `tests2/`。
- Decision: 引入轻量依赖方向检查规则（静态 grep 规则），用于阻止运行时层级反向导入。
  - 规则：`features/*` 不得导入 `web/*` 与其它 `features/*`；`shared/*` 不得导入 `web/*` 或 `features/*`；仅允许在 `typing.TYPE_CHECKING` 分支内的类型导入。
  - 实施方式：新增 `just check-imports`，内部调用 `rg` 对违规 import 做匹配并 fail。

## Alternatives considered
- 保持扁平结构，仅通过延迟导入/TYPE_CHECKING 缓解循环导入。
  - 缺点：治标不治本，长期维护复杂度仍会上升。
- 以 `api` 作为唯一入口模块并把所有逻辑放入 `api/*`。
  - 缺点：会把路由层与业务层混在一起，边界更弱。

## Risks / Trade-offs
- 风险：迁移后导入路径变更导致运行时错误或测试失败。
  - 缓解：分阶段迁移 + 全量测试 + 必要时添加临时 re-export。
- 风险：某些模块被多个 feature 依赖，容易形成新一轮循环。
  - 缓解：将共享类型/接口下沉至 `shared`，采用依赖反转（Protocol/抽象工厂）。
- 风险：`__init__` 过度 re-export 导致隐式导入链。
  - 缓解：尽量保持 `__init__` 空或使用惰性 `__getattr__`。
- 风险：并行包导致同一进程加载两套模型/元数据。
  - 缓解：迁移期间仅切换单一入口指向 `crystalith2`，避免混用。

## Current Dependency Hotspots
- `crystalith/api/__init__.py` 聚合 `analysis.api` 与 `tasks.api`。
- `analysis/api.py`、`tasks/api.py` 反向依赖 `api/deps.py`，形成运行时循环导入链。
- `api/deps.py` 依赖 `tasks.TaskQueue`，进一步放大 `api` 与 `tasks` 的耦合。

## TDD Scope & Tests2 Layout
- `backend/py/tests2/` 作为新测试根目录，结构对应 `crystalith2/`：`tests2/features/<feature>/`、`tests2/shared/`、`tests2/web/`。
- 迁移优先顺序以核心域为先（建议：sources/notebooks/sessions/messages 或 research/outputs）。
- 迁移期间使用 `just test2` 单独执行新测试集。

## Migration Plan
1. 建立目标目录结构（`crystalith2/web/`、`crystalith2/features/`、`crystalith2/shared/`）。
2. 新增 `tests2/` 并采用 TDD 驱动迁移与重构（优先覆盖关键域）。
3. 迁移 shared 基础设施模块（config/db/ai/vector_storage/utils/search/parsers/schemas）。
4. 按业务域逐个迁移 feature 模块与路由。
5. 更新 FastAPI app 路由聚合入口（仅指向 `crystalith2`）。
6. 完成 `tests2` 覆盖后，移除旧 `tests/` 与 `crystalith/`，并重命名 `crystalith2 -> crystalith`、`tests2 -> tests`。

## Target Structure Preview
```
backend/py/src/
  crystalith/
    web/
      app.py
      deps.py
      routers.py
    features/
      notebooks/
        api.py
        service.py
        repo.py
        schemas.py
      sessions/
        api.py
        service.py
        repo.py
        schemas.py
      messages/
        api.py
        service.py
        repo.py
        schemas.py
      sources/
        api.py
        service.py
        repo.py
        schemas.py
      research/
        api.py
        service.py
        graph.py
        schemas.py
      outputs/
        api.py
        service.py
        generators/
        schemas.py
      studio/
        api.py
        service.py
        slides/
      analysis/
        api.py
        service.py
      tasks/
        api.py
        service.py
        worker.py
      search/
        service.py
        providers/
      ingestion/
        service.py
        chunker.py
      parsers/
        service.py
        providers/
    shared/
      config/
      db/
      ai/
      vector_storage/
      schemas/
      utils/
      types.py
  tests/
    features/
    shared/
    web/
```

## Open Questions
- `notebooks/sessions/messages` 是否最终合并为 workspace 域，将在实施阶段据复杂度决定。
