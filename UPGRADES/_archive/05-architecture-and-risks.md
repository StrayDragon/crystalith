# 05 — 目标架构、风险与推进节奏

## 目标架构

```
Bun 单二进制（bun build --compile，~50MB）
├─ Elysia server（本地，监听 127.0.0.1）
│   ├─ Drizzle ORM → SQLite（app.db）
│   │     └─ sqlite-vec 扩展（向量同库）
│   ├─ Vercel AI SDK → OpenAI / Ollama provider
│   ├─ Zod schema（前后端共享）
│   └─ 文件系统原生访问（本地资料 ingestion）
└─ React 前端 dist/（静态嵌入，复用现有 39k 行）

分发形态：
  阶段 B（先）：单二进制 → 启动本地 server → 浏览器/内嵌 webview
  阶段 A（后）：Tauri 包装 → .dmg/.exe/.AppImage + 自动更新
```

## 技术风险与应对

| 风险 | 严重度 | 应对 |
|------|--------|------|
| ~~**PDF 解析质量**（unpdf vs pypdf，引擎差异）~~ | ✅ **已验证关闭** | 实测（[09](./09-pdf-benchmark.md)）：unpdf 中文/文本提取与 pypdf 一致，页数判断三引擎完全一致，且完美支持 `bun build --compile` 单二进制。mupdf 因 AGPL + wasm 打包问题否决 |
| ~~RAG 召回（sqlite-vec 暴力扫描）~~ | ✅ **已验证** | 实测（[07](./07-sqlite-vec-benchmark.md)）：10k chunk 查询 8ms、100k 为 80ms（带 notebook 过滤 30ms）。个人桌面规模 (< 10 万) 完全够用。极端规模可平迁 LanceDB |
| 工作流编排（若保留 Research） | 🟡 中 | 用 `@langchain/langgraph` 兜底；砍掉则自建 ~100 行 runner |
| AI SDK 结构化输出稳定性 | 🟢 低 | 模式成熟，与 pydantic-ai 对等 |
| Bun 个别原生模块兼容 | 🟢 低 | 主流库（Drizzle/AI SDK/Elysia/pdfjs/Playwright）已验证 |
| 迁移工作量 | 🟡 中 | 真正需翻译的核心逻辑约 15-20k 行等价 TS（砍掉多后端胶水后） |

## 推进节奏建议

| 阶段 | 内容 | 产出 / gate |
|------|------|------|
| **P0 验证** | 三大风险已验证（[07](./07-sqlite-vec-benchmark.md)/[09](./09-pdf-benchmark.md)/[06](./06-pi-runtime-integration.md)）：① sqlite-vec 规模够 ② unpdf PDF 质量 + Bun 打包 OK ③ pi agent runtime 契合。**所有 hard gate 通过** | ✅ go 决策 |
| **P1 骨架** | Bun + Elysia + Drizzle + SQLite，跑通：单 notebook → ingest → chunk → embed → 检索 → 回答（带引用）闭环 | 单功能可用 |
| **P2 核心迁移** | 按裁剪决策逐 feature 翻译；前端 API 客户端重生成（或换 Elysia eden） | 功能对齐 MVP |
| **P3 瘦身定型** | 砍掉 E 类基础设施 + 插件框架；逻辑内置 | MVP 定型 |
| **P4 分发** | `bun build --compile` 出二进制 → Tauri 包装 → 自动更新、签名、安装包 | 可发布 |

## 关键里程碑判据

- ~~**P0 gate**：unpdf 能否在 ≥ 80% 真实样本上达到 pypdf 的文本质量~~ → ✅ **已通过**（[09](./09-pdf-benchmark.md)，中文 273 字符全对、页数一致）
- **P1 gate**：一个完整 RAG 问答闭环跑通，端到端延迟可接受（首次 embed 后，单次 QA < 模型推理时间 + 500ms 检索）。
- **P2 gate**：MVP 范围内功能对齐，前端无回归。

## 下一步行动（待 owner 决策后）

1. owner 完成裁剪决策（[04](./04-feature-trimming.md) 末尾勾选）
2. 启动 P0 spike（建议优先 PDF）
3. 基于 P0 结果产出正式 RFC（可放 `openspec/changes/` 或 `docs/plans/`）

## 相关文档

- [01-current-state-audit.md](./01-current-state-audit.md) — 现状盘点
- [02-target-stack-bun.md](./02-target-stack-bun.md) — Bun 技术栈
- [03-ai-ecosystem-mapping.md](./03-ai-ecosystem-mapping.md) — AI 生态对照表
- [04-feature-trimming.md](./04-feature-trimming.md) — 功能裁剪清单
- [06](./06-pi-runtime-integration.md) / [07](./07-sqlite-vec-benchmark.md) / [08](./08-web-framework-elysia-vs-hono.md) / [09](./09-pdf-benchmark.md) / [10](./10-tauri-sidecar-packaging.md) / [11](./11-drizzle-schema-design.md) — 专题调研
