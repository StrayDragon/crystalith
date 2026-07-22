# Design: c82 wire Lab → Eden ResearchRun

## Architecture

```
Lab UI (graph/drawer/report/…)
    ↓ LabSessionPort
EdenResearchSessionPort  →  treaty<App>  →  /v2/notebooks/:nid/research*
    ↑ shared Research* types / ErrorEnvelope
```

Fixture port 仅在 `CL_LAB_FIXTURE=1`（或等价）启用。

## Mapping（示意）

| Lab 动作                  | API                    |
| ------------------------- | ---------------------- |
| 开始（由 notebook+topic） | POST research          |
| 图更新                    | GET stream graph_patch |
| prune/fork                | POST nodes/…           |
| chat accept               | chat SSE → 命令口      |
| revisions                 | revisions CRUD/restore |
| report edit               | report working         |
| progress                  | GET progress           |

## Guardrails

- MUST NOT 平行 Zod DTO 文件
- MUST NOT 本地 timer 冒充 Run 状态机（默认路径）
- MUST NOT 删除 research API

## Testing

- Vitest：port 在 mock fetch 下发正确路径
- e2e：打开 Lab（可 mock 或 test env）
- server research 测保持绿（回归）
