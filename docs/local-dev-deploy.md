# 本地开发与部署（配置 / 模型 / 数据库）

本文件覆盖 Crystalith 的本地开发与部署要点，聚焦配置文件、模型选择与数据库初始化。

## 本地开发

### 后端（FastAPI）

```bash
cd backend/py
uv sync
```

可选：初始化数据库表结构（本地 SQLite / MVP）

```bash
uv run python -c "import asyncio; from crystalith.config import Settings; from crystalith.db import create_all, create_db_manager; s=Settings(); m=create_db_manager(s.database.url); asyncio.run(create_all(m.async_engine))"
```

启动服务：

```bash
uv run --project backend/py uvicorn crystalith.app:create_app --factory --host 127.0.0.1 --port 8000
```

OpenAPI：
- JSON: `http://127.0.0.1:8000/v1/codev/openapi.json`
- UI: `http://127.0.0.1:8000/v1/codev/openapi-ui/scaler`

### 前端（CRA）

```bash
cd frontend/web/react-flow-demo
pnpm install
pnpm start
```

默认通过 `proxy` 访问后端，页面地址通常为 `http://localhost:3000`（或自动切换端口）。

## 配置（YAML Only）

配置文件为 `config/app.yaml`。当该文件存在且 `config/schema.json` 不存在时，后端启动会自动生成 JSON Schema，供 YAML LSP 校验。

示例（请替换为实际 Key 与地址）：

```yaml
# yaml-language-server: $schema=./schema.json
app:
  name: "Crystalith"
  openapi_path: "/v1/codev/openapi.json"
  openapi_ui_path: "/v1/codev/openapi-ui/scaler"

database:
  url: "sqlite+aiosqlite:///./data/app.db"

openai: &openai_default
  api_key: "sk-..."
  base_url: "https://api.openai.com/v1"
  organization: ""
  project: ""

ollama:
  host: "http://localhost:11434"

embedding:
  provider: "ollama" # ollama | openai
  model: "bge-m3:567m"
  openai: *openai_default
  ollama_options:
    num_ctx: 32768
    num_thread: "auto"
    temperature: 0.1
    num_batch: 256
    mlock: true
    numa: true
    low_vram: false

chat:
  provider: "openai" # openai | ollama
  model: "gpt-4o-mini"
  openai: *openai_default

refine:
  formats:
    - paragraph
    - bullets
    - structured
```

说明：
- YAML 配置是当前唯一入口；如需环境变量或多环境切换，请在部署侧生成不同的 `config/app.yaml`。
- `embedding.openai` / `chat.openai` 可覆盖顶层 `openai` 配置（例如不同的 key 或 base_url）。

## 模型（Embedding / Chat）

支持的 provider：
- `ollama`：本地模型服务
- `openai`：OpenAI 兼容接口

默认建议：
- Embedding 使用 Ollama（`bge-m3:567m`）
- Chat 使用 OpenAI（`gpt-4o-mini` 或其他兼容模型）

准备 Ollama 模型：

```bash
ollama pull bge-m3:567m
```

若 chat 使用 Ollama，请确保对应模型已拉取，例如：

```bash
ollama pull qwen2.5:7b
```

## 数据库（SQLite / PostgreSQL）

默认数据库：`sqlite+aiosqlite:///./data/app.db`。

SQLite 本地开发要点：
- 数据库文件会自动创建（`data/` 目录不存在会自动生成）。
- 启动时自动设置 WAL、busy_timeout 等参数以降低锁冲突。

PostgreSQL 部署要点：
- 连接串示例：`postgresql+asyncpg://user:pass@host:5432/crystalith`
- 目前没有迁移工具（Alembic）。可用 `create_all` 生成表结构：

```bash
uv run python -c "import asyncio; from crystalith.config import Settings; from crystalith.db import create_all, create_db_manager; s=Settings(); m=create_db_manager(s.database.url); asyncio.run(create_all(m.async_engine))"
```

## 部署建议（最小化）

1) 准备后端配置：`config/app.yaml`（建议单独存放并通过部署流程写入）。
2) 准备数据库：先建库，再运行 `create_all` 初始化表。
3) 启动后端服务（示例）：

```bash
uv run --project backend/py uvicorn crystalith.app:create_app --factory --host 0.0.0.0 --port 8000
```

4) 前端部署：

```bash
cd frontend/web/react-flow-demo
pnpm install
pnpm run build
```

将 `build/` 部署到静态托管或反向代理（Nginx/S3/OSS）。

## 常见排查

- OpenAI 报错缺少 key：检查 `openai.api_key` 或对应 provider 的覆盖字段。
- Ollama 连接失败：确认 `ollama.host` 和本机服务状态。
- 数据库连接失败：确认 `database.url` 与端口可达，SQLite 路径是否具备写权限。
