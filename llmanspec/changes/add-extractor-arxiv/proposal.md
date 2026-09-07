---
depends_on: []
---

# Proposal — add-extractor-arxiv（首个榜样外部插件，DRAFT）

> 状态：**draft**。仅记录提案，尚未 Branch binding / Specs landing；
> 进入实施前先完成其他优先逻辑（开源 A 线）。选型讨论见 `docs/plugins.md`。

## Why

arXiv 是研究者用户最高频的来源站点之一，但 abs 页（listing/摘要页）经
readability 抽取后混杂导航/引用噪声，元数据（作者、分类、摘要、ID）无法
结构化保留。`export.arxiv.org` 的 Atom API 稳定、无 key、纯 JS 可消费，
是「现有三个提取器覆盖不了 + 实现极简」的最优榜样位。

作为**第一个外部插件**，它同时是插件体系的验收夹具：完整踩过 scope 发现、
动态 import、host 门控、fallback 链、`plugins.*` 策略、diagnostics 与
official catalog（r7/r11 全流程）。

## What Changes

- 新增 workspace 包 `packages/plugin-extractor-arxiv`（包名
  `@crystalith-plugin/extractor-arxiv`，bun workspaces symlink 进根
  node_modules → registry discovery 直接命中，无需发包即可联调）
- 插件行为：`isAvailable` 恒定可用；`extract(url)` 内按 host
  （`arxiv.org/abs/*`、`export.arxiv.org`）判定，非目标 URL 返回空内容 →
  编排层自然降级到下一个提取器；目标 URL 走 Atom API → markdown +
  结构化元数据（title/authors/abstract/primary_category/published）
- 宿主唯一改动：`CrystalithPluginContext` 增加必填 `fetch`（注入
  outboundFetch）——插件出站 HTTP 统一走全局代理 SSOT，不引入第二套代理逻辑
- 本地调试：免启服运行器 `scripts/try.ts` + workspace symlink 说明（见
  docs/plugins.md 教程）
- wire 零改动：不新增端点、不改任何既有响应形状（`ExtractorMetadata`/
  `ExtractedContent` 既有字段承载）

## 非目标

- 除 `ctx.fetch` 注入点外不做宿主改动（不碰 ingestion / fallback 编排 /
  workspace tools 逻辑）
- 不做 PDF 全文抽取（属 parser 域，等 parser 宿主接线）
- 不做 URL 感知优先级（isAvailable 加 url 参数属 kind 契约扩展，见 design D3）
- 不同步做 github 提取器（优先级更低，选型见 `docs/plugins.md` 梯队表）
