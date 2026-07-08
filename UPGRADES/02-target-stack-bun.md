# 02 — 目标技术栈：Bun（附实测数据）

> 决策：重写采用 **Bun runtime + TypeScript 全栈**。2026-07-08 实测验证通过。

---

## 为什么是 Bun

| 特性 | 对本项目的意义 | 实测 |
|------|------|:--:|
| **`bun build --compile`** | 整个后端编译成**单个自包含二进制** | ✅ **75MB**，含 runtime |
| **`bun:sqlite` 内置** | C 绑定的同步 SQLite，零依赖 | ✅ |
| **原生 TypeScript** | `.ts` 直接跑，前后端同语言，schema/类型共享（Zod） | ✅ |
| **内置工具链** | test/watch/env/包管理替代 pytest/uv/nodemon | ✅ |
| **冷启动** | 编译二进制启动 < 1s | ✅ |

---

## Bun `--compile` 实测（2026-07-08）

测试服务器包含：Elysia 路由、sqlite-vec 向量搜索、SSE 流式输出、文件上传、graceful shutdown。

| 测试项 | 结果 |
|--------|:--:|
| 多路由 (GET/POST + Elysia `t.Object()` 校验) | ✅ |
| `bun:sqlite` CRUD | ✅ |
| `sqlite-vec` 向量检索 | ✅ |
| SSE 流式 (`text/event-stream`) | ✅ |
| 文件上传 | ✅ |
| Graceful shutdown (SIGINT/SIGTERM) | ✅ |
| 数据持久化（SQLite 文件落地） | ✅ |
| **二进制大小** | **75MB** |
| **外部依赖** | **0**（全部内嵌） |
| **Bun 版本** | 1.3.14 |

### 与 Python 栈的定量对比

| 维度 | Python (FastAPI + ChromaDB) | Bun (Elysia + sqlite-vec) |
|------|------|------|
| **分发产物** | 894MB venv + Python runtime | **1 个文件, 75MB** |
| **依赖文件数** | 13,207 `.py` + 88 native `.so` | **0**（全在二进制内） |
| **分散安装步骤** | `pip install` + `uv sync` + DB init | **`./crystalith-server` 即启动** |
| **跨平台 CI 复杂度** | 每平台编译 native 扩展 | GHA matrix, `bun build --compile --target=...` |
| **类型系统** | Pydantic (server-only) | **Zod 前后端共享** |
| **API 客户端生成** | @hey-api/openapi-ts（需 OpenAPI） | **Elysia eden 推断（零生成）** |
| **内置 SQLite** | 需 `aiosqlite` | ✅ `bun:sqlite` C 绑定 |
| **内置向量库** | 需 ChromaDB (外部进程或嵌入) | ✅ `sqlite-vec` 同库扩展 |
| **AI Agent** | pydantic-ai + pydantic-graph | ✅ AI SDK `streamText` + `maxSteps` |
| **Token 计数** | tiktoken (Rust 扩展) | ✅ gpt-tokenizer (纯 JS) |
| **模板渲染** | jinja2 | ✅ Nunjucks（前端已在用） |

**结论：Bun 栈在分发体积、部署复杂度、开发体验三个维度全面优于 Python 栈。**

---

## 目标技术栈映射

| 角色 | 选型 | 理由 |
|------|------|------|
| Runtime + 打包 | **Bun** | `--compile` 单二进制分发，已验证 |
| Web framework | **Elysia** | 端到端类型推断、内建校验、`@elysiajs/eden` 干掉 OpenAPI 生成链路 |
| ORM | **Drizzle ORM** | 原生 `drizzle-orm/bun-sqlite` 驱动，Drizzle Kit 迁移 |
| 向量库 | **sqlite-vec** | 业务库 + 向量库**同库**，零外部依赖。已 benchmark（10k chunk 8ms） |
| Schema 校验 | **Zod**（前后端共享） | 前端已在用，Elysia 也内建 |
| AI / Agent | **Vercel AI SDK** (`ai` + `@ai-sdk/*`) | Provider 抽象 + Agent Loop + 结构化输出 + 流式 |
| Token 计数 | **gpt-tokenizer** | 纯 JS，无 wasm |
| PDF 解析 | **unpdf**（基于 pdf.js） | ⚠️ 头号技术风险，已 spike 验证通过 |
| HTML 解析 | **linkedom** / cheerio | |
| Web 抓取 | Jina Reader + Firecrawl JS SDK + Playwright | 砍 trafilatura/browserless |
| 模板渲染 | **Nunjucks**（前端已在用） | output/config 渲染 |
| 日志 | **consola** | unjs 生态，Bun 友好 |
| 桌面分发 | **Tauri v2 + Bun sidecar**（后置） | 桌面 app 包装 |

---

## 分发架构

| 方案 | 产物 | 大小 | 何时做 |
|------|------|------|------|
| **B. tar.gz 一体包**（先做） | binary + public/ + config/ | ~85MB | Phase 0 |
| **A. Tauri 桌面 app**（后做） | `.dmg` / `.exe` / `.AppImage` | ~90MB | Phase 4 |
| **C. Docker 部署** | server + nginx 镜像 | ~100MB | Phase 4（可选） |

**同一个 Bun 二进制，Tauri 调用是桌面 app，直接跑是 headless server。两者不需要分别构建。**

Tauri sidecar 自动启动 server：

```
用户双击 app → Tauri shell 起
  → 找空闲端口
  → spawn crystalith-server --port {port}
  → 轮询 /api/health → 200
  → Webview 导航 http://127.0.0.1:{port}

用户关窗 → Tauri 发 SIGTERM → server graceful shutdown
```

详见 [12-distribution-strategy.md](./12-distribution-strategy.md) + [10-tauri-sidecar-packaging.md](./10-tauri-sidecar-packaging.md)

---

## 砍掉的复杂度

桌面 app 不需要的，直接从 Python 代码迁移时不写：

- ✂️ 4 个部署 profile + Procfile + overmind
- ✂️ 6 个 docker-compose overlay
- ✂️ 多数据库后端（Postgres）→ 只留 SQLite
- ✂️ 多向量库后端（chroma http/embedded/memory）→ 只留 sqlite-vec
- ✂️ 多缓存后端（redis）→ 内存缓存
- ✂️ 配置 overlay 分层 → Nunjucks + YAML（保留 Jinja2 体验）
- ✂️ endpoint_candidates 自动探测 → 静态 localhost
- ✂️ HTTP rate limit / guardrails / auth → 桌面 app 本地访问不需要
- ✂️ SDK 多语言生成（Py/TS/Go/Rust + Fern）
- ✂️ Python 插件 entry-points 框架

## Bun 的风险（均可控）

| 风险 | 实测 | 应对 |
|------|:--:|------|
| PDF 解析质量 | ✅ unpdf 验证通过 | 见 [09-pdf-benchmark.md](./09-pdf-benchmark.md) |
| bun:sqlite 同步阻塞 | — | 单用户桌面 app 无所谓 |
| Node 原生模块兼容性 | ✅ 主流库全过 | Drizzle/AI SDK/Elysia/pdfjs/Playwright 均正常 |
| Elysia 生态年轻 | — | 备选 Hono |
| `--compile` 功能稳定 | ✅ | 1.3.14，多路由/sse/sqlite-vec 全部通过 |
