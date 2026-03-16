# 最佳配置

## TL;DR

```bash
just up              # hybrid（默认）—— 推荐开发使用
just up local        # 完全不用 Docker
just up docker       # Docker 部署 + 可选外部服务
just up full         # 全部 Docker
```

## Profile 对比

| | local | hybrid | docker | full |
|---|---|---|---|---|
| 热重载 | 即时 | 即时 | 需 rebuild | 需 rebuild |
| 需要 Docker | 否 | 仅依赖 | 是 | 是 |
| 启动速度 | 快 | 快 | 慢（构建） | 慢（构建） |
| 生产一致性 | 低 | 中 | 高 | 高 |
| 适合场景 | 快速编辑、离线 | 日常开发（推荐） | 集成测试 / 预发布 | 演示 / 生产 |

## Profile 详情

### local — 纯本地开发

不依赖 Docker。后端使用 SQLite + 内嵌 Chroma + 内存缓存。

```bash
just up local
```

优点：除 Python/Node 外零依赖，秒级启动。
缺点：无 Postgres、无 Redis、无网页搜索。

如需网页搜索，自行运行 SearXNG 并在 `config/app.yaml` 中设置 `search.searxng.host`。

### hybrid — Docker 依赖 + 本地应用（推荐）

Docker 运行 Postgres、ChromaDB、Redis、SearXNG。前后端在宿主机热重载。

```bash
just up              # 或：just up hybrid
```

在 `.env` 中自定义依赖：

```bash
HYBRID_SERVICES=storage redis searxng          # 默认
HYBRID_SERVICES=storage redis searxng ollama   # 加本地 LLM
HYBRID_SERVICES=storage redis                  # 不要搜索
```

### docker — Docker 部署 + 外部服务

应用在 Docker 中运行。选择哪些依赖包含在 Docker 中，其余通过 endpoint 探测连接外部服务。

```bash
just up docker
```

在 `.env` 中自定义：

```bash
DOCKER_SERVICES=storage redis searxng    # 默认：所有依赖在 Docker
DOCKER_SERVICES=redis                    # 只有 Redis 在 Docker；数据库/Chroma/SearXNG 外部
DOCKER_SERVICES=                         # 无依赖；全部连接外部
```

外部服务通过 `config/app.yaml` 中的 `endpoint_candidates` 自动发现，或在 `config/app.local.yaml` 中覆盖。

### full — 全 Docker 部署

所有服务在 Docker 中运行，包括 Ollama 和 Slidev。

```bash
just up full
```

在 `.env` 中自定义：

```bash
FULL_SERVICES=storage redis searxng ollama slidev    # 默认
```

## 智能 endpoint 解析

所有 profile 共享同一份 `config/app.yaml`。后端会根据运行环境自动重排 endpoint 候选列表：

- **宿主机上**（local/hybrid）：先尝试 `127.0.0.1:5434`，再尝试 `postgres:5432`
- **Docker 内**（docker/full）：先尝试 `postgres:5432`，再尝试 `127.0.0.1:5434`

这意味着你无需为不同环境维护不同的配置文件。

## 推荐 YAML 配置项

`config/app.yaml` 中：

| 设置 | 键 |
|------|-----|
| 数据库 | `database.url_candidates` |
| 向量存储 | `vector_storage.chroma.endpoint_candidates` |
| 缓存 | `cache.redis_url_candidates` |
| 搜索 | `search.searxng.endpoint_candidates` |
| Ollama | `optional_services.ollama.endpoint_candidates` |
| 自动建表 | `app.startup.auto_db_init` |

`.env` 中：

| 设置 | 键 |
|------|-----|
| Profile | `CRYSTALITH_PROFILE` |
| 服务列表 | `HYBRID_SERVICES`、`DOCKER_SERVICES`、`FULL_SERVICES` |
| Web 端口 | `CL_WEB_PORT` |
| 开发依赖端口 | `CL_DEPS_POSTGRES_PORT`、`CL_DEPS_CHROMA_PORT` 等 |
| OpenAI 覆盖（Docker） | `OPENAI_BASE_URL_DOCKER` |
| Embedding 模型（Docker） | `CRYSTALITH_DEFAULT_EMBEDDING_MODEL_DOCKER` |

## 故障排查

- 依赖状态：`GET /health/dependencies` 或 UI 顶部按钮
- 日志：`just logs`（跟随当前 profile）
- 状态：`just status`
- Compose 日志（高级）：`just logs docker` / `just logs hybrid`
