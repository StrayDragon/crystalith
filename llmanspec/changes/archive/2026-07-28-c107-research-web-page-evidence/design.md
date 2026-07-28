# Design: c107 Research web page evidence

## 1. 目标

| 做                                               | 不做                                   |
| ------------------------------------------------ | -------------------------------------- |
| Work 工具 `fetchPage(url)` 复用 ExtractorFactory | 第二套爬虫 / 新编排框架                |
| 同 URL evidence 升级 `content`（token 截断）     | 自动入库 Source                        |
| Run 级 `pagesUsed` / `maxPageFetches`            | 读页弹 budget confirm / 吃 maxSearches |
| Agent 自选 URL + 薄充分性                        | 自动 Top-N；强够/不够状态机            |
| node_chat 与 work_unit 均暴露读页（allowWeb 时） | 改 c108 搜索加购语义                   |

## 2. 工具与抽取

```text
webSearch → SERP hits → insertEvidence(kind=web, snippet)
fetchPage(url) → ExtractorFactory (readability→jina→firecrawl)
  → on success: upsert same-url evidence.content (truncated)
  → on failure: log; keep snippet; unit continues
```

- Tool 名：`fetchPage`（对外 Zod/OpenAPI 一致）
- `execute` 走 `withRunLlmLockReleased`（与 webSearch 同，IO 不占 LLM 锁）
- 无可用 extractor / 全失败：返回结构化错误给模型，不抛垮 unit

## 3. 预算

创建 Run 时（与 depth→maxSearches 同时）：

```text
maxPageFetches = max(1, ceil(maxSearches * pageRatio))  # default pageRatio=1.5
pagesUsed = 0
```

每 work-unit 开始：

```text
pageSoft = max(1, ceil(remainingPages / remainingLiveResearchNodes))
```

- 成功读页：`pagesUsed += 1`（仅成功计数）
- `pagesUsed >= maxPageFetches` 或节点内已达 pageSoft：拒绝再读 / 工具返回 budget 提示
- **不**进入 `confirmKind=budget`；**不**增加 `searchesUsed`

## 4. Token 截断

- 计数：与 QA 一致用 gpt-tokenizer（cl100k_base）或项目既有 helper
- 每节点：该节点关联 web evidence 的 `content` 合计 ≤ `nodeContentTokenBudget`（默认 32768）
- 新页写入时若超限：截断本页或按设计丢弃更旧页正文（design 锁定：**优先截断本页**，保留 snippet）
- 短综合：喂给模型的证据上下文 ≤ `nodeSummaryTokenBudget`（默认 65536）；`maxOutputTokens` 仍可低于此（综合输出短）

## 5. Agent 指令（work_unit）

- 告知剩余 `searches` / `pages` 与本节点 soft
- 要求：自选值得读的 URL；有正文后判断是否够用；不够再搜/再读；禁止编造
- `stopWhen: isStepCount(workUnitMaxSteps)` 默认 12

## 6. Schema / 持久化

- `ResearchEvidence`：可选 `content: string`（正文截断）
- Run：`pagesUsed`、`maxPageFetches`（创建时写入；fork 重置 pagesUsed=0，拷贝 maxPageFetches）
- GET Run / progress 可暴露 pages 用量（便于 Lab；最小：Run 字段）

## 7. Config（app.yaml）

```yaml
research:
  pageRatio: 1.5
  workUnitMaxSteps: 12
  nodeContentTokenBudget: 32768
  nodeSummaryTokenBudget: 65536
```

## 8. Spec

- ADDED：读页工具与抽取复用；pages 预算；evidence content；agent 自选；截断与失败降级
- 不修改 r305/r306（留给 c108）

## 9. 测试 seams（已确认）

1. agent 注册 fetchPage + ExtractorFactory
2. ingest 同 URL 升级 + token 截断
3. run-loop pages 软/硬上限；读页失败不整垮
4. config 默认与公式
5. research suite 回归（e2e stub 可不调真 Firecrawl；mock extractor）
