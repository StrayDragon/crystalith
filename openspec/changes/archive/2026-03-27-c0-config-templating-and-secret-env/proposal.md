## Why

当前配置体系存在多处“能用但容易漂移/误用”的摩擦点：

- YAML 插值语法是自定义的 legacy env/secrets 占位符语法，与前端/后端常用模板语法不一致，且能力受限（只能做简单替换，难以扩展）。
- `env` 插值仅来自进程 `os.environ`；仓库根目录的 `.env` 主要服务于 compose/build，不会自动进入 YAML 插值来源，导致本地/CI/Compose 场景下经常需要额外 export 或脚本同步。
- secrets 目前以 `config/secrets.yaml`（或 docker secrets 目录）承载，与用户“dotenv/同级文件注入”的心智模型不一致。
- `config/` 下存在多份“几乎完整拷贝”的变体配置（以及本机域名/端口痕迹），叠加 overlay 规则后很难快速判断最终生效配置，配置漂移与排障成本高。

我们希望把配置体系收敛到一个更直观、跨语言一致的规则：YAML 作为模板，统一使用 `{{ ... }}` 语法，并把配置注入来源简化为 `.env` + `secret.env`。

## What Changes

- **BREAKING**：YAML 配置文件在加载前将先经过模板渲染（backend: Jinja2；frontend 可选 Nunjucks 复用同一语法）。
- **BREAKING**：移除 legacy env/secrets 占位符语法；统一为：
  - `{{ env.VAR }}`：来自“启动时环境变量 + `.env` 叠加”的结果（先读系统 env，再用 `.env` 覆盖同名 key）
  - `{{ secret.VAR }}`：来自与 `app.yaml` 同级目录的 `secret.env`
- **BREAKING**：移除 `config/secrets.yaml`（及其示例/文档路径）；改为 `config/secret.env`（gitignored）作为唯一 secrets 载体。
- 统一并清理 `config/`：将当前有效配置收敛为少量权威文件；历史/混乱的配置文件备份到 `../` 后移除（避免继续被 overlay/误引用）。
- 更新脚本与文档：
  - `just upsert-env-configs` 改为生成/更新 `config/secret.env`（而非 `config/secrets.yaml`）
  - 部署/开发文档更新为新语法与新文件布局，并明确 Docker Compose / hybrid / local 的一致注入规则

## Capabilities

### New Capabilities
- `config-template-rendering`: 定义 YAML 模板渲染的输入源、语法约束、错误诊断与跨语言一致性（Jinja2/Nunjucks）。

### Modified Capabilities
- `config-and-models`: 配置加载与插值机制（从 legacy env/secrets 占位符 → `{{ env/secret }}`），以及 `.env` / `secret.env` 的装配顺序。
- `delivery-and-deployment`: 文档与部署入口对 `secret.env` 的定位、gitignore 规则、以及 Docker/host 场景中 `.env` 的可用性约束。

## Impact

- Backend：`ConfigManager` 的加载链路将改为“模板渲染 → YAML 解析/overlay merge → schema 校验 → settings validate”；并提供缺失变量/模板错误的可执行诊断。
- Frontend：引入 Nunjucks（可选）以支持对同一配置模板进行预览/渲染（按需，用于后续配置诊断/预检 UX）。
- Dev/Deploy：Compose/hybrid/local 将以同一套 `.env` + `config/secret.env` 注入规则运行；旧的 `config/secrets.yaml` 与旧语法将不再生效。
