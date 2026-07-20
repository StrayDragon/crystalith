# 精炼摘要（Refine）— **已移除 (c73, 2026-07-20)**

整域 HTTP 与实现已删除。Studio 对 PARAGRAPH / BULLETS / STRUCTURED 使用 `POST /v2/notebooks/:nid/outputs`（FE：`useRefine` → `useOutputQueue`）。

| 曾有路由                                             | 状态    |
| ---------------------------------------------------- | ------- |
| `GET /v2/refine/modes`                               | removed |
| `POST /v2/refine` / `POST /v2/notebooks/:nid/refine` | removed |
| `POST /v2/refine/batch` / nested batch               | removed |

已删代码：`apps/server/src/features/refine/**`、`packages/shared/src/schemas/refine.ts`。
规格：`structural-refinement-for-generated-results` / `generation-core` 中 refine HTTP 条款已缩（愿景级局部改良 MUST 仍可能残留，另议）。

> NOTE: **已移除** — 勿再登记 OpenAPI / 勿再实现 parity
