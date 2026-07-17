# 评测（Eval）

内置 Eval Benchmark Harness — API-only，无生产 UI。

---

### `eval-datasets-list`

- **Domain:** eval
- **Route:** `GET /v2/eval/datasets`
- **说明:** 列出 Golden Dataset
- **用户可见:** API-only
- **代码:** `apps/server/src/features/eval/router.ts`、`eval/dataset.ts`

> NOTE: 保留 — API-only 开发/评测工具；有 spec r11；无生产 UI 与 CI 接线

---

### `eval-datasets-create`

- **Domain:** eval
- **Route:** `POST /v2/eval/datasets`
- **说明:** 创建数据集
- **用户可见:** API-only
- **代码:** `apps/server/src/features/eval/router.ts`

> NOTE: 保留 — API-only 开发/评测工具；有 spec r11；无生产 UI 与 CI 接线

---

### `eval-datasets-get`

- **Domain:** eval
- **Route:** `GET /v2/eval/datasets/:id`
- **说明:** 获取数据集及 items
- **用户可见:** API-only
- **代码:** `apps/server/src/features/eval/router.ts`

> NOTE: 保留 — API-only 开发/评测工具；有 spec r11；无生产 UI 与 CI 接线

---

### `eval-datasets-delete`

- **Domain:** eval
- **Route:** `DELETE /v2/eval/datasets/:id`
- **说明:** 删除数据集
- **用户可见:** API-only
- **代码:** `apps/server/src/features/eval/router.ts`

> NOTE: 保留 — API-only 开发/评测工具；有 spec r11；无生产 UI 与 CI 接线

---

### `eval-datasets-import`

- **Domain:** eval
- **Route:** `POST /v2/eval/datasets/import`
- **说明:** 从 JSON 导入数据集
- **用户可见:** API-only
- **代码:** `apps/server/src/features/eval/router.ts`

> NOTE: 保留 — API-only 开发/评测工具；有 spec r11；无生产 UI 与 CI 接线

---

### `eval-datasets-export`

- **Domain:** eval
- **Route:** `GET /v2/eval/datasets/:id/export`
- **说明:** 导出数据集 JSON
- **用户可见:** API-only
- **代码:** `apps/server/src/features/eval/router.ts`

> NOTE: 保留 — API-only 开发/评测工具；有 spec r11；无生产 UI 与 CI 接线

---

### `eval-runs-list`

- **Domain:** eval
- **Route:** `GET /v2/eval/runs`
- **说明:** 列出评测运行记录
- **用户可见:** API-only
- **代码:** `apps/server/src/features/eval/router.ts`

> NOTE: 保留 — API-only 开发/评测工具；有 spec r11；无生产 UI 与 CI 接线

---

### `eval-runs-create`

- **Domain:** eval
- **Route:** `POST /v2/eval/runs`
- **说明:** 对 dataset 按 strategy_ids 执行评测（LLM-as-Judge）
- **用户可见:** API-only
- **代码:** `apps/server/src/features/eval/router.ts`、`eval/runner.ts`、`eval/metrics.ts`

> NOTE: 保留 — API-only 开发/评测工具；有 spec r11；无生产 UI 与 CI 接线
