## 决策

1. **分页响应统一为 `PaginatedSchema`**：`{ items, total, offset, limit }`。不再对「文档写分页、响应仍裸数组」保持双轨。
2. **BREAKING 可接受、无 alias**：列表形状变更与 c67 同批前端升级；不提供裸数组兼容层（除非 tasks 明确写 alias）。
3. **OpenAPI SSOT 路径**：以 Elysia handler 真实 path 为准；`registerApiDoc` 必须同步。Scalar `/openapi` 若仍因 Zod v4 生成失败，本 change 以「路由 Zod 挂载 + apiDocs 路径正确」为验收，生成管线修复可单列 follow-up。
4. **小列表可默认较大 limit**：notebooks 全量可暂保留或加分页但默认 limit=100；本 change 优先覆盖 messages/sessions/sources/outputs/research/slides/tasks。

## 迁移

| 端点族                                             | 现状                                | 目标                                                                          |
| -------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| messages list                                      | offset/limit + 裸数组               | PaginatedSchema(Message)                                                      |
| sessions list                                      | 手写 slice，无 total                | PaginationParams + PaginatedSchema                                            |
| sources / outputs / research / slides / tasks list | 全量或半分页裸数组                  | PaginationParams + PaginatedSchema                                            |
| OpenAPI citations context                          | `/v2/citations/context`             | `/v2/notebooks/:nid/citations/context`                                        |
| AsyncAPI research stream                           | `/v2/research/sessions/{id}/stream` | `/v2/research/{id}/stream`（与实现一致；query notebookId 若已要求则文档注明） |

## 非目标

- Phase 3 嵌套路径 `/v2/notebooks/:nid/outputs` 等
- Phase 4 SSE 动词统一
- 替换 zod-to-openapi 引擎（除非阻塞本 change 验收）
