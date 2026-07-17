# 笔记本（Notebooks）

---

### `notebooks-list`

- **Domain:** notebooks
- **Route:** `GET /v2/notebooks`
- **说明:** 列出所有笔记本，按 `updated_at` 降序
- **用户可见:** Yes
- **代码:** `apps/server/src/features/notebooks/router.ts`

> NOTE: 待盘点

---

### `notebooks-create`

- **Domain:** notebooks
- **Route:** `POST /v2/notebooks`
- **说明:** 创建笔记本；可选 `?template_id=` 应用模板（会话+标签）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/notebooks/router.ts`

> NOTE: 待盘点

---

### `notebooks-get`

- **Domain:** notebooks
- **Route:** `GET /v2/notebooks/:nid`
- **说明:** 获取单个笔记本
- **用户可见:** Yes
- **代码:** `apps/server/src/features/notebooks/router.ts`

> NOTE: 待盘点

---

### `notebooks-patch`

- **Domain:** notebooks
- **Route:** `PATCH /v2/notebooks/:nid`
- **说明:** 更新笔记本名称
- **用户可见:** Yes
- **代码:** `apps/server/src/features/notebooks/router.ts`

> NOTE: 待盘点

---

### `notebooks-delete`

- **Domain:** notebooks
- **Route:** `DELETE /v2/notebooks/:nid`
- **说明:** 删除笔记本（级联）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/notebooks/router.ts`

> NOTE: 待盘点
