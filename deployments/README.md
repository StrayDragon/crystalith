# deployments（Docker Compose 部署清单）

> TL;DR：Docker Compose 文件目录，按"prod（应用部署）/ dev（开发依赖）/ test（测试）"分层，并用 overlay 文件启用可选服务（storage/redis/searxng/slidev/host-remap）。统一入口由 `scripts/orchestrate.sh` 与 `scripts/dev_compose.sh` 驱动（根目录命令：`justfile:up/down/status/logs`）。

## Scope（责任边界）

### 做什么
- `deployments/prod/`：生产/部署 Compose（core + overlays），主文件：`deployments/prod/docker-compose.yml`。
- `deployments/dev/`：开发依赖 Compose（给 hybrid profile 用），core 文件：`deployments/dev/docker-compose.deps.yml`，实际服务由 `deployments/dev/docker-compose.deps.<overlay>.yml` 提供。
- `deployments/test/`：测试用 Compose（目前提供 Postgres 测试实例：`deployments/test/docker-compose.yml`）。
- `deployments/searxng/`：SearXNG 配置（`deployments/searxng/settings.yml`）。

### 不做什么
- 不包含 Dockerfile（见 `dockers/`）。
- 不承载业务配置（SSOT 在 `config/app.yaml`；迁移说明：`deployments/_NOTE.md`）。

### 典型使用场景
- 启动完整 docker 部署：`just up docker` 或 `just up full`（入口：`justfile:up` → `scripts/orchestrate.sh`）。
- 启动 hybrid（宿主热重载 + 容器化依赖）：`just up`（默认 profile=hybrid，见 `.env.example`）。
- 只起依赖（dev deps）：由 `scripts/dev_compose.sh deps up` 执行（被 `scripts/orchestrate.sh` 调用）。

## Integration（与项目的关系）

### 与脚本/构建的关系
- `just up` → `scripts/orchestrate.sh`（profiles：local/hybrid/docker/full）→ `scripts/dev_compose.sh`（mode：deps/prod）→ `deployments/**/docker-compose*.yml`（证据：`justfile:up` + `scripts/orchestrate.sh` + `scripts/dev_compose.sh`）。
- `deployments/prod/docker-compose.yml` 会 build：
  - `dockers/frontend/Dockerfile`（web）
  - `dockers/backend/Dockerfile`（api）
  （证据：`deployments/prod/docker-compose.yml:services.web.build` + `services.api.build`）

### 与 config/data 的关系
- `api` 容器挂载：
  - `../../config:/app/config:ro`（只读）与 `../../data:/app/data`（读写）（证据：`deployments/prod/docker-compose.yml:services.api.volumes`）。
- `data-init` 负责创建 `data/output/preview` 并修复权限（证据：`deployments/prod/docker-compose.yml:services.data-init`）。

### 依赖关系图
~~~text
just up (root justfile) --> scripts/orchestrate.sh --> scripts/dev_compose.sh
                                        |
                                        +--> deployments/dev/*   (hybrid: deps only)
                                        +--> deployments/prod/*  (docker/full: app + overlays)
                                                    |
                                                    +--> builds dockers/* images
                                                    +--> mounts config/ + data/
~~~

## Overlay 与文件映射（证据来自 `.env.example` 与 compose 文件）
`.env.example` 声明 overlays：`storage redis searxng slidev host-remap`（`.env.example`）。

| Overlay | prod 文件 | 主要服务/效果（已知） |
| --- | --- | --- |
| core | `deployments/prod/docker-compose.yml` | `web`(nginx) + `api`(fastapi) + `data-init`（`deployments/prod/docker-compose.yml`） |
| storage | `deployments/prod/docker-compose.storage.yml` | `postgres` + `chromadb`，并让 `api` depends_on 它们（`deployments/prod/docker-compose.storage.yml`） |
| redis | `deployments/prod/docker-compose.redis.yml` | `redis`，并让 `api` depends_on（`deployments/prod/docker-compose.redis.yml`） |
| searxng | `deployments/prod/docker-compose.searxng.yml` | `searxng`（无默认端口暴露），挂载 `deployments/searxng/settings.yml`（`deployments/prod/docker-compose.searxng.yml`） |
| slidev | `deployments/prod/docker-compose.slidev.yml` | `slidev`（端口 `CL_SLIDEV_PORT`），并为 `api` build args 设置 `CRYSTALITH_BACKEND_EXTRAS=official-slides`（`deployments/prod/docker-compose.slidev.yml`） |
| host-remap | `deployments/prod/docker-compose.host-remap.yml` | `host-remap`（socat 转发，使用 `BRIDGE_FORWARDS`；`network_mode: host`）（`deployments/prod/docker-compose.host-remap.yml`） |

dev deps overlays（hybrid 模式依赖）：
- core：`deployments/dev/docker-compose.deps.yml`（空 services 骨架）
- storage：`deployments/dev/docker-compose.deps.storage.yml`（Postgres+Chroma，端口由 `CL_DEPS_*` 控制）
- redis：`deployments/dev/docker-compose.deps.redis.yml`
- searxng：`deployments/dev/docker-compose.deps.searxng.yml`

## Core Logic（核心概念与核心数据流）

### 术语表
- profile：`local` / `hybrid` / `docker` / `full`（`scripts/orchestrate.sh` + `.env.example`）。
- mode：`deps`（dev 依赖）/ `prod`（部署） （`scripts/dev_compose.sh`）。
- overlay：附加 compose 文件（`scripts/dev_compose.sh:build_file_list` + `.env.example`）。
- healthcheck：compose 内置健康检查（例如 `api` 检查 `/health`：`deployments/prod/docker-compose.yml`）。

### 主流程（推荐路径）
1. 配置 profile：`.env` 中 `CRYSTALITH_PROFILE`（默认模板：`.env.example`）。
2. `just up [profile]`：
   - `local`：`overmind start -f Procfile`（证据：`scripts/orchestrate.sh:do_up` + `Procfile`）
   - `hybrid`：先 `scripts/dev_compose.sh deps up` 起依赖，再 wait_ready，最后 `overmind start`（证据：`scripts/orchestrate.sh` + `scripts/wait_ready.sh`）
   - `docker/full`：`scripts/dev_compose.sh prod up`，用 prod compose + overlays 部署（证据：`scripts/orchestrate.sh` + `scripts/dev_compose.sh`）
3. 可选检查：
   - `just dev-docker-smoke`（HTTP `/health`、`/v1/models`、`/health/dependencies`）（证据：`justfile:dev-docker-smoke`）
   - `just composition-smoke`（证据：`justfile:composition-smoke` + `scripts/composition_smoke.sh`）

### 重要边界条件
- 配置 SSOT：`deployments/_NOTE.md` 明确 legacy env overrides 不再支持，只有 `CRYSTALITH_CONFIG_PATH/CRYSTALITH_CONFIG_DIR` 这种“定位类 env”受支持。
- searxng 端口冲突处理（dev deps）：`scripts/dev_compose.sh` 在 deps up 时会探测 `CL_DEPS_SEARXNG_PORT` 是否已被真实 SearXNG 占用，若是则跳过 overlay（见 `scripts/dev_compose.sh` deps 分支）。

## Dev / Run / Test（开发者使用指南）
```bash
# repo root：统一入口
just up [local|hybrid|docker|full]         # 依据：justfile:up + scripts/orchestrate.sh
just down [local|hybrid|docker|full]       # 依据：justfile:down
just status [profile]                      # 依据：justfile:status
just logs [profile] -- <args...>           # 依据：justfile:logs
```

```bash
# 手动 compose wrapper（会创建/停止容器；谨慎执行）
bash scripts/dev_compose.sh prod up
bash scripts/dev_compose.sh deps up
```

## Config / Observability（配置与可观测性）
- `.env` 关键变量（模板与说明：`.env.example`）：
  - `CRYSTALITH_PROFILE`、`HYBRID_SERVICES`、`DOCKER_SERVICES`、`FULL_SERVICES`
  - 端口：`CL_WEB_PORT`、`CL_DEPS_POSTGRES_PORT`、`CL_DEPS_CHROMA_PORT`、`CL_DEPS_REDIS_PORT`、`CL_DEPS_SEARXNG_PORT`
- `api` 容器环境变量（示例：`deployments/prod/docker-compose.yml:x-api-env`）：
  - `HOST/PORT/RELOAD`、`CRYSTALITH_ENV=docker`、`OPENAI_BASE_URL`、`CRYSTALITH_DEFAULT_EMBEDDING_MODEL`
- 健康检查入口：
  - 后端：`/health`、`/health/dependencies`（实现：`backend/py/src/crystalith/web/app.py:create_app`）
  - SearXNG：`/search?q=&format=json`（JSON 格式在 `deployments/searxng/settings.yml` 开启）

## Roadmap（未来方向与优化建议）
- 近期（1–2 周）
  - 把 overlays 与配置 `*_candidates` 的对应关系做成一页表（动机：少猜；收益：更快配置；风险：维护；方案：以 `deployments/prod/docker-compose.*.yml` + `config/app.yaml:*_candidates` 交叉生成 docs）。
  - 为 `hybrid` 增加更明确的故障提示（动机：端口冲突/服务未起常见；收益：少排障；风险：脚本复杂；方案：扩展 `scripts/orchestrate.sh` 的 wait_for_deps 日志与错误提示）。
- 中期（1–2 月）
  - 增强 compose 日志/资源限制可配置化（动机：不同机器差异；收益：更稳；风险：参数膨胀；方案：沿用 `deployments/prod/docker-compose.yml` 的 `x-deploy-*` 与 `.env.example` 增加说明与可选覆盖）。
  - 为 `test/` compose 增加更多依赖的可选支持（动机：CI/本地回归更贴近 prod；收益：更稳；风险：维护成本；方案：以 `deployments/test/docker-compose.yml` 为基线增量扩展）。
- 长期（季度+）
  - 把 profile 的“能力矩阵/降级模式”纳入 llmanspec 并形成回归门（动机：一致性；收益：更少行为漂移；风险：需要测试/文档投入；方案：在 `llmanspec/specs/` 增加 capability matrix，并在 `just check` 中引入对应验证）。

## Assumptions / TODO to Verify（已知未知）
- 是否存在额外的 overlay 名称（除 `.env.example` 列出的）：从 `deployments/prod/docker-compose.*.yml` 与 `deployments/dev/docker-compose.deps.*.yml` 的文件集合核对。
- `host-remap` 的使用场景与默认示例（BRIDGE_FORWARDS）：从 `deployments/prod/docker-compose.host-remap.yml` 与相关文档（如 `docs/doc/deployment.md`）确认。
