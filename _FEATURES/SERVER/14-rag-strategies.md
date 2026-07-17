# RAG 策略（RAG Strategies）

可插拔检索策略注册与笔记本级配置 — API-only。

---

### `rag-strategies-list`

- **Domain:** rag
- **Route:** `GET /v2/strategies`
- **说明:** 列出全局可用策略（embed、keyword/bm25、hybrid、page-index）
- **用户可见:** API-only
- **代码:** `apps/server/src/rag/router.ts`、`rag/registry.ts`

> NOTE: 待盘点

---

### `rag-strategies-get-notebook`

- **Domain:** rag
- **Route:** `GET /v2/notebooks/:nid/strategies`
- **说明:** 获取笔记本启用的策略 ID 列表
- **用户可见:** API-only
- **代码:** `apps/server/src/rag/router.ts`

> NOTE: 待盘点

---

### `rag-strategies-set-notebook`

- **Domain:** rag
- **Route:** `POST /v2/notebooks/:nid/strategies`
- **说明:** 设置笔记本策略组合（body: `{ strategies: string[] }`）
- **用户可见:** API-only
- **代码:** `apps/server/src/rag/router.ts`

> NOTE: 待盘点

## 已注册策略实现

| ID           | 实现文件                                     |
| ------------ | -------------------------------------------- |
| `embed`      | `apps/server/src/rag/embed-strategy.ts`      |
| `keyword`    | `apps/server/src/rag/keyword-strategy.ts`    |
| `hybrid`     | `apps/server/src/rag/hybrid-strategy.ts`     |
| `page-index` | `apps/server/src/rag/page-index-strategy.ts` |

> NOTE: 待盘点
