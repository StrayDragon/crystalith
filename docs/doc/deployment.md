# 部署与开发

## 前置依赖

| 工具 | 用途 | 安装 |
|------|------|------|
| [uv](https://docs.astral.sh/uv/) | Python 包管理 | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| [pnpm](https://pnpm.io/) | Node 包管理 | `npm i -g pnpm` |
| [just](https://just.systems/) | 任务运行器 | `cargo install just` 或系统包管理器 |
| [Docker](https://docs.docker.com/) + Compose | 容器运行时 | Docker Desktop 或 `docker-ce` |
| [overmind](https://github.com/DarthSim/overmind) | 进程管理（local/hybrid 模式） | `brew install overmind` 或二进制发布 |

## 快速开始

```bash
cp .env.example .env          # 选择 profile，默认 hybrid
just upsert-env-configs       # 从 shell 环境变量填充 .env 和 config/secrets.yaml
just up                       # 一键启动
```

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

智能 endpoint 解析：`config/app.yaml` 中的 `endpoint_candidates` 列表会根据运行环境自动重排——Docker 内优先 docker-internal 名称，宿主机上优先 localhost。同一份配置全场景通用。

## 运行 Profile

所有模式通过 `just up [profile]` 统一入口启动。

### local — 纯本地开发

后端前端跑在宿主机，热重载最快。不依赖 Docker。

```bash
just up local
```

Procfile 进程：

| 键 | 服务 | 端口 |
|----|------|------|
| `b` | Backend（FastAPI + uvicorn，热重载） | 8032 |
| `f` | Frontend（Vite dev server） | 3000 |
| `s` | Slidev 预览（可选） | 3030 |

不启动依赖也能跑——默认用 SQLite + 内存缓存。

### hybrid — Docker 依赖 + 本地热重载（推荐开发）

Docker 运行依赖服务，应用跑在宿主机。

```bash
just up                # 默认 hybrid
just up hybrid         # 显式指定
```

在 `.env` 中自定义依赖：

```bash
HYBRID_SERVICES=storage redis searxng          # 默认
HYBRID_SERVICES=storage redis searxng ollama   # 加本地 LLM
HYBRID_SERVICES=storage redis                  # 不要搜索
```

### docker — Docker 部署 + 可选外部服务

应用和选定的依赖跑在 Docker 中，其余直连外部服务。

```bash
just up docker
```

在 `.env` 中控制哪些服务用 Docker：

```bash
DOCKER_SERVICES=storage redis searxng    # 默认
DOCKER_SERVICES=redis                    # 只 Redis 用 Docker，其余外部
DOCKER_SERVICES=                         # 全部外部
```

### full — 全 Docker 部署

```bash
just up full
```

### 对比

| | local | hybrid | docker | full |
|---|---|---|---|---|
| 热重载 | 即时 | 即时 | 需 rebuild | 需 rebuild |
| Docker 依赖 | 无 | 仅 deps | 是 | 是 |
| 启动速度 | 快 | 快 | 慢 | 慢 |
| 生产一致性 | 低 | 中 | 高 | 高 |
| 适合场景 | 快速编辑 | 日常开发 | 集成测试 | 演示/生产 |

### 通用操作

```bash
just down              # 停止（自动匹配 profile）
just status            # 查看状态
just logs              # 查看日志
```

---

## 生产部署（高级）

以下内容面向需要直接操作 Docker Compose 的高级用户。一般情况下 `just up docker` 或 `just up full` 已足够。

### Compose 服务名映射

`frontend` → `web`，`backend` → `api`。

### 最小部署（core only）

SQLite + 内存缓存，不需要外部服务。

```bash
docker compose --env-file .env \
  -f deployments/prod/docker-compose.yml \
  up -d --build
```

启动后有 `web`（Nginx，端口 8080）+ `api`（FastAPI）+ `data-init`。

### 推荐部署（core + storage + redis）

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

### 外部替换

每个 overlay 对应的服务都可以换成外部实例，在 `config/app.yaml` 里配：

- storage → `database.url_candidates`，`vector_storage.chroma.endpoint_candidates`
- redis → `cache.redis_url_candidates`
- ollama → `optional_services.ollama.endpoint_candidates`
- searxng → `search.searxng.endpoint_candidates`

endpoint 探测会自动找到可达的服务。

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
| `CRYSTALITH_PROFILE` | 运行 profile | `hybrid` |
| `CRYSTALITH_CONFIG_PATH` | 指定配置文件路径 | 自动发现 `config/app.yaml` |
| `CRYSTALITH_CONFIG_DIR` | 指定配置目录 | — |
| `CRYSTALITH_ENV` | 环境名，用于配置分层 | 由 profile 自动设置 |
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

## 多机同步

在 `~/.bashrc` 或 `~/.zshrc` 中设置环境变量，然后在任意机器上：

```bash
git clone <repo> && cd crystalith
just upsert-env-configs    # 从 shell 环境变量填充配置
just up
```

## 迁移（旧命令映射）

| 旧命令 | 新命令 |
|--------|--------|
| `just dev` | `just up hybrid` |
| `just dev-deps-up` | `just up hybrid`（自动启动 deps） |
| `just dev-docker-up` | `just up docker` |
| `just DEV_OPTIONALS="..." dev-docker-up` | 编辑 `.env` 中 `DOCKER_SERVICES`，然后 `just up docker` |
| `overmind s` | `just up local` |
| `just dev-deps-down` | `just down hybrid` |
| `just dev-docker-down` | `just down docker` |

旧命令已移除。如果你的 `.env` 中存在旧变量（如 `DEV_OPTIONALS`），运行 `just cleanup` 检测并清理。
