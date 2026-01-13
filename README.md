# Crystalith

面向深度研究与学习的三栏工作台：左侧来源/引用，中间聊天，右侧提炼输出。当前 MVP 仅支持 txt/markdown 文档与基础问答 + 提炼。

## 本地开发

详细配置、模型选择与数据库初始化说明见 `docs/local-dev-deploy.md`。

### 1) 后端 (FastAPI)

```bash
cd backend/py
uv sync
```

可选：初始化 SQLite 表结构（MVP / 本地）

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

### 2) 前端 (CRA)

```bash
cd frontend/web/react-flow-demo
pnpm install
pnpm start
```

默认通过 `proxy` 访问后端，页面地址通常为 `http://localhost:3000` 或自动切换端口。

## 配置 (YAML Only)

配置文件：`config/app.yaml`，会自动生成 `config/schema.json` 供 YAML LSP 校验。

示例（请替换为实际 Key 与地址）：

```yaml
# yaml-language-server: $schema=./schema.json
openai: &openai_default
  api_key: "sk-..."
  base_url: "http://your-openai-base-url/v1"
ollama:
  host: "http://localhost:11434"
embedding:
  provider: "ollama"
  model: "bge-m3:567m"
  ollama_options:
    num_ctx: 32768
    num_thread: "auto"
    temperature: 0.1
    num_batch: 256
    mlock: true
    numa: true
    low_vram: false
chat:
  provider: "openai"
  model: "gpt-5.2"
  openai: *openai_default
```

## 模型准备

```bash
ollama pull bge-m3:567m
```

## 说明

- 默认 SQLite（开发），生产建议 PostgreSQL。
- 仅支持 txt/markdown 上传与索引。
- 前端会自动尝试连接后端；失败时进入演示模式。
- 提炼输出需在右侧手动触发，可多次加入队列生成。
