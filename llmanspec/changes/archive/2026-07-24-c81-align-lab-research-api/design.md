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

## Decision table（c80 inventory → c81）

| ID         | 项                              | 决策                                    | 落地                                                                                                                        |
| ---------- | ------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| G1         | list 全量图过重                 | **fix-api**                             | `ResearchRunSummarySchema`；`GET …/research` items=摘要；`GET …/:rid` 仍全量 `ResearchRun`                                  |
| G2         | `?status=`                      | **fix-api**                             | `ResearchListQuerySchema.status`（逗号/`status` 多值 → status[]）                                                           |
| G3         | active-count 端点               | **defer**                               | list + 客户端计数；后续 change 若需要再加                                                                                   |
| G4         | create 默认 vs Compose 外网优先 | **fix-api**                             | `useNotebookSources` 省略时默认 **false**（原 true）；`allowWeb` 仍默认 true；显式 `useNotebookSources:true` 仍须 sourceIds |
| G5         | 抽屉取消                        | **lab-only-no-api**（UI）               | API Keep `POST …/cancel`；接线 c82                                                                                          |
| G6         | 对话 `@`/`/`                    | **defer**                               | 另 change                                                                                                                   |
| Extra      | fixture / 控制台 scenario       | **lab-only-no-api**                     | inventory 已标；不升格 API                                                                                                  |
| 作业台形变 | graph_patch / chat / revisions… | **fix-spec-to-api**（本 change 不扩面） | 既有测试绿即视为对齐；未发现必须改 wire 的冲突则不改                                                                        |

## BREAKING wire

| 变更                                        | 影响                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /v2/notebooks/:nid/research` `items[]` | **不再**含 `nodes` / `edges` / `report`；改用 `ResearchRunSummary`                             |
| `POST …/research` 省略 `useNotebookSources` | 默认从 `true` → **`false`**（与 Lab Compose 外网优先一致）；仅传 `{topic}` 可创建 web-only Run |

非 BREAKING：`?status=` 为新增可选 query；`GET …/:rid` 形状不变。

## Non-Goals

- FE Eden 接线、删 Lab fixture 权威
- 对话 `@` 创建/引用
- 新编排框架依赖
- 新增 active-count 端点
