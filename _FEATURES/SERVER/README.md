# SERVER — 后端 API 与能力索引

Crystalith v2 HTTP API（Elysia，`apps/server/src/`）。默认前缀 `/v2`。
**以当前代码为准**（c73 后约 16 个 feature router）。

## 域总览

| 域                                                                            | 端点（约）       | 主要能力                                          | 用户可见                    |
| ----------------------------------------------------------------------------- | ---------------- | ------------------------------------------------- | --------------------------- |
| [00-system](00-system.md)                                                     | 6                | 健康检查、OpenAPI、AsyncAPI                       | Partial                     |
| [01-notebooks](01-notebooks.md)                                               | 5                | 笔记本 CRUD                                       | Yes                         |
| [02-sessions-messages](02-sessions-messages.md)                               | 9                | 会话 / 消息                                       | Yes                         |
| [03-qa](03-qa.md)                                                             | 3                | RAG 问答（~~presets list~~ c73 删路由）           | Yes                         |
| [04-sources](04-sources.md)                                                   | 22               | 来源 CRUD                                         | Yes                         |
| [05-source-connectors](05-source-connectors.md)                               | 8                | 连接器（解绑 UI 缺口）                            | Yes                         |
| [06-research](06-research.md)                                                 | 12               | Deep Research HITL + SSE                          | Yes（modify 假勾选见 NOTE） |
| [08-outputs](08-outputs.md)                                                   | 6                | Output CRUD（~~types~~ c73）                      | Yes                         |
| [09-studio](09-studio.md)                                                     | 12               | Slides Studio + SSE                               | Yes                         |
| [10-refine](10-refine.md)                                                     | 0                | **removed c73**                                   | —                           |
| [11-templates-presets-commands](11-templates-presets-commands.md)             | 10               | 模板 / prompt-presets / commands                  | Partial                     |
| [12-citations-tasks-models-workspace](12-citations-tasks-models-workspace.md) | models+workspace | citations/tasks **removed c73**；models/tools Yes | Mixed                       |
| [13-eval](13-eval.md)                                                         | 0                | **removed c73**                                   | —                           |
| [14-rag-strategies](14-rag-strategies.md)                                     | 0 HTTP           | HTTP **removed**；`ragRegistry` 保留              | Internal                    |
| [15-cross-cutting](15-cross-cutting.md)                                       | —                | AI / RAG / 提取（TaskQueue **removed**）          | Internal                    |

对照：[`../MATRIX.md`](../MATRIX.md)、[`../API-ALIGNMENT-REPORT.md`](../API-ALIGNMENT-REPORT.md)。

## OpenAPI / Scalar

- `GET /openapi.json` · `GET /openapi` · `GET /asyncapi.json`
