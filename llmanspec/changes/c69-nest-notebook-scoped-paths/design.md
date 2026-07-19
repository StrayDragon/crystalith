## 决策

1. **嵌套优先、扁平为 alias**：新 canonical = `/v2/notebooks/:nid/...`；旧扁平在同一 PR 仍可用但文档标 deprecated。
2. **c67 归属校验保留**：嵌套 path 的 `:nid` 即 notebook 边界；alias 仍强制 query/body notebookId 与资源一致。
3. **保持全局扁平**：`/v2/notebooks`、`/v2/models`、`/v2/commands`、`/v2/prompt-presets`、`/v2/templates`、`/v2/eval/*`、`/v2/strategies`（全局 registry）。

## old → new（摘要）

| 旧                       | 新                                      |
| ------------------------ | --------------------------------------- |
| `/v2/outputs`            | `/v2/notebooks/:nid/outputs`            |
| `/v2/outputs/:id`        | `/v2/notebooks/:nid/outputs/:id`        |
| `/v2/research`           | `/v2/notebooks/:nid/research`           |
| `/v2/research/:id/*`     | `/v2/notebooks/:nid/research/:id/*`     |
| `/v2/qa` `/v2/qa/stream` | `/v2/notebooks/:nid/qa` `.../qa/stream` |
| `/v2/refine*`            | `/v2/notebooks/:nid/refine*`            |
| `/v2/studio/slides*`     | `/v2/notebooks/:nid/studio/slides*`     |
| `/v2/sources/:id`        | `/v2/notebooks/:nid/sources/:sid`       |
| `/v2/sources/upload`     | `/v2/notebooks/:nid/sources/upload`     |

## 非目标

- SSE 动词统一（c70）
- Auth（c13）
- 分页形状（c68）
