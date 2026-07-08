# UPGRADES — Crystalith v2 全栈 TypeScript 迁移

> V1 全栈 TypeScript 重写方案。5 阶段 ~20 周。
> 目标：单二进制分发、前后端同语言共享类型、AI SDK 统一 Agent 运行时。

---

## 📚 文档索引（按执行顺序）

### 🔴 方案 + 分发

| # | 文档 | 内容 | 状态 |
|---|------|------|:--:|
| 1 | [00-v2-migration-plan.md](./00-v2-migration-plan.md) | **★★★ 最终迁移方案** — 目标架构、技术栈、RAG 策略注册表、Eval Benchmark、Rivu 降级、5 阶段路线图 | ✅ |
| 2 | [02-target-stack-bun.md](./02-target-stack-bun.md) | Bun 技术栈选型、分发架构、砍掉的复杂度 | ✅ |
| 3 | [12-distribution-strategy.md](./12-distribution-strategy.md) | **分发方案** — Client + Server 分离、Bun 二进制、Tauri 包装、CI/CD 矩阵 | ✅ |

### 🟡 执行中

| # | 文档 | 内容 | 状态 |
|---|------|------|:--:|
| 4 | [00-cleanup-python.md](./00-cleanup-python.md) | **⚡ 前置清理** — 删除胶水代码、Rivu 降级、未使用依赖 | ✅ 已完成 |
| 5 | [00-dev-guide.md](./00-dev-guide.md) | **本地热重载开发环境** — 两个终端起全栈，无需 Docker | ✅ |

### 🟡 技术调研 — v2 实现参考

| # | 文档 | 内容 |
|---|------|------|
| 6 | [01-current-state-audit.md](./01-current-state-audit.md) | 现状盘点：代码规模、技术依赖、痛点定位 |
| 7 | [03-ai-ecosystem-mapping.md](./03-ai-ecosystem-mapping.md) | **AI 生态对照表** — pydantic-ai → Vercel AI SDK、pypdf → unpdf 等 |
| 8 | [06-ai-sdk-integration.md](./06-ai-sdk-integration.md) | **Vercel AI SDK Agent 运行时方案** — provider 抽象 + agent loop + 流式 + 结构化输出 |
| 9 | [07-sqlite-vec-benchmark.md](./07-sqlite-vec-benchmark.md) | sqlite-vec 实测 — 10k chunk 8ms，100k 80ms |
| 10 | [08-web-framework-elysia-vs-hono.md](./08-web-framework-elysia-vs-hono.md) | Elysia vs Hono 选型对比 |
| 11 | [09-pdf-benchmark.md](./09-pdf-benchmark.md) | PDF 解析实测 — unpdf 中文/文本提取与 pypdf 一致 ✅ |
| 12 | [10-tauri-sidecar-packaging.md](./10-tauri-sidecar-packaging.md) | Tauri + Bun sidecar 桌面分发架构 |
| 13 | [11-drizzle-schema-design.md](./11-drizzle-schema-design.md) | Drizzle ORM schema 设计（17 表映射 + 向量表集成） |

### 🧪 Benchmark 数据

- `_bench-sqlite-vec/` — sqlite-vec 实测脚本（bench.ts + disk.ts）
- `_bench-pdf/` — PDF 解析实测脚本（bench.ts + 5 个样本 PDF）

---

## 🎯 核心决策摘要

| 决策 | 结论 |
|------|------|
| 全迁还是混合？ | **全迁 TS** — Python 重写为 Bun + TypeScript |
| 哪些 feature 保留？ | **全部保留** — research/analysis/studio/refine 等都是核心业务 |
| AI runtime？ | **Vercel AI SDK (`ai` + `@ai-sdk/*`)** — 全套 Provider 抽象 + Agent Loop + 结构化输出 + 流式 |
| RAG 策略？ | **可插拔注册表** — Embed → BM25 → 混合 → Page Index → GraphRAG |
| 质量验收？ | **内置 Eval Benchmark Harness** — Golden Dataset + LLM-as-Judge + 前端可视化 |
| 配置？ | **Nunjucks + YAML** — 模板变量 + 注释保留编辑，一致体验 |
| 分发？ | **Tauri 桌面 app**（主推）+ **tar.gz 一体包**（CLI）+ **Docker**（可选 Web 部署）|
| Rivu？ | **降级** — 删服务端状态机，v2 用消息内嵌 JSON 渲染组件 |

---

## 🚀 当前状态

```
┌─ 讨论确定 ────────────────────────────────────────────┐
│  ✅ V1 全栈 TypeScript 重写方案                        │
│  ✅ 所有 feature 保留                                 │
│  ✅ 分发方案确定（Tauri + tar.gz + Docker）             │
│  ✅ 前置清理已完成（5,200 行胶水已删）                  │
│  ✅ 技术调研全部完成（AI 生态、Benchmark、分发）         │
├─ 待执行 ──────────────────────────────────────────────┤
│  ⏳ Phase 0：脚手架（Bun + Elysia + Drizzle + AI SDK） │
│  ⏳ bun build --compile 单二进制验证                    │
└────────────────────────────────────────────────────────┘
```

## 📦 分发方案速查

详见 [12-distribution-strategy.md](./12-distribution-strategy.md)

| 方案 | 产物 | 大小 | 受众 |
|------|------|------|------|
| **A: Tauri 桌面 app** | `.dmg` / `.exe` / `.AppImage` | ~90MB | 普通用户 |
| **B: tar.gz 一体包** | binary + public/ + config/ | ~85MB | 开发者/CLI |
| **C: Docker 部署** | server + nginx | ~100MB | 团队共享 |
| **D: npm 包分发** | `@crystalith/web` | ~5MB | 前端开发者 |
