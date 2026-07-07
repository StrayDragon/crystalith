---
depends_on: [c04-add-v2-core-crud, c02-add-v2-ai-runtime]
batch: all
---
# c12-add-v2-analysis-studio-refine — Analysis / Studio / Refine

## Why

v1 提供 analysis (资料聚类/矛盾/相关性)、studio (幻灯片工作室)、refine (结果精炼) 三个核心业务模块。v2 重写实现，利用 AI SDK 的工具化能力。

## What Changes

- **NEW** `server/src/features/analysis/` — 资料分析端点 (聚类、矛盾检测、相关性)
- **NEW** `server/src/features/studio/` — 幻灯片工作室 (AI SDK 生成 slides)
- **NEW** `server/src/features/refine/` — 结果精炼 (提升/缩写/重写/翻译)
- **NEW** `server/src/features/tasks/` — 后台任务队列
- **NEW** `server/src/features/templates/` — 模板管理
- **NEW** `server/src/features/prompt-presets/` — 提示词预设
- **NEW** `server/src/features/workspace/` — workspace 工具注册表 + 命令面板
- **NEW** `server/src/features/source-connectors/` — Obsidian + 本地目录同步

## Capabilities

- studio-output-types (spec delta: Studio slides)
- studio-slides-workflow (spec delta: slides workflow)
- structural-refinement-for-generated-results (spec delta: refine)
- generation-presets-and-constraints (spec delta: templates + presets)

## Impact

- Slidev 集成通过 AI SDK tool calling 动态生成 slides.md
- Refine 通过 streamText + system prompt 实现各模式切换
- Templates/Prompts 通过 Nunjucks 渲染（前端已在用）
