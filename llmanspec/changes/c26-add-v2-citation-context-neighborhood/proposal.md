---
depends_on: [c17-fix-v2-qa-citations]
blocks: []
batch: all
---

# c26-add-v2-citation-context-neighborhood — citations 邻域证据审查

## Why

GAP-REPORT 域表第 4 行（🔴 最严重误标）：v2 citations 实现的是**不同端点**。

- v1 `GET /v1/.../citations/context`：按 `chunk_id` 或 `source_id+chunk_index` 解析 chunk，返回 `before[]` / `chunk` / `after[]` 邻域窗口（可配 0-5 邻居），含 `page_number`/`paragraph_index` 富化。这是**证据审查**能力——用户点 citation 看上下文。
- v2 `GET /v2/citations/:messageId`：仅 echo 存储的 citations 列。**邻域功能完全缺失**。

本 change 新增 `/citations/context` 端点补全证据审查能力（保留现有 echo 端点）。

## What Changes

- **NEW** `GET /v2/notebooks/:nid/citations/context`: 查询参数 `chunk_id` 或 (`source_id`+`chunk_index`)（互斥，否则 400）；可选 `neighbors` (0-5, 默认 2)
- **NEW** `features/citations/context.ts`: 解析目标 chunk → 取同 source 相邻 chunk_index 的 before/after → 富化 page_number/paragraph_index → 返回 `{before[], chunk, after[]}`
- **KEPT** 现有 `GET /v2/citations/:messageId`（echo 存储）不变
- 对照 v1 `features/citations/api.py:55-133`

## Capabilities

- evidence-review-workflow

## Impact

- 新增 1 路由 + 1 helper 文件（~80 行）
- 复用 chunks 表的 chunk_index/source_id/page_number 列
- 无 BREAKING（新增端点）
