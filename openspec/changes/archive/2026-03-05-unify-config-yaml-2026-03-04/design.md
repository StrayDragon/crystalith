## Context

现状同时存在多条配置通道（`.env`、`config/app.yaml`、compose overlays 对 `api.environment` 的注入、以及若干运行时 env overrides）。虽然 `config/app.yaml` 已具备 schema 校验与 `${{ env.* }}` / `${{ secrets.* }}` 插值能力，但实际运行时仍大量依赖 `.env` 与环境变量覆盖，导致：

- 配置漂移：同一字段可能被 YAML、env override、compose 注入三处同时控制。
- 迁移成本高：`.env` 不具备结构化校验与“默认值/可选块”的语义，跨环境复制容易遗漏。
- 排障困难：可选依赖（Postgres/Chroma/Redis/SearXNG/Ollama）的启用与端点来源不透明。

本变更以“YAML 单一真相”为主线，将运行时业务配置收敛到 `config/app.yaml`（+ secrets），把 `.env` 退化为部署/构建静态参数模板。

## Goals / Non-Goals

**Goals:**
- 运行时业务配置以 `config/app.yaml` 为权威来源（single source of truth）。
- Secrets 通过 `config/secrets.yaml`（不提交）或 Docker secrets 目录注入；YAML 使用 `${{ secrets.KEY }}` 引用。
- 同一份 `config/app.yaml` 可在以下形态自动适配可选依赖端点：
  - core-only（默认 sqlite / embedded chroma / memory cache / search disabled）
  - compose overlays（容器内 service name）
  - host dev + dev-deps（127.0.0.1 暴露端口）
- 去除业务参数 env overrides 与 compose 对 `api` 的业务 env 注入（BREAKING）。
- 文档与模板（`docs/*`、`deployments/README.md`、`.env.example`）以 YAML 为中心重新对齐。

**Non-Goals:**
- 不引入新的编排系统（仍以 compose merge overlays 为主路径）。
- 不改变与本议题无关的业务 API 语义。
- 不在本次变更中进行大规模配置项重命名（除非为消除 env 依赖所必需）。

## Decisions

### 1) 配置来源与优先级（BREAKING）
- 运行时业务配置仅来自 `config/app.yaml`（+ secrets 插值）。
- 环境变量仅允许作为“定位入口”，保留：
  - `CRYSTALITH_CONFIG_PATH` / `CRYSTALITH_CONFIG_DIR`
  - `CRYSTALITH_SECRETS_PATH`
- 禁用/移除业务字段 env overrides（例如 `DATABASE_URL`、`REDIS_URL`、`OPENAI_API_KEY`、`OLLAMA_HOST`、`CRYSTALITH_SEARCH__SEARXNG__HOST` 等）。

**Alternatives considered:**
- 保留 env overrides 但“文档化”为不推荐：仍会导致漂移与迁移复杂度，且无法达成“只有 YAML”的目标。
- 从 YAML 生成 `.env`：会把单一真相重新拆成两份，且 compose 的 env 语义与应用配置 schema 不一致。

### 2) Secrets 注入与自动发现
- 默认约定：
  - `config/secrets.yaml`（本地最简单；不提交）
  - 或 Docker secrets 目录（生产更推荐）
- 加载策略（启动时一次性确定）：
  1) 若设置 `CRYSTALITH_SECRETS_PATH`，按现有逻辑读取（YAML 或目录）。
  2) 否则尝试读取与 `config/app.yaml` 同目录的 `secrets.yaml`（若存在）。

### 3) “候选端点 + 探测选择”的自动适配
为了同一份 YAML 同时覆盖 compose 与 host dev，新增候选端点字段并约定探测/锁定策略。

**字段落点（以现有配置结构最小侵入为准）：**
- `database.url_candidates: list[str]`：候选 DB URL（优先容器内，再 host dev 端口）。
- `cache.provider: memory | redis | auto`：
  - `auto` 表示运行时会在候选 Redis 可达时升级为 redis，否则回退 memory。
  - `cache.redis_url_candidates: list[str]`：候选 Redis URL。
- `vector_storage.chroma.endpoint_candidates: list[str]`：
  - 候选值为 `http://host:port` 形式；选择后写入 `vector_storage.chroma.host/port`。
  - 若无可达端点，则回退为 embedded（`host: ""`），保持 `provider: "chroma"`。
- `search.searxng.endpoint_candidates: list[str]`：
  - 支持运行中懒加载：首次使用 search 时按候选顺序探测并锁定可用端点。
- `optional_services.<service>.endpoint_candidates: list[str]`：
  - 用于 `/health/dependencies` 的探活与“操作员可观测性”，与功能侧选择保持一致。

**锁定时机：**
- 启动时定案：database、vector storage、ollama（避免运行中切换导致状态不一致）。
- 运行中懒加载/升级：searxng（按需）、cache（允许从 memory→redis 的升级；失败保持 memory）。

**Alternatives considered:**
- 全部服务都运行中热切换：DB/vector 的连接与状态迁移成本高、风险大。
- 不做候选探测，只靠用户手工改 YAML：无法满足“一份 YAML 跨环境复用”目标。

### 4) Compose overlays 仅负责“装配服务”
- overlays 不再向 `api` 注入业务 env（例如 `DATABASE_URL`、`REDIS_URL`、`OLLAMA_HOST` 等）。
- overlays 仅提供容器、网络与持久化卷；`api` 运行时通过 YAML 的候选端点选择连接。

## Risks / Trade-offs

- [破坏性迁移] 现有依赖 `.env`/env overrides 的部署将失效 → 提供 `_NOTE.md` 迁移文档与逐项对照表；在 PR/发布说明中标记 BREAKING。
- [端点探测误判] 网络暂时抖动导致选择到 fallback → 对启动时定案的服务，探测应具备重试窗口；对懒加载的能力，缓存成功选择并在失败时按策略重试。
- [host.docker.internal 兼容性] Linux 环境不一定可用 → 候选端点优先使用 compose service name 与 127.0.0.1（dev-deps），必要时文档化如何添加额外候选。
- [配置表达复杂度上升] 候选字段增多 → schema 文档与 `config/app.yaml` 示例需明确默认值与推荐候选顺序。

## Migration Plan

1. 将旧 `.env` 中的业务参数迁入：
   - `config/app.yaml`（非敏感）
   - `config/secrets.yaml`（敏感；不提交）
2. 更新部署方式：
   - `.env` 仅保留端口/镜像/构建静态参数
   - compose overlays 只负责启动依赖服务，不再注入业务 env
3. 验收：
   - core-only：无需任何 `.env` 业务项即可启动并通过 `/health`
   - overlays：叠加 overlays 后能自动连接到容器内依赖并通过 `/health/dependencies`
   - host dev + dev-deps：启用 `dev-deps` 后能自动连接到 127.0.0.1 暴露端口的依赖
4. 回滚：
   - 回滚到变更前版本（恢复 env overrides 与 overlays 注入）。

## Open Questions

- （无）本变更明确以“YAML 单一真相”为前提，主动接受破坏性迁移。
