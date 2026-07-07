# UPGRADES — Crystalith v2 迁移

> Crystalith 从 Python 全栈重写为 Bun + TypeScript 全栈的完整方案。
> 目标：本地优先、可独立部署、可验证的高效 Notebook RAG 平台。

---

## 📚 文档索引（按执行顺序）

### 🔴 第一优先 — 当前执行中

| # | 文档 | 内容 | 状态 |
|---|------|------|:--:|
| 1 | [00-v2-migration-plan.md](./00-v2-migration-plan.md) | **★★★ 最终迁移方案** — 目标架构、技术栈、RAG 策略注册表、Eval Benchmark、Rivu 降级、5 阶段路线图 | ✅ 完成 |
| 2 | [00-cleanup-python.md](./00-cleanup-python.md) | **⚡ 前置清理** — 删胶水代码、降级 Rivu、删未使用依赖。可复制命令 | ✅ 完成 |
| 3 | [00-dev-guide.md](./00-dev-guide.md) | **本地热重载开发环境** — 两个终端起全栈，无需 Docker | ✅ 完成 |

### 🟡 技术调研 — v2 实现参考

| # | 文档 | 内容 |
|---|------|------|
| 4 | [01-current-state-audit.md](./01-current-state-audit.md) | 现状盘点：代码规模、技术依赖、痛点定位 |
| 5 | [02-target-stack-bun.md](./02-target-stack-bun.md) | Bun 技术栈选型、分发架构、砍掉的复杂度 |
| 6 | [03-ai-ecosystem-mapping.md](./03-ai-ecosystem-mapping.md) | **AI 生态对照表** — pydantic-ai → Vercel AI SDK、pypdf → unpdf 等 |
| 7 | [06-ai-sdk-integration.md](./06-ai-sdk-integration.md) | **Vercel AI SDK Agent 运行时方案** — provider 抽象 + agent loop + 流式 + 结构化输出 |
| 8 | [07-sqlite-vec-benchmark.md](./07-sqlite-vec-benchmark.md) | sqlite-vec 实测 — 10k chunk 8ms，100k 80ms |
| 9 | [08-web-framework-elysia-vs-hono.md](./08-web-framework-elysia-vs-hono.md) | Elysia vs Hono 选型对比 |
| 10 | [09-pdf-benchmark.md](./09-pdf-benchmark.md) | PDF 解析实测 — unpdf 中文/文本提取与 pypdf 一致 ✅ |
| 11 | [10-tauri-sidecar-packaging.md](./10-tauri-sidecar-packaging.md) | Tauri + Bun sidecar 桌面分发架构 |
| 12 | [11-drizzle-schema-design.md](./11-drizzle-schema-design.md) | Drizzle ORM schema 设计（17 表映射 + 向量表集成） |

### 🗄️ 已归档（文档已移走）

以下文档因与最终决策不一致（建议砍 feature 的旧版方案）已不再有效，已从 `UPGRADES/` 移除：

- `_archive/04-feature-trimming.md` — 旧版裁剪建议（与最终决策冲突：建议砍 research/analysis/studio）
- `_archive/00-user-feature-review.md` — 旧版用户视角 review（含待打标的裁剪表，已被 00-v2 替代）
- `_archive/05-architecture-and-risks.md` — 旧版架构提案（已被 00-v2 替代）

### 🧪 Benchmark 数据

- `_bench-sqlite-vec/` — sqlite-vec 实测脚本（bench.ts + disk.ts）
- `_bench-pdf/` — PDF 解析实测脚本（bench.ts + 5 个样本 PDF）

---

## 🎯 核心决策摘要

| 决策 | 结论 |
|------|------|
| 全迁还是混合？ | **全迁 TS** — Python 无不可替代项 |
| 哪些 feature 保留？ | **全部保留** — research/analysis/studio/refine 等都是核心业务 |
| AI runtime？ | **Vercel AI SDK (`ai` + `@ai-sdk/*`)** — 全套 Provider 抽象 + Agent Loop + 结构化输出 + 流式 |
| RAG 策略？ | **可插拔注册表** — Embed → BM25 → 混合 → Page Index → GraphRAG |
| 质量验收？ | **内置 Eval Benchmark Harness** — Golden Dataset + LLM-as-Judge + 前端可视化 |
| 外部服务？ | 都可以自部署 — SearXNG / Chroma / Redis |
| Rivu？ | **降级** — 删服务端状态机，v2 用消息内嵌 JSON 渲染组件 |

---

## 🚀 当前状态

```
┌─ 讨论确定 ────────────────────────────────────────────┐
│  ✅ 全迁 TS / All features 保留 / AI SDK / RAG 策略     │
│  ✅ Eval Benchmark / 外部服务可自部署 / Rivu 降级      │
│  ✅ 前置清理方案 / 分支策略 (v1 + main + v2)           │
├─ 执行中 ──────────────────────────────────────────────┤
│  ⏳ 执行前置清理 (UPGRADES/00-cleanup-python.md)       │
│     · ollama_discovery 已清理完成   │
│     · 4 个死代码文件、factory 简化、前端 Rivu/Tambo 等待执行  │
│  ⏳ 保存 v1 分支 + 创建 v2 分支                        │
└────────────────────────────────────────────────────────┘
```
