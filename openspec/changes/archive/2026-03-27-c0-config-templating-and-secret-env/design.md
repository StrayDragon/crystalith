## Context

当前后端配置加载链路为：

1) 定位 `config/app.yaml`（或 `CRYSTALITH_CONFIG_PATH` / `CRYSTALITH_CONFIG_DIR`）
2) 自动发现 overlays（`app.local.yaml` / `app.{env}.yaml` / `app.{env}.local.yaml`）
3) 读取 `config/secrets.yaml`（或 legacy secrets path env var / docker secrets dir）
4) 对 YAML dict 做 legacy env/secrets 占位符的字符串级替换（自实现 regex）
5) deep-merge overlays，schema 校验与 Pydantic validate

在实践中出现的问题：

- 插值语法自定义且能力弱；无法利用成熟模板生态（条件/默认值/小范围逻辑）。
- 插值来源分裂（`os.environ` vs `.env` vs secrets.yaml），排障时很难回答“最终值从哪里来”。
- `config/` 中存在被 gitignore 但仍被提交的本地 overlay 文件，导致任何环境（包括 docker compose）都会自动合并本地配置，存在高风险漂移。

本变更目标是把“插值”提升为一等的**模板渲染阶段**，统一语法与注入来源，并清理配置文件形态。

## Goals / Non-Goals

**Goals:**

- YAML 配置在解析前先用模板渲染，统一语法为 `{{ ... }}`（backend: Jinja2）。
- 所有 YAML 配置文件支持：
  - `{{ env.KEY }}`：来自 `os.environ` + `.env`（先读系统 env，再用 `.env` 覆盖同名 key）
  - `{{ secret.KEY }}`：来自与 `app.yaml` 同目录的 `secret.env`
- 清理并固化 `config/` 的最小权威文件集合，杜绝“被提交的 local overlay”继续影响默认运行。
- 提供可操作的诊断错误：缺失变量/模板语法错误必须带路径、定位、缺失 key 列表与修复建议。
- 保持现有 “endpoint_candidates + 探测” 模型不变，使 docker compose / hybrid / local 仍可共用同一份 YAML。

**Non-Goals:**

- 不提供完整的前端配置编辑器或 UI 表单（可作为后续能力）。
- 不兼容旧 legacy env/secrets 占位符与 `config/secrets.yaml`（一次性升级）。
- 不引入复杂的模板 include/extend 体系（避免跨文件耦合与安全/可追溯性问题）。

## Decisions

### D1. 模板渲染是配置加载的第一阶段

加载顺序固定为：

1) **读取模板输入**：`env`、`secret`
2) **渲染**：对 `app.yaml` 与每个 overlay 文件分别渲染
3) **YAML 解析**：将渲染后的文本 `safe_load`
4) **deep-merge**：按 overlay 顺序合并
5) **schema 校验**：对 merged dict 做 JSON Schema 校验
6) **Settings validate**：Pydantic validate + 运行时派生（endpoint candidates、paths normalize 等）

这样可以保证：
- schema 校验看到的是“最终有效配置”，不会被未渲染占位符干扰
- overlays 能独立引用模板变量，不要求 base 先声明

### D2. 输入源与优先级：env 与 secret 明确分层

- `env`：
  - base：`os.environ`
  - overlay：解析 `<root>/.env`（当 config 处于 `<root>/config/app.yaml` 时，`<root>` 即 `config/` 的上级目录；否则以 config dir 为 anchor）
  - precedence：`.env` **覆盖** `os.environ` 同名 key（符合“先读系统再叠加 .env”）
- `secret`：
  - 读取 `config_dir/secret.env`（与 `app.yaml` 同目录）
  - 不读取 `.env` 中的 secrets（约束层面鼓励 secrets 只进 `secret.env`）

### D3. Backend renderer：Jinja2（沙箱、无文件 include）

- 使用 Jinja2 作为配置模板渲染器；推荐使用 `SandboxedEnvironment`（或等价约束）以减少意外能力。
- 不启用模板 `include`/`extends`（避免跨文件依赖与可追溯性下降）。
- 模板上下文仅暴露：
  - `env`（mapping）
  - `secret`（mapping）
  - （可选）`profile` / `env_name` 等只读字符串（若确有需要再加）

### D4. 缺失变量与错误策略：默认显式失败，允许按需 default

为避免静默渲染为空字符串导致的“跑起来但错配”：

- 默认对未定义变量使用严格策略（推荐 `StrictUndefined`）。
- 允许用户在模板中显式写默认值（示例）：
  - `{{ env.OPENAI_BASE_URL | default('') }}`
  - `{{ env.CRYSTALITH_DEFAULT_EMBEDDING_MODEL | default('') }}`
- `secret.*` 建议始终严格：缺失应导致启动失败并提示补全 `config/secret.env`。

### D5. 前端 renderer：Nunjucks 作为“按需”的预览实现（非启动必需）

- 本变更的**权威渲染器**是后端（Jinja2），用于实际运行配置。
- 前端可按需引入 Nunjucks，用于：
  - 配置预检/预览（例如 diagnostics 页面展示渲染结果或变量缺失）
  - 与后端保持“语法一致”的用户心智模型
- 前端渲染仅覆盖受支持的模板子集（变量插值 + default），并在不兼容语法时提示以“后端为准”。

### D6. `config/` 文件布局收敛与清理

收敛到最小可理解集合：

- 保留：
  - `config/app.yaml`（可提交，模板化）
  - `config/app.schema.gen.json`（生成）
  - `config/secret.env.example`（示例，指导用户创建 `secret.env`）
- 可选但默认不提交：
  - `config/app.local.yaml`（用户本地覆盖，gitignored）
  - `config/app.<env>.yaml` / `config/app.<env>.local.yaml`（高级用户/多环境）

将仓库中当前已提交的本地 overlay（如 `config/app.local.yaml`、`config/app.*.local.yaml`）视为配置漂移源：迁移时先备份到 `../`，再从 git 移除。

## Risks / Trade-offs

- [模板能力增强] → 模板可读性下降的风险；通过禁止 include/extends、限制上下文与推荐小逻辑缓解。
- [StrictUndefined] → 迁移期会暴露更多缺失变量；通过引入 `default()` 与清晰错误提示缓解。
- [Jinja2 vs Nunjucks 差异] → 前端预览可能与后端存在边角不一致；通过定义“支持子集 + 后端权威”缓解。
- [清理 config 文件] → 可能影响依赖这些文件的个人工作流；通过“先备份到 ../”缓解。

## Migration Plan

1) 新增：
   - `config/secret.env.example`
2) 修改后端：
   - 在 `ConfigManager` 引入 Jinja2 渲染阶段（渲染 base + overlays）
   - 引入 `.env` 与 `secret.env` 解析（`.env` 覆盖系统 env）
   - 移除旧 legacy env/secrets 解析实现与 `config/secrets.yaml` 读取路径
3) 升级仓库配置：
   - 全量替换 YAML 中的 legacy 占位符为 `{{ ... }}`，并把 secrets 引用迁移到 `secret.*`
4) 清理 `config/`：
   - 将已提交的本地 overlay 文件备份到 `../`（例如 `../crystalith-config-backup-YYYYMMDD/`）
   - 从 git 中移除这些文件
5) 更新脚本与文档：
   - `just upsert-env-configs` 改为生成 `config/secret.env`
   - 更新 `docs/doc/deployment.md`、`deployments/_NOTE.md`、`docs/doc/configuration.md` 等引用路径与示例
6) 验证：
   - `cd backend/py && just config-schema`
   - `cd backend/py && just test`
   - `cd frontend/web && pnpm test && pnpm typecheck`
   - `just check`

## Open Questions

- legacy secrets path env var 是否保留（允许 secrets 位于非 config 目录），还是完全移除以简化？
- `.env` 的定位规则是否允许通过 env 指定（例如 `CRYSTALITH_DOTENV_PATH`），还是只按约定路径发现？
- 前端 Nunjucks 预览是否作为本 change 的必做项，还是先在文档/后端落地后再引入？
