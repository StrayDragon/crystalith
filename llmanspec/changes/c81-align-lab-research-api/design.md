# Design: c81 align Lab inventory → ResearchRun API

## Process

1. 读 c80 `inventory.md` 冻结 Gap/形变列表。
2. 每项决策：`fix-api` | `fix-spec-to-api` | `lab-only-no-api` | `defer`。
3. `fix-api` → shared Zod + router/service + tests。
4. 出门：`bun test` research 套件绿；`bun typecheck`；OpenAPI 与 desc() 同步。

## Guardrails

```
ALLOW: packages/shared/src/schemas/research.ts
ALLOW: apps/server/src/features/research/**
ALLOW: apps/server/tests/research/**
DENY:  删除 research router 挂载
DENY:  改 sources.search 为深研（已在 c79 禁止）
DENY:  apps/web Lab 接 Eden（c82）
```

## Likely focus（以 inventory 为准，此处预列）

- graph_patch / role / conclusionStatus 与 Lab 渲染字段对齐
- node chat SSE 与 ActionProposal 形
- revisions / report working CoW
- progress seq 补洞
- confirmKind 与 Lab 确认门

## Non-Goals

- FE Eden 接线、删 Lab fixture 权威
- 新编排框架依赖
