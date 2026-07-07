# 快速上手

## 前置依赖

- Python 3.12 + [uv](https://docs.astral.sh/uv/)
- Node 20 + [pnpm](https://pnpm.io/)
- [just](https://just.systems/)（任务运行器）
- [overmind](https://github.com/DarthSim/overmind)（`local` / `hybrid` 模式需要）
- Docker + Compose（`hybrid` / `docker` / `full` 模式需要）

## 1. 初始化配置

```bash
cp .env.example .env
just upsert-env-configs
```

`just upsert-env-configs` 从你的 shell 环境变量中读取常用变量（如 `OPENAI_API_KEY`、`POSTGRES_PASSWORD`），写入 `.env` 和 `config/secret.env`。已有值不会被覆盖。

如果你更喜欢手动配置：

```bash
cp config/secret.env.example config/secret.env
# 编辑 config/secret.env —— 至少设置 OPENAI_API_KEY
```

## 2. 选择 Profile

编辑 `.env` 中的 `CRYSTALITH_PROFILE`，或直接在命令行传入：

| Profile | 命令 | 说明 |
|---------|------|------|
| `local` | `just up local` | overmind 在宿主机启动前后端。无 Docker。SQLite + 内嵌 Chroma。 |
| **`hybrid`** | `just up`（默认） | Docker 运行依赖（Postgres、Chroma、Redis、SearXNG）。前后端在宿主机热重载。 |
| `docker` | `just up docker` | Docker Compose 部署应用 + 选定的依赖。其余服务连接外部。 |
| `full` | `just up full` | 全 Docker Compose 部署，包含所有可选 overlay。 |

## 3. 启动

```bash
just up
```

停止：

```bash
just down
```

查看状态 / 日志：

```bash
just status
just logs
```

## 配置模型

Crystalith 采用 **YAML 优先** 的运行时配置方式：

- `config/app.yaml` — 主配置（可提交，安全默认值）
- `config/secret.env` — 密钥（dotenv，gitignored），供 `{{ secret.VAR }}` 使用
- `.env` — compose/构建参数 + profile 选择 + 非 secret 的模板输入（供 `{{ env.VAR }}` 使用）

配置 overlay 自动发现并 deep-merge：

```
config/app.yaml              ← 基础（已提交）
config/app.local.yaml        ← 本地覆盖（gitignored）
config/app.{env}.yaml        ← 按环境区分（CRYSTALITH_ENV）
config/app.{env}.local.yaml  ← 环境 + 本地
config/secret.env            ← 密钥（dotenv）
```

`config/app.yaml` 中的 endpoint 候选列表会根据运行环境自动重排——Docker 内优先 docker-internal 名称，宿主机上优先 localhost。不同 profile 无需维护不同的配置文件。

## Provider 配置

### OpenAI（直连）

在 shell 中设置 `OPENAI_API_KEY`，然后 `just upsert-env-configs`。或手动编辑 `config/secret.env`。

### OpenAI 兼容端点（代理 / 自建）

```bash
export OPENAI_API_KEY="sk-..."
export OPENAI_BASE_URL="http://llm.internal:50256/v1"
just upsert-env-configs
```

如果你的网关不提供 OpenAI embedding 模型：

```bash
export CRYSTALITH_DEFAULT_EMBEDDING_MODEL="bge-m3-openai"
```

在 Docker 模式下使用 VPN/Tailscale 端点时，在 `.env` 中设置 `BRIDGE_FORWARDS` 和 `OPENAI_BASE_URL`，并将 `host-remap` 加入 `DOCKER_SERVICES`。

## 自定义各 Profile 的服务

在 `.env` 中控制每个 profile 包含的服务：

```bash
CRYSTALITH_PROFILE=hybrid
HYBRID_SERVICES=storage redis searxng        # hybrid 模式的依赖
DOCKER_SERVICES=storage redis searxng        # docker 模式的 overlay
FULL_SERVICES=storage redis searxng slidev
```

可选 overlay：`storage`、`redis`、`searxng`、`slidev`、`host-remap`。

模式 C（Docker + 外部服务）的灵活用法——只保留需要 Docker 运行的服务，其余通过 endpoint 探测自动连接外部：

```bash
CRYSTALITH_PROFILE=docker
DOCKER_SERVICES=redis    # 只有 Redis 用 Docker；数据库/Chroma/SearXNG 连接外部
```

## 访问地址

| 服务 | 开发（local/hybrid） | Docker |
|------|---------------------|--------|
| 前端 | `http://127.0.0.1:3000` | `http://localhost:8080` |
| 后端 API | `http://127.0.0.1:8032` | 通过 Nginx `:8080/v1/` |
| API 文档（Scalar） | `http://127.0.0.1:8032/v1/codev/openapi-ui/scalar` | `http://localhost:8080/v1/codev/openapi-ui/scalar` |

## 工作空间使用技巧

- 命令面板：`Ctrl+K`
- 快捷键帮助：`Ctrl+?`
- 移动端：窄屏（<768px）切换为单面板模式，底部 tab 栏。
- 资料：上传 `.txt`、`.md`、`.pdf` 文件，或使用连接器（Obsidian Vault、本地目录）。
- 健康检查 / 诊断：顶部按钮 → `/health/dependencies`

## 开发工作流

- 后端测试：`cd backend/py && just test`
- 前端测试：`cd frontend/web && pnpm test`
- OpenAPI 变更同步：`just api-sync`
- 配置 schema 重新生成：`cd backend/py && just config-schema`

## 多机同步

在 shell 配置文件（`~/.bashrc`、`~/.zshrc`）中设置环境变量，然后在任意机器上：

```bash
git clone <repo> && cd crystalith
just upsert-env-configs
just up
```

支持的环境变量：`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`POSTGRES_PASSWORD`、`CRYSTALITH_API_KEY`、`JINA_API_KEY`、`FIRECRAWL_API_KEY`、`BROWSERLESS_TOKEN`、`CRYSTALITH_PROFILE`、`CRYSTALITH_DEFAULT_EMBEDDING_MODEL`、`BRIDGE_FORWARDS`。

## 下一步

- `最佳配置` — profile 对比和 YAML 调优
- `部署与开发` — compose overlay、GHCR 镜像、生产注意事项
- `运维手册` — 诊断和 runbook
