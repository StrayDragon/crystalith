# backend-module-structure Specification

## Purpose
TBD - created by archiving change refactor-backend-feature-slices. Update Purpose after archive.
## Requirements
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

### Requirement: Retry Strategy for External Services
系统 SHALL 对所有外部服务调用（AI provider、embedding provider、web extractor）提供统一的重试策略。重试 MUST 采用 exponential backoff，并支持配置最大重试次数和可重试异常类型。

#### Scenario: AI Provider 暂时不可用
- **WHEN** AI provider 返回 503 / 网络超时
- **THEN** 系统自动重试（最多 3 次，间隔递增），全部失败后返回标准化错误响应

#### Scenario: 速率限制重试
- **WHEN** AI provider 返回 429 Rate Limit 并包含 retry-after header
- **THEN** 系统按 retry-after 指定的时间等待后重试

### Requirement: Standardized Error Response
系统 SHALL 返回标准化的错误响应格式，包含 error_code、message、details 和可选的 retry_after 字段。

#### Scenario: 标准化错误响应
- **WHEN** API 请求触发错误
- **THEN** 响应体包含 error_code（机器可读）、message（人类可读）和 details（调试信息）

### Requirement: Dependency Injection Convention
后端 SHALL 使用 FastAPI 的 Depends 系统进行依赖注入。核心依赖（db session、AI provider、embedding provider、vector store）MUST 通过统一的 provider 函数注册和获取。Feature service MUST 不直接导入全局单例。

#### Scenario: Service 获取依赖
- **WHEN** feature API 端点处理请求
- **THEN** 通过 Depends() 获取所需的 db session、AI provider 等，而非直接导入

#### Scenario: 测试替换依赖
- **WHEN** 编写 feature service 的单元测试
- **THEN** 通过 app.dependency_overrides 替换为 mock 实现，无需 patch 模块导入

#### Scenario: Provider 切换
- **WHEN** 配置文件中将 AI provider 从 OpenAI 切换为 Ollama
- **THEN** 依赖注入系统自动提供对应的 provider 实例，无需修改 feature 代码
