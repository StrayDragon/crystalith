<div align="center">
  <img src="assets/logo.webp" alt="Crystalith" width="160" height="160"/>

# Crystalith

[![](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square)](./LICENSE)
[![](https://img.shields.io/badge/bun-%3E%3D1.4-f472b6?style=flat-square&logo=bun)](https://bun.sh)
[![](https://img.shields.io/github/actions/workflow/status/StrayDragon/crystalith/ci.yml?style=flat-square&logo=github&label=CI)](https://github.com/StrayDragon/crystalith/actions/workflows/ci.yml)
[![](https://img.shields.io/github/actions/workflow/status/StrayDragon/crystalith/release.yml?style=flat-square&logo=github&label=Release)](https://github.com/StrayDragon/crystalith/actions/workflows/release.yml)
[![](https://img.shields.io/github/stars/StrayDragon/crystalith?style=flat-square&logo=github)](https://github.com/StrayDragon/crystalith/stargazers)
[![](https://img.shields.io/github/last-commit/StrayDragon/crystalith/main?style=flat-square&logo=github&label=last%20commit)](https://github.com/StrayDragon/crystalith/commits/main)

**自托管的 AI 知识笔记本 — 资料喂进去，理解留得下。**

[核心特性](#核心特性) · [快速开始](#快速开始) · [部署](#部署) · [插件](docs/plugins.md) · [Roadmap](docs/ROADMAP.md)

</div>

---

Crystalith 是一个本地优先的笔记本研究和提炼应用：每个笔记本聚集一组资料源（PDF、网页、arXiv、Obsidian Vault、本地目录），基于本地向量检索做**带引用的问答**，一键产出六类学习输出（简报、指南、闪卡、思维导图、测验、时间线）；**Deep Research** 模式还能在预算内多轮取证、综合成一份研究报告。

数据落在单个本地 SQLite 文件里，模型走你自己的 OpenAI 兼容网关（llama.cpp / Ollama / vLLM / 云 API 均可）——资料和 key 都不经过第三方。

```text
浏览器 (React SPA) ─── Eden RPC / SSE ─── Crystalith Server（单二进制）
                                            ├─ RAG：sqlite-vec 向量检索 · BM25 · 混合
                                            ├─ 资料源：PDF · 网页 · arXiv · Connectors
                                            ├─ Deep Research：ResearchRun 图 + 预算
                                            └─ 任意 OpenAI 兼容网关（llama.cpp / Ollama / …）
```

## 核心特性

| 能力                  | 说明                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **资料摄入**          | PDF（unpdf）、网页可读性抽取（Jina / Firecrawl 可选增强）、arXiv 结构化抓取（官方插件）、Obsidian Vault / 本地目录 Connector 同步 |
| **带引用问答**        | 检索增强的笔记本聊天，回答附来源引用；可切换「仅笔记本资料 / 允许联网」等生成模式                                                 |
| **RAG 策略**          | 可插拔注册表：Embedding、BM25、Hybrid、Page Index；向量与业务数据同库（sqlite-vec），单文件即全部状态                             |
| **Studio 结构化输出** | briefing / guide / flashcard / mindmap / quiz / timeline 六类交互式输出，支持跨类型转换与 PDF / PPTX 导出                         |
| **Deep Research**     | ResearchRun 任务图 + SSE 实时进度 + 预算控制，逐支路取证后综合成带引用的研究报告（Research Lab）                                  |
| **模型自由**          | Provider 白名单注册表：OpenAI / Anthropic / Google / DeepSeek / 任意 OpenAI 兼容网关；聊天、轻量、嵌入模型可分别指定              |
| **插件**              | npm 分发（`@crystalith-plugin/*`）：安装 = 加依赖 + 重启；v1 开放 `extractor` 类型，[作者指引](docs/plugins.md)                   |
| **隐私与自托管**      | 本地 SQLite 单文件、出站代理统一管控、可选 Bearer API 认证、无遥测                                                                |

## 快速开始

环境要求：[Bun](https://bun.sh) ≥ 1.4；`bun run dev` 需 overmind + tmux（也可分别启动）。

```bash
git clone https://github.com/StrayDragon/crystalith && cd crystalith
bun install
cp .env.example .env
```

编辑 `.env`，至少配置一个 OpenAI 兼容聊天网关（未配置时 server 启动会直接给出中文指引）：

```bash
CL_CHAT_MODEL=qwen3-32b                    # 网关上的模型名
CL_CHAT_API_BASE=http://127.0.0.1:8080/v1  # llama.cpp / Ollama / 云网关地址
CL_CHAT_API_KEY=local                      # 本地网关可随意填
CL_EMBEDDING_MODEL=nomic-embed-text        # RAG 检索用嵌入模型
CL_EMBEDDING_API_BASE=http://127.0.0.1:8080/v1
CL_EMBEDDING_API_KEY=local
```

启动并打开 <http://localhost:3000>：

```bash
bun run dev          # overmind 编排：server :8032 + web :3000 + slidev :3030
# 或不用 overmind，开两个终端：
bun run dev:server   # 仅 API :8032
bun run dev:web      # 仅前端 :3000
```

可选增强：SearXNG 实例（联网搜索，`CL_SEARXNG_HOST`）、Jina / Firecrawl key（网页抽取增强）、出站代理（`CL_PROXY_*`）。全部环境变量见 [.env.example](.env.example)。

> **注意**：默认 `config/app.yaml` 开启了出站代理（指向 `http://127.0.0.1:20171`）。本机没有对应代理时，请在 `.env` 中设置 `CL_PROXY_ENABLED=false`，否则 URL 抓取 / 网页抽取等出站请求会因代理不可达而失败（LLM / 嵌入网关调用不受影响）。

## 部署

**发布压缩包**（推荐）— `just release` 在 `target/release/` 产出当前平台的
`crystalith-server-<版本>-<系统>-<架构>.tar.gz`：

```text
crystalith-server            # 单二进制：API + 静态托管 web 界面
web/dist/                    # SPA 构建产物（存在即自动托管，同源访问）
drizzle/                     # 数据库迁移（启动时自动应用）
native/vec0.so               # sqlite-vec 平台扩展
config/app.yaml              # 运行时配置（不含任何密钥）
```

解压后一条命令即可运行（数据、日志均落在当前目录下）：

```bash
CL_CHAT_MODEL=… CL_CHAT_API_BASE=… ./crystalith-server   # :8032，API + Web 同端口
```

- 目录里没有 `web/dist/` 时即**纯 API 模式**（headless）：适合裸 CLI / TUI / 第三方 client 直接对接 HTTP API，类型从 `/openapi.json` 衍生。
- 版本号来自发布 tag，注入 `/health` 与 OpenAPI 文档。
- **Slidev 幻灯片**：server 自动探测预览进程（`slides_preview.base_url`，默认 `http://127.0.0.1:3030`，env `CL_SLIDEV_BASE_URL` 覆盖）；不可达时 Studio 生成入口自动移除 SLIDES 选项，原因与恢复提示见「诊断」面板。需要幻灯片能力时，把 base_url 指向任一可达的 Slidev 实例即可。
- 当前发布目标：**Linux x64 / arm64**（由 tag 驱动的 Release 工作流原生构建并逐平台冒烟，推送 `v*.*.*` tag 即自动发版）。macOS / Windows 产物暂缓：Bun 编译产物在 macOS 链接的 Apple SQLite 禁用扩展加载，向量检索不可用（见 `docs/known-issues.md`）；Windows 待排查。

**从源码运行**：`bun run build`（前端）+ `just build-binary`（编译二进制），运行方式同上。

## 开发

```bash
just test        # server + shared 单测（bun test）
just test-web    # 前端 Vitest
just e2e         # Playwright @p0 关键路径（全程 mock 网关，可离线）
just qa          # typecheck + lint + format + schema 漂移 + 全部测试 —— PR 门禁
```

技术栈：Bun · Elysia（Eden RPC 端到端类型安全）· Drizzle ORM · sqlite-vec · Vercel AI SDK v7 · Zod 合约 SSOT（`packages/shared`）· React + Vite。架构决策与模块约定见 [AGENTS.md](AGENTS.md)。

## 文档

- [AGENTS.md](AGENTS.md) — 架构决策、分层合约（Zod SSOT + Eden + OpenAPI）、贡献约定
- [docs/plugins.md](docs/plugins.md) — 插件作者指引（`extractor` 类型，样例 `@crystalith-plugin/extractor-arxiv`）
- [docs/ROADMAP.md](docs/ROADMAP.md) — 路线图（分发 / 插件 / 产品深化 / 工程债）
- [docs/known-issues.md](docs/known-issues.md) — 已知问题与工具链兼容性台账
- `/openapi` — 运行时 API 文档（Scalar，随 server 启动）

## 许可证

[Apache-2.0](./LICENSE)
