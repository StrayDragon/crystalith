---
depends_on: [c37-align-v2-research-agent]
batch: all
---

# c46-fix-v2-parsers-and-research-resilience — CSV parser + Research 韧性

## Why

2026-07-11 第三轮复核发现 parsers 和 research 域各有 1 个 P0 + 一批 P1 韧性缺口：

- **CSV 当纯文本处理** [P0]: v2 `parsers/text.ts:9` + `parser-registry.ts:9,78` 把 .csv 路由到 textParser pass-through。v1 `parsers/csv.py` 有专用 CSVParser：markdown-table 分块（50 rows/chunk，200 char cell 截断）+ `csv_row_start`/`csv_row_end` metadata。CSV 源在 v2 变成无结构文本。
- **research report prompt 极简** [P1]: v2 `agent.ts:508` 的 generateFinalReport 用一行 "Produce a comprehensive markdown report"。v1 `graph.py:94-128` 有 6 段结构化 REPORT_SYSTEM_PROMPT（Executive Summary/Background/Key Findings/Analysis/Recommendations/References）。
- **无 AI 失败 fallback** [P1]: v2 `agent.ts:311,358` plan/analyze 失败直接 break loop → 中止 run。v1 `graph.py:225,675` 有 try/except fallback（2-query plan + coverage 分析）。
- **export note 类型错** [P1]: v2 用 `type:BRIEFING` + `{title,sections}`。v1 用 `type:STRUCTURED` + `{title,text,metadata}`。
- **finish 同步生成 report** [P1]: v2 在 endpoint 内同步生成 report。v1 finish 只翻状态，report 由 agent 后台生成。
- **waiting SSE 只发一次** [P1]: v1 每秒 poll 时重发 `waiting`（心跳）。v2 只在 user_input step 时发一次。
- **无 lock 续期** [P1]: v2 lock TTL 10min，长任务被 cleanupExpiredLocks 误杀。v1 每 5min 续期。
- **search dedup 弱** [P1]: v2 只 strip `?#`。v1 还 strip trailing slash / www. + 标题相似度 ≥0.85 过滤。

## What Changes

1. **CSV 专用 parser**: 实现 CSVParser（markdown-table 分块 50 rows/chunk + csv_row_start/end metadata + 200 char cell 截断）
2. **report 富 prompt**: 采用 v1 6 段 REPORT_SYSTEM_PROMPT
3. **AI 失败 fallback**: plan 失败→2-query fallback plan；analyze 失败→coverage fallback
4. **export note 类型对齐**: type=STRUCTURED + {title,text,metadata}
5. **finish 后台生成**: finish 只翻状态，report 由 agent 异步生成
6. **waiting SSE 心跳**: stream loop 中 status=waiting_user 时每秒重发 waiting
7. **lock 续期**: agent loop 中定期续期 lock
8. **search dedup 增强**: strip trailing slash / www. + 标题相似度过滤

## Capabilities

- source-ingestion-core（spec delta: CSV parser markdown-table 分块 + csv_row metadata）
- structural-refinement-for-generated-results（spec delta: research report 结构化 prompt + AI 失败 fallback + export note 类型）

## Impact

- CSV 源从无结构文本变为 markdown-table 分块（检索质量提升）
- research report 质量显著提升（6 段结构化）
- research 韧性提升（AI 失败不再中止 run）
