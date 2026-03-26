# delivery-and-deployment — Delta Spec (c0)

## MODIFIED Requirements

### Requirement: Runtime config is documented as YAML-first

部署文档 MUST 将 `config/app.yaml`（模板渲染 + overlays + schema 校验）作为运行时业务配置的权威来源，并明确 secrets 位于 `config/secret.env`。

文档 MAY 提及 `.env` 作为两类用途的承载：
- 部署/构建静态参数（端口、镜像、构建镜像源等）
- 非 secret 的模板输入（供 `{{ env.* }}` 使用）

但文档 MUST 明确：密钥 MUST NOT 放入 `.env`，而 MUST 放入 `config/secret.env`。

#### Scenario: New operator configures runtime without business env
- **WHEN** 新操作者按部署文档启动核心栈
- **THEN** 文档 SHALL 指引其通过编辑 `config/app.yaml` 与 `config/secret.env` 完成业务配置
- **AND** 文档 SHALL 不要求其通过 `.env` 设置模型 provider 密钥等 secret

### Requirement: .env.example contains only deploy/build static parameters

`.env.example` MUST 仅包含部署/构建静态参数模板，以及可选的**非 secret**模板输入示例；并 MUST NOT 包含任何 secret（例如 `OPENAI_API_KEY`、数据库密码等）。

#### Scenario: Copying .env.example does not imply runtime configuration
- **WHEN** 用户复制 `.env.example` 为 `.env` 且仅修改端口/镜像等静态参数
- **THEN** 系统 SHALL 仍以 `config/app.yaml` 作为运行时配置来源
