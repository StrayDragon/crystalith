# 来源（Sources）

来源 CRUD、上传、搜索、标签、分块、提取器与扩展 QA。

---

### `sources-list`

- **Domain:** sources
- **Route:** `GET /v2/notebooks/:nid/sources`
- **说明:** 列出笔记本来源（支持 query 筛选）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-upload`

- **Domain:** sources
- **Route:** `POST /sources/upload`
- **说明:** multipart 文件上传；query `notebook_id`
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`、`sources/pipeline.ts`

> NOTE: 待盘点

---

### `sources-get`

- **Domain:** sources
- **Route:** `GET /sources/:id`
- **说明:** 获取单个来源元数据
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-delete`

- **Domain:** sources
- **Route:** `DELETE /sources/:id`
- **说明:** 删除来源（级联 chunks/vectors）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-parsers`

- **Domain:** sources
- **Route:** `GET /sources/parsers`
- **说明:** 列出已注册解析器（pdf/html/csv/text）
- **用户可见:** Partial
- **代码:** `apps/server/src/features/sources/router.ts`、`sources/parser-registry.ts`

> NOTE: 待盘点

---

### `sources-tags-list`

- **Domain:** sources
- **Route:** `GET /v2/notebooks/:nid/sources/tags`
- **说明:** 列出来源标签
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-tags-create`

- **Domain:** sources
- **Route:** `POST /v2/notebooks/:nid/sources/tags`
- **说明:** 创建标签
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-tags-patch`

- **Domain:** sources
- **Route:** `PATCH /v2/notebooks/:nid/sources/tags/:tid`
- **说明:** 更新标签名称/颜色
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-tags-delete`

- **Domain:** sources
- **Route:** `DELETE /v2/notebooks/:nid/sources/tags/:tid`
- **说明:** 删除标签
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-tags-assign`

- **Domain:** sources
- **Route:** `POST /v2/notebooks/:nid/sources/tags/:tid/sources`
- **说明:** 为来源批量打标
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-tags-unassign`

- **Domain:** sources
- **Route:** `DELETE /v2/notebooks/:nid/sources/tags/:tid/sources`
- **说明:** 批量移除标签
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-chunks`

- **Domain:** sources
- **Route:** `GET /sources/:id/chunks`
- **说明:** 获取来源分块列表
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-reembed`

- **Domain:** sources
- **Route:** `POST /sources/:id/re-embed`
- **说明:** 单来源重新分块与嵌入
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`、`rag/embedder.ts`

> NOTE: 待盘点

---

### `sources-search`

- **Domain:** sources
- **Route:** `POST /v2/notebooks/:nid/sources/search`
- **说明:** 网页搜索（SearXNG fast/deep）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-batch-delete`

- **Domain:** sources
- **Route:** `POST /v2/notebooks/:nid/sources/batch/delete`
- **说明:** 批量删除来源
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-batch-reembed`

- **Domain:** sources
- **Route:** `POST /v2/notebooks/:nid/sources/batch/re-embed`
- **说明:** 批量重新嵌入
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-from-url`

- **Domain:** sources
- **Route:** `POST /v2/notebooks/:nid/sources/from-url`
- **说明:** 从 URL 抓取并入库（SSRF 防护）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`、`shared/net/`

> NOTE: 待盘点

---

### `sources-extractors-get`

- **Domain:** sources
- **Route:** `GET /v2/notebooks/:nid/extractors`
- **说明:** 获取笔记本提取器策略
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `sources-extractors-patch`

- **Domain:** sources
- **Route:** `PATCH /v2/notebooks/:nid/extractors`
- **说明:** 更新提取器 mode / enabled_extractors
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/router.ts`

> NOTE: 待盘点

---

### `source-summary`

- **Domain:** sources (extras)
- **Route:** `GET /v2/notebooks/:nid/sources/:sid/summary`
- **说明:** AI 生成来源摘要、要点、主题
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/source-extras.router.ts`

> NOTE: 待盘点

---

### `source-qa`

- **Domain:** sources (extras)
- **Route:** `POST /v2/notebooks/:nid/sources/:sid/qa`
- **说明:** 单来源向量检索 QA
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/source-extras.router.ts`

> NOTE: 待盘点

---

### `source-qa-to-source`

- **Domain:** sources (extras)
- **Route:** `POST /v2/notebooks/:nid/sources/:sid/qa-to-source`
- **说明:** 将单来源 QA 对话保存为新来源
- **用户可见:** Yes
- **代码:** `apps/server/src/features/sources/source-extras.router.ts`

> NOTE: 待盘点
