# RAG 策略（RAG Strategies）

可插拔检索策略：**内部** `ragRegistry` 被 QA / outputs / studio / eval 调用；本文件的 **HTTP** 仅用于列表/读写 notebook 策略配置。

> **2026-07-20（以代码为准）：** HTTP 无 FE → **dead-candidate / 可移除 HTTP**。删除时 **保留** `rag/registry.ts` 与各 strategy 实现。

---

### `rag-strategies-list`

- **Domain:** rag
- **Route:** `GET /v2/strategies`
- **说明:** 列出全局可用策略（embed、keyword/bm25、hybrid、page-index）
- **用户可见:** No
- **代码:** `apps/server/src/rag/router.ts`、`rag/registry.ts`

> NOTE: 删除候选 — strategies HTTP；保留 registry

---

### `rag-strategies-get-notebook`

- **Domain:** rag
- **Route:** `GET /v2/notebooks/:nid/strategies`
- **说明:** 获取笔记本启用的策略 ID 列表
- **用户可见:** No
- **代码:** `apps/server/src/rag/router.ts`

> NOTE: 删除候选 — 同上

---

### `rag-strategies-set-notebook`

- **Domain:** rag
- **Route:** `POST /v2/notebooks/:nid/strategies`
- **说明:** 设置笔记本策略组合（body: `{ strategies: string[] }`）
- **用户可见:** No
- **代码:** `apps/server/src/rag/router.ts`

> NOTE: 删除候选 — 同上

## 已注册策略实现（内部，保留）

| ID           | 实现文件                                     |
| ------------ | -------------------------------------------- |
| `embed`      | `apps/server/src/rag/embed-strategy.ts`      |
| `keyword`    | `apps/server/src/rag/keyword-strategy.ts`    |
| `hybrid`     | `apps/server/src/rag/hybrid-strategy.ts`     |
| `page-index` | `apps/server/src/rag/page-index-strategy.ts` |

> NOTE: 保留 — 运行时检索路径依赖
