---
depends_on: [c04-add-v2-core-crud, c02-add-v2-ai-runtime]
batch: all
---

# c08-add-v2-research-agent — 自主研究 Agent (深度调研)

## Why

v1 的 research feature (13 端点 + pydantic-graph 图：PlanSearches → ExecuteSearches → AnalyzeResults → WaitForApproval → GenerateReport) 是 Crystalith 的高阶能力。v2 用 AI SDK streamText + maxSteps + SearXNG webSearch tool 实现多轮自主研究。

## What Changes

- **NEW** `server/src/features/research/` — 研究 session CRUD + agent 执行
- **NEW** `server/src/features/research/tools.ts` — webSearch (SearXNG fetch)、analyzeResults、writeReport tool
- **MODIFIED** `server/src/ai/` — agent 工具注册扩展

## Capabilities

- background-jobs-and-task-runtime (spec delta: 后台研究任务)

## Impact

- pydantic-graph 的显式状态机 → AI SDK 隐式 agent loop（agent 自主决定搜索→分析→呈报）
- SearXNG 通过 fetch() 直接调 HTTP API，不需要 langchain wrapper
- 支持用户暂停/审批/继续的研究工作流
