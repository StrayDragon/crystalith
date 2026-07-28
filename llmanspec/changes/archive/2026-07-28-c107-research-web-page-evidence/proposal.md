---
depends_on: []
status: designed
branch: sdd/c107-research-web-page-evidence
base_sha: 5851bbd259781abcf768356f1c19c6831f61b6e5
checkpointed: true
checkpoint_sha: 5851bbd259781abcf768356f1c19c6831f61b6e5
---

## Why

Deep Research 节点 work-unit 的 `webSearch` 目前只写入 SearXNG 的 **title / url / snippet**，没有打开页面读正文。
短综合与报告只能基于 SERP 摘要，证据质量只做了一半：搜得到链接，却读不到内容，也无法基于正文判断「证据是否充分 → 是否继续检索」。

来源导入侧 **已有** 可复用的抽取链（`readability` → `jina` → `firecrawl`，见 `apps/server/src/shared/extraction/` 与 `source_ingestion` 配置），但 **未** 接入 ResearchNodeAgent 的 Work 工具面。
本变更单开，避免被预算语义重设计挡住；**c108** `depends_on` 本变更。

## What Changes

1. **Work 工具读页**：work_unit / node_chat 增加 `fetchPage`（名以 design 为准），复用 ExtractorFactory，**禁止** research 内另写爬虫。
2. **证据升级**：同 URL 保留 SERP `snippet`，写入截断正文 `content`（token 截断）；失败保留 SERP，MUST NOT 因单页失败整单元失败。
3. **工具环**：agent「搜 → 自选 URL 读 → 薄判断是否够用 → 可选再搜」；`workUnitMaxSteps` 配置默认 12。
4. **独立读页预算**：`pagesUsed` / `maxPageFetches`；`maxPageFetches = max(1, ceil(maxSearches × pageRatio))`（默认 pageRatio=1.5）；每节点软上限均分剩余读页；读页触顶不弹 budget confirm。
5. **Token 预算**：每节点正文合计默认 32k token；节点短综合默认 64k（均配置化）。
6. **测试**：见已确认 seams（agent 工具、ingest、run-loop、config、research suite）。

## Locked decisions

| #              | 锁定                                                              |
| -------------- | ----------------------------------------------------------------- |
| 读页预算       | 独立 `maxPageFetches`；不吃 `maxSearches`；不弹 budget confirm    |
| 证据           | 同 URL 升级 + token 截断；节点正文 32k / 短综合 64k               |
| 步数           | `workUnitMaxSteps` 默认 12                                        |
| maxPageFetches | `⌈maxSearches × pageRatio⌉`，pageRatio 默认 1.5；每节点均分软上限 |
| 充分性         | Agent 自选 URL；薄充分性；不自动 Top-N                            |
| Seams          | 用户确认方案 1（含 node_chat）                                    |

## Non-Goals

- 不改 L1 `maxSearches`/`maxNodes` 与 M1 budget 产品语义（**c108**）。
- 不把深研读页自动入库为笔记本 Source。
- 不引入第二套编排框架；不做强充分性状态机。

## Capabilities

- `deep-research-runtime` — fetchPage、pages 预算、evidence content、短综合 token

## Impact / Seams

- `node-agent.ts` / `run-loop.ts` / `extraction/*` / `research` Zod / config / `tests/research/`
