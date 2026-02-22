# backend-module-structure Specification

## Purpose

定义 Crystalith 后端的模块组织与依赖边界：以 feature-sliced 方式在 `crystalith/features/*` 内聚 API/服务/仓储；在 `crystalith/web` 统一聚合路由；通过 FastAPI Depends 进行依赖注入；并约定跨层依赖方向与 API 模块的 import hygiene。

本 spec 只覆盖“结构与边界”。错误 envelope、重试与性能护栏、插件系统等语义分别由对应 spec 负责，避免重复描述。

## Related specs

- `workspace-api/spec.md`（标准化错误响应 envelope）
- `backend-performance/spec.md`（重试边界、缓存/并发护栏）
- `plugin-system/spec.md`（插件发现与扩展点）
- `config-management/spec.md`

## Requirements
### Requirement: Feature-Sliced Module Layout
系统 MUST 采用按业务域划分的 feature-sliced 目录结构，将领域逻辑集中到 `crystalith/features/<feature>/`。

最小约束：
- 有 HTTP 路由的领域功能 MUST 以 `crystalith/features/<feature>/api.py` 作为对外入口（router 聚合点）
- 业务逻辑 MUST 位于 `crystalith/features/<feature>/service.py` 或同层服务模块
- 以名词为中心的业务能力（如 sources/notebooks/outputs）MUST 归属到对应 `features/<feature>` 内

### Requirement: Layered Dependency Direction
系统 MUST 强制依赖方向为 `web -> features -> shared`，并禁止反向依赖。

约束：
- `features/*` MUST NOT 在运行时导入 `crystalith/web` 或其他 `features/*`
- `shared/*` MUST NOT 在运行时导入 `crystalith/web` 或 `features/*`
- 仅用于类型标注的导入 MAY 放入 `typing.TYPE_CHECKING` 分支作为例外

### Requirement: Shared Cross-Domain Types
系统 MUST 将跨域共享类型与基础设施放置在 `crystalith/shared/`，避免与 feature 模块产生循环依赖。

### Requirement: Central Router Aggregation
系统 MUST 在 `crystalith/web` 中集中注册所有 feature 路由，避免多处聚合导致隐式依赖链。

### Requirement: Dependency Injection Convention
后端 SHALL 使用 FastAPI 的 Depends 系统进行依赖注入。核心依赖（db session、AI provider、embedding provider、vector store）MUST 通过统一的 provider 函数注册和获取。Feature service MUST 不直接导入全局单例。

测试与部署路径：
- 测试时 SHOULD 通过 `app.dependency_overrides` 替换依赖实现（避免 patch 模块导入）
- provider 切换（如 OpenAI→Ollama）SHOULD 仅通过配置驱动，feature 代码不应修改

### Requirement: Feature API decomposition via sub-routers
系统 SHALL 允许在不改变 `crystalith/features/<feature>/api.py` 作为对外入口的前提下，将该 feature 的端点按职责拆分到同目录下的子模块（例如 `api_tags.py`、`api_ingest.py`），并由 `api.py` 统一聚合导出单一 router。
`crystalith/web` MUST 只依赖 `crystalith/features/<feature>/api.py` 作为入口导入点，避免导入多个子模块导致依赖链扩散。

### Requirement: Import hygiene for API modules
系统 MUST 保持 API 模块的 import 结构清晰：所有 import 语句 MUST 位于模块顶部，并且在任何运行时语句（如 logger 初始化、常量计算、router 声明）之前执行，避免产生隐式的加载顺序问题。
