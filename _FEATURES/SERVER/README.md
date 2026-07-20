# SERVER — 后端 API 与能力索引

Crystalith v2 HTTP API（Elysia，`apps/server/src/`）。默认前缀 `/v2`，系统级路由无前缀或独立路径。

## 域总览

| 域                                                                            | 端点数（约） | 主要能力                                     | 用户可见                                                     |
| ----------------------------------------------------------------------------- | ------------ | -------------------------------------------- | ------------------------------------------------------------ |
| [00-system](00-system.md)                                                     | 6            | 健康检查、OpenAPI、AsyncAPI                  | Partial（诊断对话框探测依赖）                                |
| [01-notebooks](01-notebooks.md)                                               | 5            | 笔记本 CRUD、模板应用创建                    | Yes                                                          |
| [02-sessions-messages](02-sessions-messages.md)                               | 9            | 会话 CRUD、消息分页、会话转换                | Yes                                                          |
| [03-qa](03-qa.md)                                                             | 4            | RAG 问答、流式、预设、导出                   | Yes                                                          |
| [04-sources](04-sources.md)                                                   | 22           | 来源 CRUD、上传、搜索、标签、提取器          | Yes                                                          |
| [05-source-connectors](05-source-connectors.md)                               | 8            | 文件系统连接器绑定与同步                     | Yes                                                          |
| [06-research](06-research.md)                                                 | 12           | Deep Research HITL + SSE                     | Yes                                                          |
| [08-outputs](08-outputs.md)                                                   | 7            | Output 生成、列表、导出、转来源              | Yes                                                          |
| [09-studio](09-studio.md)                                                     | 12           | Slides Studio CRUD + 流式生成                | Yes                                                          |
| [10-refine](10-refine.md)                                                     | 3            | 引用感知摘要（paragraph/bullets/structured） | No — **dead-candidate**（Studio 走 outputs）                 |
| [11-templates-presets-commands](11-templates-presets-commands.md)             | 10           | 模板、Prompt 预设、命令列表                  | Partial                                                      |
| [12-citations-tasks-models-workspace](12-citations-tasks-models-workspace.md) | 10           | 引用、tasks HTTP、模型、workspace tools      | Mixed — citations/tasks **dead-candidate**；models/tools Yes |
| [13-eval](13-eval.md)                                                         | 8            | Golden Dataset + LLM-as-Judge                | No — **dead-candidate**                                      |
| [14-rag-strategies](14-rag-strategies.md)                                     | 3            | strategies **HTTP**（registry 内部保留）     | No — HTTP **dead-candidate**                                 |
| [15-cross-cutting](15-cross-cutting.md)                                       | —            | AI、RAG 管线、队列、DB、提取                 | Internal                                                     |

**合计 HTTP 端点约 128**（已移除 `POST /v2/analysis`）。盘点结论以各条目 `NOTE` 与 [`../MATRIX.md`](../MATRIX.md) / [`../API-ALIGNMENT-REPORT.md`](../API-ALIGNMENT-REPORT.md) 为准；**实现真相 = 当前代码**。

## 条目模板

每条能力记录：Domain、Route、说明、用户可见性、代码路径。

## OpenAPI / Scalar

- 规范：`GET /openapi.json`
- UI：`GET /openapi`（Scalar）
- AsyncAPI：`GET /asyncapi.json`
