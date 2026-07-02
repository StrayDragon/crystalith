# 02 — 目标技术栈：Bun

> 决策：重写采用 **Bun runtime + TypeScript 全栈**。这是针对"方便分发的 app"目标的最优选择。

## 为什么是 Bun（三个杀手锏）

| 特性 | 对本项目的意义 |
|------|------|
| **`bun build --compile`** | 把整个后端编译成**单个自包含二进制**（含 runtime，~50MB）。分发 = 发一个文件。**直接消灭 Python 部署复杂度的根源。** |
| **`bun:sqlite` 内置** | C 绑定的同步 SQLite，零依赖、零编译。桌面 app 的本地存储不需要任何额外安装。 |
| **原生 TypeScript** | `.ts` 直接跑，无需 tsc/编译步骤；前后端同语言，schema/类型可共享（Zod）。 |

其他加分：内置测试/watch/env/包管理（替代 pytest/uv/nodemon 一堆工具链）、与 Node API 高度兼容、冷启动快。

## 目标技术栈映射

| 角色 | 选型 | 理由 / 备选 |
|------|------|------|
| Runtime + 打包 | **Bun** | 单二进制分发 |
| Web framework | **Elysia** | 端到端类型推断、校验内建、`@elysiajs/eden` 给前端类型安全 RPC（可干掉 OpenAPI 生成链路）。备选：Hono（更轻、生态广）。 |
| ORM | **Drizzle ORM** | 原生 `drizzle-orm/bun-sqlite` 驱动，迁移工具 Drizzle Kit 成熟。备选：Kysely。 |
| 向量库 | **sqlite-vec**（bun:sqlite 扩展） | 业务库 + 向量库**同库**，零外部依赖。备选：LanceDB（native TS）、Qdrant。 |
| Schema 校验 | **Zod**（前端已在用） | 前后端共享类型；Elysia 也内建校验可选用 |
| AI / Agent | **Vercel AI SDK** (`ai` + `@ai-sdk/*`) | Provider 抽象 + Agent Loop + 结构化输出 + 流式，统一 AI 层。详见 [03-ai-ecosystem-mapping.md](./03-ai-ecosystem-mapping.md) + [06-ai-sdk-integration.md](./06-ai-sdk-integration.md) |
| Token 计数 | **gpt-tokenizer** | 纯 JS，无 wasm。备选：`tiktoken`（wasm）。 |
| PDF 解析 | **unpdf**（基于 pdf.js）/ pdfjs-dist | ⚠️ **头号技术风险**，须 spike |
| HTML 解析 | **linkedom** / cheerio | |
| Web 抓取 | Jina Reader（HTTP）+ Firecrawl（JS SDK）+ Playwright（原生 Node） | 砍 trafilatura/browserless |
| 模板渲染 | **Nunjucks**（前端已在用） | output/config 渲染 |
| LLM 调用 | **AI SDK `@ai-sdk/*`** provider 包 | 统一通过 AI SDK 调用所有模型（OpenAI / Anthropic / Ollama / Google / …），不直接依赖底层 SDK | |
| 桌面 shell | 见下「分发架构」 | |

## 分发架构选择

| 方案 | 体验 | 复杂度 | 说明 |
|------|------|------|------|
| **B. Bun 单二进制 + 前端静态嵌入**（先做） | 启动本地 server，浏览器/内嵌 webview 访问 | 低 | **前端几乎零改动**，只换 API 客户端 |
| **A. Tauri + Bun sidecar**（后做） | 真桌面 app（.dmg/.exe/.AppImage），自动更新，系统托盘 | 中 | 在方案 B 跑通后包装 |
| ~~C. 纯 Web 部署~~ | 回到 server 部署问题 | — | 违背初衷，否决 |

**推荐路径**：先方案 B 快速验证（Bun 编译二进制 + 现有 React 前端 `dist/` 静态嵌入），跑通后再用 Tauri 包装成方案 A。

> 为什么不是 Electron：体积大（~150MB vs Tauri ~10MB vs Bun 二进制 ~50MB），与"轻量分发"目标不契合。

## Bun 的风险点（都可控）

1. **PDF 解析质量** — unpdf 对真实样本够不够好，**必须最先 spike**。这是唯一可能导致方案破产的点。
2. **bun:sqlite 是同步阻塞** — 单用户桌面 app 无所谓；未来要多用户并发再换 libsql/wasm。
3. **个别 Node 原生模块兼容性** — 主流生态（Drizzle/AI SDK/Elysia/pdfjs/Playwright）都良好，冷门库要验证。
4. **Elysia 生态相对年轻** — 若担心可退回 Hono（更稳，牺牲一些端到端类型推断）。

## 砍掉的复杂度（重写时直接丢弃）

这些是支撑"多后端/多部署/server 化"的，桌面 app 全部不需要：

- ✂️ 4 个部署 profile + Procfile + overmind
- ✂️ 6 个 docker-compose overlay（storage/redis/searxng/ollama/slidev/host-remap）
- ✂️ 多数据库后端（Postgres）→ 只留 SQLite
- ✂️ 多向量库后端（chroma http/embedded/memory）→ 只留 sqlite-vec
- ✂️ 多缓存后端（redis）→ 内存/本地文件
- ✂️ 配置 overlay 分层（app.yaml + app.local.yaml + app.{env}.yaml + secret.env 模板渲染）→ 单个 JSON/TOML
- ✂️ endpoint_candidates 自动探测重排（~500 行）→ 静态 localhost
- ✂️ HTTP rate limit / guardrails / auth（面向公网 server）→ 桌面 app 本地访问不需要
- ✂️ SDK 多语言生成（Py/TS/Go/Rust + Fern + submodule）
- ✂️ SearXNG 集成（随 Research 一起砍，见 04）
- ✂️ Python 插件 entry-points 框架 → 保留逻辑内置为模块
