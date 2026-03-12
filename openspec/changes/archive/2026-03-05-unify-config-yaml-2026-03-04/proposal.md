## Why

当前部署与运行时配置来源分散（`.env`、`config/app.yaml`、`deployments/**` overlays、`dockers/**` 等），导致：

- 配置难以迁移与复用：`.env` 不具备结构化校验与默认值语义，跨环境复制容易遗漏或漂移。
- 可选依赖启停语义不清晰：同一个能力（例如 Postgres/Chroma/Redis/SearXNG/Ollama）可能同时被 YAML 与 env/compose 注入控制，排障成本高。
- “配置即文档”能力弱：YAML 已有 schema 与插值能力，但实际运行仍依赖大量 env override，造成单一真相缺失。

目标是让**业务运行配置集中在 `config/app.yaml`**（+ secrets），以便维护、审计与迁移；把 `.env` 退化为**少量部署/构建静态参数**（端口、镜像、构建镜像源等）。

## What Changes

- 运行时配置以 `config/app.yaml` 为单一真相：
  - Secrets 统一通过 `config/secrets.yaml`（不提交）或 Docker secrets 目录注入，并在 YAML 中使用 `${{ secrets.KEY }}` 引用。
  - 自动加载 secrets：优先 `CRYSTALITH_SECRETS_PATH`，否则尝试与 `config/app.yaml` 同目录的 `secrets.yaml`。
- **BREAKING**：移除/禁用业务参数的 env overrides（例如 `DATABASE_URL`、`REDIS_URL`、`OLLAMA_HOST`、`OPENAI_API_KEY`、`CRYSTALITH_SEARCH__SEARXNG__HOST` 等）。仅保留配置定位类入口（`CRYSTALITH_CONFIG_PATH/CRYSTALITH_CONFIG_DIR`、`CRYSTALITH_SECRETS_PATH`）。
- 在 `config/app.yaml` 中显式定义核心与可选依赖的连接候选与探测策略，实现单文件跨环境自动适配：
  - 同一份 YAML 可在 core-only、compose overlays、host dev + dev-deps 中自动选择可用端点（按候选优先级探测并锁定）。
  - 搜索（SearXNG）支持运行中懒加载；存储/向量库/默认模型提供方在启动时定案（切换需重启）。
- Compose overlays 收敛为“只负责起服务”，不再向 `api` 注入业务 env：
  - overlays 仅提供容器与网络拓扑；运行时使用 YAML 选择端点。
- `.env.example` 精简为部署/构建静态参数示例；新增迁移说明 `_NOTE.md`，指导从旧 env 配置迁移到 YAML + secrets。
- 增加针对配置加载、secrets 自动发现、候选端点选择与回退的后端测试。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `config-and-models`: 将运行时配置的“权威来源”收敛为 YAML（+ secrets），调整/移除业务 env override 作为常规配置路径；补充候选端点与自动探测/锁定语义，并更新 schema。
- `delivery-and-deployment`: 更新部署入口与文档，使 `.env` 仅承载部署/构建静态参数；compose overlays 从“注入业务配置”调整为“仅启动可选依赖”。
- `service-composition-profiles`: 明确 overlays/profile 仅控制服务组合；可选依赖的可用性与降级状态可观测，且支持“服务晚启动”后被探测到并启用（对允许懒加载的能力）。

## Impact

- Backend:
  - 配置与 schema：`backend/py/src/crystalith/shared/config/*`、`config/app.schema.gen.json`、`config/app.yaml`
  - 可选依赖接入与探测：cache/vector storage/search/database 的选择与回退逻辑
  - 启动行为：`AUTO_DB_INIT` 等启动开关迁入 YAML
- Deployments:
  - `deployments/prod/docker-compose*.yml` overlays 取消业务 env 注入
  - `.env.example` 与部署文档更新
- Docs:
  - configuration/deployment/operations 的配置说明与迁移指引更新
- Tests:
  - 新增配置加载与选择逻辑覆盖的 pytest 用例
