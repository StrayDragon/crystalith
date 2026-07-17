---
depends_on: []
---

## Why

v1 Python API 留下的 Citation wire 字段是 snake_case（`source_id` 等），前端 UI 域已是 camelCase（并曾误读字段导致「0 个来源」）。继续双轨命名会反复产生边界 bug。应将 Citation **线合约**统一为 camelCase，并与 UI 域对齐（`sourceName`，不再使用 `sourceTitle`）。

## What Changes

- **BREAKING**：`packages/shared` `CitationSchema` 字段改为 camelCase：`sourceId` / `sourceName` / `chunkId` / `chunkIndex` / `pageNumber` / `paragraphIndex` / `snippet` / `score`
- 服务端 QA / messages / outputs / refine / streaming `done.citations` 与持久化 citation dict 统一输出 camelCase
- 前端：UI `Citation` 使用 `sourceName`（替换 `sourceTitle`）；删除/收缩 snake→camel 的 `normalizeCitation` 字段重命名（仅保留必要的数值/缺省规范化）
- OpenAPI / eden 类型随 Zod SSOT 更新
- **不改**：请求参数 `source_ids`、DB 列名、内部检索 hit 结构（除非直接序列化为 Citation）

## Capabilities

- `workspace-api-contract`
- `generation-core`

## Impact

- 所有消费 Citation JSON 的客户端/测试/BDD 必须改为 camelCase
- 无 snake_case 兼容层（按项目「不保留旧兼容」约定全量切换）
