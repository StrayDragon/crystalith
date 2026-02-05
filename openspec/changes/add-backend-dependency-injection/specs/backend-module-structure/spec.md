## ADDED Requirements

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
