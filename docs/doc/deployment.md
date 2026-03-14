# 部署与开发

## 前置依赖

| 工具 | 用途 | 安装 |
|------|------|------|
| [uv](https://docs.astral.sh/uv/) | Python 包管理 | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| [pnpm](https://pnpm.io/) | Node 包管理 | `npm i -g pnpm` |
| [just](https://just.systems/) | 任务运行器 | `cargo install just` 或系统包管理器 |
| [Docker](https://docs.docker.com/) + Compose | 容器运行时 | Docker Desktop 或 `docker-ce` |
| [overmind](https://github.com/DarthSim/overmind) | 进程管理（可选） | `brew install overmind` 或二进制发布 |

## 配置体系

YAML 分层配置，后面的文件 deep-merge 覆盖前面的：

```
config/app.yaml                ← 基础配置（已提交，安全默认值）
config/app.local.yaml          ← 本地覆盖（gitignored，自动合并）
config/app.{env}.yaml          ← 按环境区分（通过 CRYSTALITH_ENV 指定）
config/app.{env}.local.yaml    ← 环境 + 本地覆盖
config/secrets.yaml            ← 密钥（gitignored，自动发现）
```

只需要写差异部分，不用复制整个 `app.yaml`。

变量插值：
- `${{ secrets.VAR }}` — 从 `config/secrets.yaml` 解析，用于 API key、密码
- `${{ env.VAR }}` — 从环境变量解析，用于运行时动态值（如 `OPENAI_BASE_URL`）

## 通用准备

```bash
cd backend/py && uv sync
cd ../../frontend/web && pnpm install
cd ../..

cp config/secrets.yaml.example config/secrets.yaml
# 编辑 secrets.yaml，至少填 OPENAI_API_KEY

cp .env.example .env  # compose 参数，可选
```

---

## 本地开发

三种模式，按日常使用频率排列。

### Procfile + overmind

后端前端跑在宿主机，热重载最快。不依赖 Docker 运行应用本身。

```bash
overmind s            # 启动全部（backend + frontend + slidev）
overmind s -l b,f     # 只启动 backend + frontend
```

Procfile 进程：

| 键 | 服务 | 端口 |
|----|------|------|
| `b` | Backend（FastAPI + uvicorn，热重载） | 8032 |
| `f` | Frontend（Vite dev server） | 3000 |
| `s` | Slidev 预览（可选） | 3030 |

需要外部依赖（Postgres、ChromaDB、Redis、SearXNG）时：

```bash
just dev-deps-up      # 启动依赖容器
overmind s -l b,f     # 应用跑在宿主机
```

不启动依赖也能跑——默认用 SQLite + 内存缓存。

### just dev

和 overmind 类似，用 `just` 代替：

```bash
just dev              # dev-deps-up → dev-backend（后台）→ dev-frontend
# 或分开：
just dev-deps-up
just dev-backend
just dev-frontend
```

### 全容器模式

全部跑在容器里，迭代慢但接近生产环境。

```bash
just dev-docker-up                                          # core + storage + redis + searxng
just dev-docker-logs                                        # 跟踪日志
just dev-docker-rebuild api                                 # 重建单个服务
just dev-docker-down                                        # 停止
just DEV_OPTIONALS="storage redis searxng ollama" dev-docker-up  # 自定义 overlay
```

### 对比

| | Procfile (overmind) | just dev | 全容器 |
|---|---|---|---|
| 热重载 | 即时 | 即时 | 需要 rebuild |
| 外部依赖 | 手动或 `dev-deps-up` | `dev-deps-up` 自动 | 全在容器内 |
| 启动速度 | 快 | 快 | 慢（构建） |
| 生产一致性 | 低 | 低 | 高 |
| 适合场景 | 日常编码 | 日常编码 | 集成测试 |

---

## 生产部署

Compose 服务名映射：`frontend` → `web`，`backend` → `api`。

部署走 Docker Compose 的 `-f` 合并，核心栈 + 按需叠加 overlay。

### 最小部署（core only）

SQLite + 内存缓存，不需要外部服务。

```bash
docker compose --env-file .env \
  -f deployments/prod/docker-compose.yml \
  up -d --build
```

启动后有 `web`（Nginx，端口 8080）+ `api`（FastAPI）+ `data-init`。

默认镜像只包含核心功能。PDF/HTML 解析、URL 提取、Source Connectors 等在 official 插件里，需要的话构建时安装 `crystalith[official-full]`（或按需安装 `official-parsers` / `official-extractors` / `official-connectors`）。

对于基于本地文件系统的连接器（如 Obsidian vault、Local Directory），还需要把宿主机目录挂载到 `api` 容器里，并在连接参数里填写**容器内路径**（建议 `:ro` 只读挂载）。

### 推荐部署（core + storage + redis）

PostgreSQL + ChromaDB 持久存储，Redis 缓存。

```bash
docker compose --env-file .env \
  -f deployments/prod/docker-compose.yml \
  -f deployments/prod/docker-compose.storage.yml \
  -f deployments/prod/docker-compose.redis.yml \
  up -d --build
```

### 全功能部署

```bash
docker compose --env-file .env \
  -f deployments/prod/docker-compose.yml \
  -f deployments/prod/docker-compose.storage.yml \
  -f deployments/prod/docker-compose.redis.yml \
  -f deployments/prod/docker-compose.searxng.yml \
  -f deployments/prod/docker-compose.ollama.yml \
  up -d --build
```

### 使用 GHCR 预构建镜像

不想本地构建的话，拉 GHCR 上的版本镜像。建议用精确版本号 `X.Y.Z`，别用 `latest`。

```bash
export OWNER="<github-org-or-user>"
export VERSION="X.Y.Z"

docker pull "ghcr.io/${OWNER}/crystalith-api:${VERSION}"
docker pull "ghcr.io/${OWNER}/crystalith-web:${VERSION}"

docker network create crystalith-net >/dev/null 2>&1 || true

docker run -d --name crystalith-api --network crystalith-net --network-alias api \
  -e CRYSTALITH_OPTIONAL_SERVICES_MONITOR_ENABLED=0 \
  -v "$PWD/data:/app/data" \
  -v "$PWD/config:/app/config:ro" \
  -p 8032:8032 \
  "ghcr.io/${OWNER}/crystalith-api:${VERSION}"

docker run -d --name crystalith-web --network crystalith-net \
  -p 8080:8080 \
  "ghcr.io/${OWNER}/crystalith-web:${VERSION}"
```

清理：`docker rm -f crystalith-web crystalith-api && docker network rm crystalith-net`

### 构建备注（中国镜像）

Dockerfile 默认可能使用国内镜像加速。CI 中自动关闭。本地关闭：`USE_CN_MIRROR=0 docker compose ... --build`。

拉 GHCR 镜像慢的话临时设代理：`HTTPS_PROXY=http://127.0.0.1:20171 docker pull ...`，构建时不要带代理。

---

## 可选 Overlay

| Overlay | Compose 文件 | 用途 |
|---------|-------------|------|
| storage | `docker-compose.storage.yml` | PostgreSQL + ChromaDB |
| redis | `docker-compose.redis.yml` | Redis 缓存 |
| searxng | `docker-compose.searxng.yml` | SearXNG 网页搜索 |
| ollama | `docker-compose.ollama.yml` | 本地 Ollama LLM |
| slidev | `docker-compose.slidev.yml` | Slidev 幻灯片预览 |
| host-remap | `docker-compose.host-remap.yml` | VPN/Tailscale 端口转发 |

所有 overlay 文件在 `deployments/prod/` 下。

用 `just` 快捷操作：

```bash
just DEV_OPTIONALS="storage" dev-docker-up
just DEV_OPTIONALS="storage redis searxng ollama" dev-docker-up
just DEV_OPTIONALS="storage redis" dev-docker-down
```

### 外部替换

每个 overlay 对应的服务都可以换成外部实例，在 `config/app.yaml` 里配：

- storage → `database.url` / `database.url_candidates`，`vector_storage.chroma.host/port`
- redis → `cache.provider: redis|auto`，`cache.redis_url` / `cache.redis_url_candidates`
- ollama → `optional_services.ollama.endpoint_candidates`
- searxng → `search.searxng.host` / `search.searxng.endpoint_candidates`

### slidev 补充

启用 slidev overlay 时，API 镜像默认安装 `official-slides` 插件。可通过 `CRYSTALITH_BACKEND_EXTRAS` 覆盖。

---

## 端口参考

| 服务 | 开发端口 | 生产端口 | 备注 |
|------|---------|---------|------|
| Frontend (Vite) | 3000 | — | 仅开发 |
| Frontend (Nginx) | — | 8080 | 反向代理 `/v1/` 到 API |
| Backend API | 8032 | 8032（内部） | 生产通过 Nginx 访问 |
| PostgreSQL | 5434 | 5432（内部） | |
| ChromaDB | 8001 | 8000（内部） | |
| Redis | 6380 | 6379（内部） | |
| SearXNG | 50201 | 8080（内部） | |
| Ollama | 11434 | 11434（内部） | |
| Slidev | 3030 | 3030 | 可选 |

## 环境变量

| 变量 | 用途 | 默认值 |
|------|------|--------|
| `CRYSTALITH_CONFIG_PATH` | 指定配置文件路径 | 自动发现 `config/app.yaml` |
| `CRYSTALITH_CONFIG_DIR` | 指定配置目录 | — |
| `CRYSTALITH_ENV` | 环境名，用于配置分层（`dev`、`staging`、`prod`） | — |
| `CRYSTALITH_SECRETS_PATH` | 指定密钥文件/目录路径 | 自动发现 `config/secrets.yaml` |
| `OPENAI_BASE_URL` | 覆盖 OpenAI 兼容 API 端点 | `https://api.openai.com/v1` |
| `CRYSTALITH_DEFAULT_EMBEDDING_MODEL` | 覆盖默认 embedding 模型 ID | 第一个 `embed` 角色模型 |

## 验证

```bash
curl http://localhost:8080/health
curl http://localhost:8080/health/dependencies
curl http://localhost:8080/v1/models
```

Smoke test：

```bash
just dev-docker-smoke
just composition-smoke
```

## 安全

- 不要提交 `config/secrets.yaml` 和带真实凭据的 `.env`
- API 默认无认证。公网暴露前在配置里开启 `app.auth.enabled: true`
- URL 抓取默认启用 SSRF 防护（`source_ingestion.url_fetch.security`）

## 迁移（旧命令映射）

| 旧命令 | 新命令 |
|--------|--------|
| `just dev-up` | `just dev-docker-up` |
| `just dev-down` | `just dev-docker-down` |
| `just dev-ps` | `just dev-docker-ps` |
| `just dev-logs` | `just dev-docker-logs` |
| `just dev-rebuild <svc>` | `just dev-docker-rebuild <svc>` |
| `just dev-smoke` | `just dev-docker-smoke` |
| `CRYSTALITH_OLLAMA_MONITOR_*` | `CRYSTALITH_OPTIONAL_SERVICES_MONITOR_*` |

回滚到旧的"全依赖启动"行为：`just DEV_OPTIONALS="storage redis searxng ollama slidev" dev-docker-up`
