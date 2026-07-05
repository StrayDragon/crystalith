# 01 — 现状盘点

> 数据基于当前仓库（截至调研时点）的实际统计。

## 规模

| 维度 | 数量 | 备注 |
|------|------|------|
| 后端 Python 代码 | ~48k 行（含 1 个 workspace 包 + 17 个插件） | 18 个 feature 模块；共享库已迁至 PyPI `lush-*` |
| 后端 API 端点 | 94 个 | 分布在 25 个 `api*.py` |
| 前端 TS/React 代码 | ~39k 行 | React 19 + Vite，已是 app 本体 |
| 数据模型 | 17 张表 + 11 个 alembic 迁移 | SQLAlchemy 异步，Postgres/SQLite 双支持 |
| 向量存储 | ChromaDB（embedded / http / memory 三后端） | RAG 核心 |
| 缓存 | Redis / 内存两后端 | |
| 测试 | 后端 151 + 前端 30 个测试文件 | 覆盖率门槛 85% |
| 插件 | 17 个官方插件（connectors / extractors / parsers / outputs / slides） | Python entry-points 机制 |
| llmanspec 规范 | 49 specs | llman SDD 工作流（自 openspec 迁移） |

## 当前技术栈（后端）

| 类别 | 依赖 | 用途 |
|------|------|------|
| Web 框架 | FastAPI + uvicorn + lush-fastapix | 路由、依赖注入、OpenAPI |
| 数据层 | SQLAlchemy[asyncio] + aiosqlite + asyncpg + alembic | ORM + 双数据库后端 + 迁移 |
| 校验/模型 | Pydantic + Pydantic Settings | schema、配置 |
| **AI Agent** | **pydantic-ai** | 结构化生成、工具调用、`Agent.run()` |
| **工作流编排** | **pydantic-graph** | 3 个 Graph（Output / Search / Research），`BaseNode` + `run(ctx)` |
| **LLM 框架** | **langchain-community**（仅 SearxSearchWrapper 一处） | SearXNG 搜索包装 |
| LLM 调用 | openai SDK + ollama | OpenAI 兼容 / Ollama provider |
| Token 计数 | tiktoken | context window 管理 |
| 向量库 | chromadb | 持久化 / HTTP / 内存三种 |
| 文档解析 | pypdf / beautifulsoup4 + lxml / (音视频转写调 OpenAI Whisper) | PDF / HTML / media |
| Web 抓取 | trafilatura / jina / firecrawl / browserless(playwright) | 多 extractor 降级链 |
| 缓存 | redis / 内存 | 双后端 |
| 配置 | pyyaml + jinja2 + pydantic-settings | YAML 分层 + 模板渲染 |
| 日志 | structlog（via lush-logx） | 结构化日志 |
| 模板 | jinja2 | output / config 渲染 |
| 进程管理 | overmind + Procfile | local/hybrid profile |
| 部署 | docker-compose × 4 profile × 6 overlay | 复杂度重灾区 |

## 当前技术栈（前端）

| 类别 | 依赖 | 备注 |
|------|------|------|
| 框架 | React 19 + Vite 7 + TypeScript 5 | |
| 状态 | Zustand（sliced stores） + SWR | |
| 样式 | Tailwind CSS + Material Tailwind + MUI icons | |
| 画布/图表 | @xyflow/react / d3-array/d3-scale/d3-shape / gridstack | modular canvas |
| 校验 | Zod + zod-to-json-schema | **后端重写后可前后端共享** |
| 模板 | nunucks | **TS 生态已有对等** |
| API 客户端 | @hey-api/openapi-ts 生成 | 依赖后端 OpenAPI |
| agentic UI | @ag-ui/core + @tambo-ai/react + @modelcontextprotocol/sdk | **已是 TS agentic 生态** |
| 导出 | jspdf + pptxgenjs | |
| 测试 | Vitest + Testing Library + MSW | |

## 痛点定位

部署复杂度的根因（按贡献排序）：

1. **4 个部署 profile × 6 个 overlay** — 面向"多机/多环境/外部服务混合"的 server 化部署，与"桌面 app"定位冲突。
2. **多后端抽象层** — 数据库(Postgres+SQLite)、向量库(Chroma 三模式)、缓存(Redis+内存)、LLM(OpenAI+Ollama) 每个都做了 provider 抽象 + endpoint 自动探测（`endpoint_candidates.py` ~170 行 + `ollama_discovery.py` ~340 行 + 各 factory）。**这是 server 化的代价，桌面 app 不需要。**
3. **Python 服务化打包** — Dockerfile 含 apt 源切换、build-essential、proxy、CN 镜像加速等大量样板。
4. **SDK 多语言生成链路** — Fern + submodule + 版本同步（Py/TS/Go/Rust），维护负担大。
5. **插件系统** — Python entry-points 动态发现，17 个插件各自的 pyproject.toml。

## 关键观察

- 仓库中**已经存在 `local` profile（SQLite + 内嵌 Chroma + 内存缓存、无 Docker）** —— 这正是桌面 app 的理想形态。当前 docker-compose 矩阵是为了"当 server 跑"而存在。
- 前端 39k 行 React **已经是 app 本体**，重写时几乎不动。
- 后端 48k 行中，**很大比例是支撑多后端/多 profile 的胶水代码**，重写时可直接砍掉，真正需翻译的核心逻辑（RAG、agent graphs、各 feature service）约 15-20k 行等价 TS。
