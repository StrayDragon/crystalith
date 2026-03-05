## ADDED Requirements

### Requirement: Runtime config is documented as YAML-first
部署文档 MUST 将 `config/app.yaml`（+ secrets）作为运行时业务配置的权威来源，并明确 `.env` 仅用于部署/构建静态参数（例如端口、镜像、构建镜像源）。

#### Scenario: New operator configures runtime without business env
- **WHEN** 新操作者按部署文档启动核心栈
- **THEN** 文档 SHALL 指引其通过编辑 `config/app.yaml` 与 `config/secrets.yaml` 完成业务配置
- **AND** 文档 SHALL 不要求其通过 `.env` 设置数据库地址、缓存地址或模型 provider 密钥等业务参数

### Requirement: .env.example contains only deploy/build static parameters
`.env.example` MUST 仅包含部署/构建静态参数模板，并 MUST 不包含运行时业务参数（例如 `DATABASE_URL`、`REDIS_URL`、`OPENAI_API_KEY`、`OLLAMA_HOST`、`CRYSTALITH_SEARCH__SEARXNG__HOST` 等）。

#### Scenario: Copying .env.example does not imply runtime configuration
- **WHEN** 用户复制 `.env.example` 为 `.env` 且仅修改端口/镜像等静态参数
- **THEN** 系统 SHALL 仍以 `config/app.yaml` 作为运行时配置来源

### Requirement: Overlays do not inject business config into api env
生产 compose overlays MUST 仅负责启动可选子服务与其持久化/网络拓扑，并 MUST NOT 通过 `api.environment` 注入业务运行配置。

#### Scenario: Enabling storage overlay does not require env wiring
- **WHEN** 用户在核心清单上叠加 storage overlay 启动
- **THEN** `api` SHALL 无需额外业务 env 注入即可运行
- **AND** 系统 SHALL 通过 `config/app.yaml` 的端点选择机制连接到可选子服务
