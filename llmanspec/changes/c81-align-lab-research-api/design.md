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
DENY:  实现对话 @深度研究 / 斜杠深研嵌入（deferred）
```

## Priority focus（任务队列 + Compose；以 inventory 为准）

| 主题                             | 默认倾向                           |
| -------------------------------- | ---------------------------------- |
| `GET …/research` 作任务抽屉 SSOT | Keep；核对分页/排序                |
| 列表项是否过重（全图）           | 若 Gap → **fix-api** 瘦摘要 schema |
| `?status=` 过滤                  | 可选 fix-api；否则文档化客户端滤   |
| active-count 专用端点            | **defer**（list + 客户端计数）     |
| `POST …/research` ↔ Compose 字段 | 对齐或 fix-api / fix-spec          |
| cancel 从抽屉                    | 对照既有 cancel；缺则 Gap          |

## Likely focus（作业台；以 inventory 为准）

- graph_patch / role / conclusionStatus 与 Lab 渲染字段对齐
- node chat SSE 与 ActionProposal 形
- revisions / report working CoW
- progress seq 补洞
- confirmKind 与 Lab 确认门

## Non-Goals

- FE Eden 接线、删 Lab fixture 权威
- 对话 `@` 创建/引用
- 新编排框架依赖
