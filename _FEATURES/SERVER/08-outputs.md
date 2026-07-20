# 输出（Outputs）

Output 生成、CRUD、导出与转来源。

---

### `outputs-types`

- **Domain:** outputs
- **Route:** ~~`GET /v2/outputs/types`~~ **removed (c73)**
- **说明:** 曾列出 Output 类型元数据；FE 用 `GET /v2/workspace/tools`
- **用户可见:** No
- **代码（仍保留）:** `outputs/generator.ts`（`OUTPUT_META` / `FRONTEND_BUNDLES` 供 workspace tools）

> NOTE: **路由已移除**；元数据经 workspace/tools 暴露

---

### `outputs-create`

- **Domain:** outputs
- **Route:** `POST /v2/outputs`
- **说明:** 生成新 Output（AI pipeline）；入队或同步
- **用户可见:** Yes
- **代码:** `apps/server/src/features/outputs/router.ts`、`outputs/pipeline.ts`

> NOTE: 待盘点

---

### `outputs-list`

- **Domain:** outputs
- **Route:** `GET /v2/outputs`
- **说明:** 按 `notebook_id` 列出 Output
- **用户可见:** Yes
- **代码:** `apps/server/src/features/outputs/router.ts`

> NOTE: 待盘点

---

### `outputs-get`

- **Domain:** outputs
- **Route:** `GET /v2/outputs/:id`
- **说明:** 获取单个 Output（可选 notebook 校验 query）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/outputs/router.ts`

> NOTE: 待盘点

---

### `outputs-delete`

- **Domain:** outputs
- **Route:** `DELETE /v2/outputs/:id`
- **说明:** 删除 Output
- **用户可见:** Yes
- **代码:** `apps/server/src/features/outputs/router.ts`

> NOTE: 待盘点

---

### `outputs-export`

- **Domain:** outputs
- **Route:** `GET /v2/outputs/:id/export`
- **说明:** 导出 Markdown/JSON（含 citations）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/outputs/router.ts`、`outputs/render.ts`

> NOTE: 待盘点

---

### `outputs-convert-to-source`

- **Domain:** outputs
- **Route:** `POST /v2/outputs/:id/convert-to-source`
- **说明:** Output 内容 → 新 source（chunk + embed）
- **用户可见:** Yes
- **代码:** `apps/server/src/features/outputs/router.ts`

> NOTE: 待盘点
