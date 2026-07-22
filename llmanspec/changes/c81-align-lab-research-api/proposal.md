---
depends_on: [c80-lab-shell-fixture-inventory]
---

## Why

c80 inventory 会暴露 Lab mock 与 ResearchRun API 的形变/缺口。需要在**不删 ResearchRun 面**的前提下，按盘点修正 Zod/行为约定，并让 **server research API 测试全绿**，为 c82 Eden 接线提供稳定合约。

## What Changes

1. **按 c80 `inventory.md` 执行合约修正**：补齐/收紧 shared research schemas、OpenAPI `desc`、路由校验；修正与 Lab 语义冲突的字段/事件（例：role、confirm、report working、progress seq）。
2. **真实化处理**：对 inventory 标为「应真实」的命令口，确保 handler 行为与 spec 一致（非 501、非静默丢字段）；fixture 专属能力若不进 API，在 inventory 标 Extra 并文档化。
3. **测试**：扩展/修复 `apps/server/tests/research/**`；本 change 出门条件为 research API 测通过 + shared schema 可被 validate/typecheck。
4. **Hard rule**：MUST NOT 删除 `/v2/notebooks/:nid/research*` 主面；MUST NOT 在本 change 改 Lab 为 Eden 权威（c82）。

## Capabilities

- `deep-research-runtime` — 合约与行为对齐 Lab 盘点
- `workspace-api-contract` — 若触及跨面错误码/信封则最小修改

## Impact

- depends_on `c80-lab-shell-fixture-inventory`
- 可能 BREAKING wire（字段必填/事件形）；须在 design 列出
- blocks：`c82-wire-lab-eden`

## Seams（测试边界）

- HTTP：`POST/GET …/research*`、stream SSE、nodes prune/fork/PATCH/chat、confirm、revisions、report/working、progress
- Zod：`packages/shared/src/schemas/research.ts`
- 不含：Lab React 点击（c82）、sources.search（c79 已解耦）
