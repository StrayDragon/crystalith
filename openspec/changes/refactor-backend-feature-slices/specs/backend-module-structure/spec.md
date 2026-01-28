## ADDED Requirements
### Requirement: Feature-Sliced Module Layout
系统 MUST 采用按业务域划分的 feature-sliced 目录结构，将领域逻辑集中到 `crystalith/features/<feature>/`。

#### Scenario: 新增领域功能
- **WHEN** 新增一个有 HTTP 路由的领域功能
- **THEN** 该功能的路由必须位于 `crystalith/features/<feature>/api.py`
- **AND** 业务逻辑必须位于 `crystalith/features/<feature>/service.py` 或同层服务模块

#### Scenario: 业务域归属明确
- **WHEN** 模块提供以名词为中心的业务能力（如 sources、notebooks、outputs）
- **THEN** 该模块必须归属到对应业务域的 `features/<feature>` 内

### Requirement: Layered Dependency Direction
系统 MUST 强制依赖方向为 `web -> features -> shared`，并禁止反向依赖。

#### Scenario: Feature 依赖约束
- **WHEN** 任何 `features/<feature>` 模块被导入
- **THEN** 不允许在运行时导入 `crystalith/web` 或其他 `features/*` 模块

#### Scenario: 共享层依赖约束
- **WHEN** 任何 `shared/*` 模块被导入
- **THEN** 不允许在运行时导入 `crystalith/web` 或 `features/*` 模块

#### Scenario: 类型导入例外
- **WHEN** 仅用于类型标注的导入置于 `typing.TYPE_CHECKING` 分支
- **THEN** 该导入不视为违反层级依赖规则

### Requirement: Shared Cross-Domain Types
系统 MUST 将跨域共享类型与基础设施放置在 `crystalith/shared/`，避免与 feature 模块产生循环依赖。

#### Scenario: 共享枚举被多处使用
- **WHEN** 一个枚举或类型同时被数据库模型与多个 feature 使用
- **THEN** 该类型必须位于 `crystalith/shared/` 并由各 feature 引用

### Requirement: Central Router Aggregation
系统 MUST 在 `crystalith/web` 中集中注册所有 feature 路由，避免多处聚合导致隐式依赖链。

#### Scenario: 应用启动时加载路由
- **WHEN** FastAPI 应用初始化
- **THEN** 所有 feature 路由都由 `crystalith/web` 的统一入口注册
