# config-and-models — Delta Spec (c0)

## MODIFIED Requirements

### Requirement: Runtime config source of truth is YAML

系统 MUST 以 `config/app.yaml`（经模板渲染 + overlays 合并 + schema 校验）作为运行时业务配置的权威来源；配置加载器 MUST NOT 再执行“读取环境变量覆盖配置字段”的二次覆盖步骤。

配置加载器允许读取的环境变量仅限于“配置定位入口”：
- `CRYSTALITH_CONFIG_PATH` / `CRYSTALITH_CONFIG_DIR`

配置加载器还 MUST 支持模板渲染输入（见 `config-template-rendering`）：
- `{{ env.* }}`：来自 `os.environ` + `.env`（`.env` 覆盖系统 env）
- `{{ secret.* }}`：来自与 `app.yaml` 同目录的 `secret.env`

#### Scenario: Legacy env overrides are ignored
- **WHEN** 用户设置了诸如 `DATABASE_URL`、`REDIS_URL`、`OLLAMA_HOST`、`CRYSTALITH_SEARCH__SEARXNG__HOST` 等环境变量
- **AND** `config/app.yaml` 为对应字段提供了明确值且未通过 `{{ env.* }}` 引用这些变量
- **THEN** 配置加载器 SHALL 不使用这些环境变量覆盖 YAML 字段
- **AND** 系统 SHALL 仍以 YAML 解析出的配置启动并提供服务

#### Scenario: Config path is selectable via env
- **WHEN** 用户设置 `CRYSTALITH_CONFIG_PATH` 指向一个存在的 YAML 文件
- **THEN** 系统 SHALL 加载该文件作为配置来源（并按 schema 校验）

### Requirement: Secrets are auto-discoverable without env

在未设置任何 secrets 定位环境变量的情况下，系统 MUST 自动尝试加载与 `config/app.yaml` 同目录的 `secret.env`（若存在），并支持 `{{ secret.KEY }}` 插值。

#### Scenario: Auto-load config/secret.env
- **WHEN** `config/secret.env` 存在
- **THEN** 系统 SHALL 读取该文件并解析 `{{ secret.* }}` 引用

### Requirement: Secrets are not committed in plaintext

示例配置 MUST 不包含明文密钥；密钥应由 `config/secret.env`（不提交到仓库）或其他安全注入方式提供。

#### Scenario: Sample config contains no plaintext secrets
- **WHEN** 用户参考仓库内示例配置进行部署
- **THEN** 示例配置 SHALL 不包含明文密钥，并引导用户使用 `config/secret.env` 或其他安全注入提供密钥
