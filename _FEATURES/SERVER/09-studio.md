# Studio Slides

Slidev 演示文稿工作流 CRUD 与流式生成。

---

### `studio-slides-create`

- **Domain:** studio
- **Route:** `POST /v2/studio/slides`
- **说明:** 创建 slides 记录
- **用户可见:** Yes
- **代码:** `apps/server/src/features/studio/router.ts`、`studio/service.ts`

> NOTE: 待盘点

---

### `studio-slides-list`

- **Domain:** studio
- **Route:** `GET /v2/studio/slides`
- **说明:** 列出 slides（query notebook_id）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/studio/router.ts`

> NOTE: 待盘点

---

### `studio-slides-get`

- **Domain:** studio
- **Route:** `GET /v2/studio/slides/:id`
- **说明:** 获取单个 slide 项目
- **用户可见:** Yes
- **代码:** `apps/server/src/features/studio/router.ts`

> NOTE: 待盘点

---

### `studio-slides-latest`

- **Domain:** studio
- **Route:** `GET /v2/studio/slides/latest`
- **说明:** 获取笔记本最新 slide
- **用户可见:** Yes
- **代码:** `apps/server/src/features/studio/router.ts`

> NOTE: 待盘点

---

### `studio-slides-patch`

- **Domain:** studio
- **Route:** `PATCH /v2/studio/slides/:id`
- **说明:** 更新标题/配置等元数据
- **用户可见:** Yes
- **代码:** `apps/server/src/features/studio/router.ts`

> NOTE: 待盘点

---

### `studio-slides-outline-generate`

- **Domain:** studio
- **Route:** `POST /v2/studio/slides/:id/outline`
- **说明:** AI 生成大纲
- **用户可见:** Yes
- **代码:** `apps/server/src/features/studio/router.ts`、`studio/service.ts`

> NOTE: 待盘点

---

### `studio-slides-outline-put`

- **Domain:** studio
- **Route:** `PUT /v2/studio/slides/:id/outline`
- **说明:** 手动更新大纲 JSON
- **用户可见:** Yes
- **代码:** `apps/server/src/features/studio/router.ts`

> NOTE: 待盘点

---

### `studio-slides-markdown-generate`

- **Domain:** studio
- **Route:** `POST /v2/studio/slides/:id/markdown`
- **说明:** AI 由大纲生成 Slidev Markdown
- **用户可见:** Yes
- **代码:** `apps/server/src/features/studio/router.ts`

> NOTE: 待盘点

---

### `studio-slides-markdown-put`

- **Domain:** studio
- **Route:** `PUT /v2/studio/slides/:id/markdown`
- **说明:** 手动更新 Markdown
- **用户可见:** Yes
- **代码:** `apps/server/src/features/studio/router.ts`

> NOTE: 待盘点

---

### `studio-slides-outline-stream`

- **Domain:** studio
- **Route:** `GET /v2/studio/slides/:id/outline/stream`
- **说明:** SSE 流式生成大纲
- **用户可见:** Yes
- **代码:** `apps/server/src/features/studio/router.ts`

> NOTE: 待盘点

---

### `studio-slides-markdown-stream`

- **Domain:** studio
- **Route:** `GET /v2/studio/slides/:id/markdown/stream`
- **说明:** SSE 流式生成 Markdown
- **用户可见:** Yes
- **代码:** `apps/server/src/features/studio/router.ts`

> NOTE: 待盘点
