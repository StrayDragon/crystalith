# 评测（Eval）— **已移除 (c73, 2026-07-20)**

Golden Dataset + LLM-as-Judge harness（`/v2/eval/*`）已整域删除：无生产 UI、无 CI、无 CLI。

| 曾有路由                      | 状态    |
| ----------------------------- | ------- |
| `GET/POST /v2/eval/datasets*` | removed |
| `GET/POST /v2/eval/runs`      | removed |

已删代码：`apps/server/src/features/eval/**`、`packages/shared/src/schemas/eval.ts`、DB 表 `eval_*`。
规格：`quality-and-regression` r11 已移除。

> NOTE: **已移除**
