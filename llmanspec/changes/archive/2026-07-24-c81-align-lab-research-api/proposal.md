---
depends_on: [c80-lab-shell-fixture-inventory]
---

## Why

c80 inventory 会暴露 Lab mock（含 **Compose / 任务抽屉**）与 ResearchRun API 的形变/缺口。需要在**不删 ResearchRun 面**的前提下，按盘点修正 Zod/行为约定，并让 **server research API 测试全绿**，为 c82 Eden 接线（作业台 + 任务列表真数据）提供稳定合约。

## What Changes

1. **按 c80 `inventory.md` 执行合约修正**：补齐/收紧 shared research schemas、OpenAPI `desc`、路由校验；修正与 Lab 语义冲突的字段/事件（例：role、confirm、report working、progress seq）。
2. **任务列表相关（高优先级）**：
   - 确认 `GET …/research` 分页列表可作为任务抽屉 SSOT；
   - 若 inventory 要求：**列表瘦摘要**（不含全量 nodes/edges）和/或 **`status` 查询过滤** → 在本 change 落地 Zod + handler + 测试；
   - active badge：**默认**用 list + 客户端计数；仅当 inventory 标必须时才加 count 端点。
3. **Compose / create**：核对 `ResearchCreate*` 与 Compose 字段一致（topic、useNotebookSources、allowWeb、sourceIds、depth）。
4. **真实化处理**：inventory「应真实」的命令口与 spec 一致；fixture 专属标 Extra。
5. **测试**：`apps/server/tests/research/**` 全绿 + shared schema typecheck。
6. **Hard rule**：MUST NOT 删除 `/v2/notebooks/:nid/research*`；MUST NOT 本 change 改 Lab 为 Eden 权威（c82）；MUST NOT 实现对话 `@`/`/` wire（**deferred**，非本链路）。

## Capabilities

- `deep-research-runtime` — 合约与行为对齐 Lab 盘点（含 list/create 任务队列）
- `workspace-api-contract` — 若触及跨面错误码/信封则最小修改

## Impact

- depends_on `c80-lab-shell-fixture-inventory`
- 可能 BREAKING wire（列表 shape / query）；须在 design 列出
- blocks：`c82-wire-lab-eden`

## Seams（测试边界）

- HTTP：`POST/GET …/research*`（**含 list 摘要/过滤若落地**）、stream SSE、nodes prune/fork/PATCH/chat、confirm、revisions、report/working、progress
- Zod：`packages/shared/src/schemas/research.ts`
- 不含：Lab React / 任务抽屉 UI（c82）、对话 `@`/`/`、sources.search（c79 已解耦）
