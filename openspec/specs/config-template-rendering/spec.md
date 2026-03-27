# config-template-rendering Specification

## Purpose

定义配置 YAML 在解析前的模板渲染规则，确保后端/前端共享一致的 `{{ ... }}` 语法，并把注入来源收敛为可预测的 `env` + `secret` 两层。

## Non-goals

- 不提供完整的配置编辑 UI（可作为后续能力）。
- 不引入模板跨文件 include/extends（避免耦合、安全与可追溯性问题）。

## Requirements

### Requirement: YAML config files are rendered as templates before parsing

系统 MUST 在解析 YAML 之前对配置文件进行模板渲染；渲染语法 MUST 使用双花括号 `{{ ... }}`。

渲染范围 MUST 包含：
- base：`config/app.yaml`
- overlays：所有被发现并参与合并的 overlay 文件（例如 `app.local.yaml`、`app.<env>.yaml`、`app.<env>.local.yaml`）

#### Scenario: Render then parse
- **WHEN** 配置文件包含 `{{ env.KEY }}` 或 `{{ secret.KEY }}`
- **THEN** 系统 SHALL 先完成模板渲染，再对渲染后的文本执行 YAML 解析
- **AND** schema 校验与 settings 校验 SHALL 作用于渲染后的最终配置

### Requirement: Template context exposes env and secret namespaces

系统 MUST 在模板渲染上下文中提供两个顶层命名空间：

- `env`：环境变量映射
- `secret`：密钥映射

两者 MUST 支持 `{{ env.KEY }}` / `{{ secret.KEY }}` 的点号访问形式。

#### Scenario: Env and secret namespaces are available
- **WHEN** 配置模板引用 `{{ env.OPENAI_BASE_URL }}` 与 `{{ secret.OPENAI_API_KEY }}`
- **THEN** 系统 SHALL 使用对应命名空间解析并渲染其值
- **AND** 渲染结果 SHALL 为纯文本（不保留模板标记）

### Requirement: env is resolved from os.environ with .env overlay

系统 MUST 以如下顺序构建 `env` 映射：

1) 读取进程启动时的 `os.environ`
2) 若发现 `.env` 文件，则以 `.env` 的键值对覆盖同名 env key（`.env` 的优先级更高）

`.env` 的定位规则 MUST 可预测且与 config 位置相关（例如当 config 位于 `<root>/config/app.yaml` 时，优先使用 `<root>/.env`）。

#### Scenario: .env overrides system env for config rendering
- **WHEN** `os.environ` 中 `FOO=1`
- **AND** `.env` 中 `FOO=2`
- **THEN** 渲染 `{{ env.FOO }}` 的结果 SHALL 为 `2`

### Requirement: secret is resolved from secret.env next to app.yaml

系统 MUST 从与 `app.yaml` 同目录的 `secret.env` 读取 `secret` 映射。

`secret.env` MUST 为 dotenv 格式（`KEY=VALUE`），并 MUST 默认被 gitignore。

#### Scenario: secret.env is auto-discovered
- **WHEN** `config/secret.env` 存在
- **THEN** 系统 SHALL 自动读取该文件并解析 `{{ secret.* }}` 引用
- **AND** 用户无需额外设置环境变量指定 secrets 路径

### Requirement: Missing variables produce actionable errors

模板渲染阶段 MUST 对缺失变量与语法错误提供可操作错误信息，至少包含：
- 失败文件路径
- 错误类型（语法错误 / 缺失变量）
- 缺失的变量名列表（按命名空间区分）
- 下一步修复动作（例如“在 `.env` 或 `config/secret.env` 中添加 KEY”）

#### Scenario: Missing secret variable fails with hint
- **WHEN** 配置模板引用 `{{ secret.OPENAI_API_KEY }}` 但 `secret.env` 未提供该 key
- **THEN** 系统 SHALL 拒绝启动（或拒绝加载配置）
- **AND** 错误信息 SHALL 指示在 `config/secret.env` 中补全 `OPENAI_API_KEY`

### Requirement: Rendering is deterministic and side-effect free

模板渲染 MUST 是确定性的，且 MUST 不依赖网络与外部副作用：
- MUST NOT 访问网络
- SHOULD 使用沙箱环境限制危险能力（例如任意属性访问/函数调用）
- SHOULD 禁用跨文件 include/extends（除非另有明确规范）

#### Scenario: Rendering does not depend on network
- **WHEN** 系统渲染配置模板
- **THEN** 渲染过程 SHALL 不发起任何网络请求
- **AND** 在网络不可用时仍可完成渲染（若输入文件存在）

### Requirement: Frontend preview may use Nunjucks but backend is authoritative

前端 MAY 使用 Nunjucks 对同一模板语法子集进行“按需预览渲染”，但系统 MUST 将后端渲染结果视为权威。

#### Scenario: Frontend preview disagrees with backend
- **WHEN** 前端预览渲染与后端实际渲染产生差异
- **THEN** 系统 SHALL 以“后端渲染为准”作为诊断与运行依据
- **AND** 前端 SHALL 提示用户其预览仅覆盖受支持的语法子集
