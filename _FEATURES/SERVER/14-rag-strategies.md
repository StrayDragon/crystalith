# RAG 策略

## HTTP — **已移除 (c73, 2026-07-20)**

| 曾有路由                                 | 状态    |
| ---------------------------------------- | ------- |
| `GET /v2/strategies`                     | removed |
| `GET/POST /v2/notebooks/:nid/strategies` | removed |

已删：`apps/server/src/rag/router.ts`、shared `schemas/rag.ts`（wire）。

## 运行时（保留）

内部 `ragRegistry` 仍由 QA / outputs / studio 调用；策略在 `registry.ts` 模块加载时注册。

| ID           | 实现                                         |
| ------------ | -------------------------------------------- |
| `embed`      | `apps/server/src/rag/embed-strategy.ts`      |
| `keyword`    | `apps/server/src/rag/keyword-strategy.ts`    |
| `hybrid`     | `apps/server/src/rag/hybrid-strategy.ts`     |
| `page-index` | `apps/server/src/rag/page-index-strategy.ts` |

> NOTE: HTTP **已移除**；registry **保留**
