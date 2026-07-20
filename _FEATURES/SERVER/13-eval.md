# 评测（Eval）

内置 **RAG 质量** Benchmark Harness（Golden Dataset + LLM-as-Judge）。

- **流程:** dataset items × strategyIds → `ragRegistry.retrieveWith` → 生成答案 → `judgeAnswer` → recall/precision → `eval_runs` / `eval_run_items`
- **入口:** 仅 HTTP `/v2/eval/*` 或进程内 `runEval`。注释中的 `bun run eval` CLI **不存在**
- **门禁:** 不在 `just qa`；live spec `quality-and-regression` r11 仍写 MUST（删除代码时需缩 spec）

> **2026-07-20 决策（以代码为准）：** 无用户功能 → **dead-candidate / 可移除**。下列条目仍描述现存实现，NOTE 统一为移除候选。

---

### `eval-datasets-list`

- **Domain:** eval
- **Route:** `GET /v2/eval/datasets`
- **说明:** 列出 Golden Dataset
- **用户可见:** No
- **代码:** `apps/server/src/features/eval/router.ts`、`eval/dataset.ts`

> NOTE: 删除候选 — 整域 `/v2/eval/*`；无 UI/CI/CLI

---

### `eval-datasets-create`

- **Domain:** eval
- **Route:** `POST /v2/eval/datasets`
- **说明:** 创建数据集
- **用户可见:** No
- **代码:** `apps/server/src/features/eval/router.ts`

> NOTE: 删除候选 — 同上

---

### `eval-datasets-get`

- **Domain:** eval
- **Route:** `GET /v2/eval/datasets/:id`
- **说明:** 获取数据集及 items
- **用户可见:** No
- **代码:** `apps/server/src/features/eval/router.ts`

> NOTE: 删除候选 — 同上

---

### `eval-datasets-delete`

- **Domain:** eval
- **Route:** `DELETE /v2/eval/datasets/:id`
- **说明:** 删除数据集
- **用户可见:** No
- **代码:** `apps/server/src/features/eval/router.ts`

> NOTE: 删除候选 — 同上

---

### `eval-datasets-import`

- **Domain:** eval
- **Route:** `POST /v2/eval/datasets/import`
- **说明:** 从 JSON 导入数据集
- **用户可见:** No
- **代码:** `apps/server/src/features/eval/router.ts`

> NOTE: 删除候选 — 同上

---

### `eval-datasets-export`

- **Domain:** eval
- **Route:** `GET /v2/eval/datasets/:id/export`
- **说明:** 导出数据集 JSON
- **用户可见:** No
- **代码:** `apps/server/src/features/eval/router.ts`

> NOTE: 删除候选 — 同上

---

### `eval-runs-list`

- **Domain:** eval
- **Route:** `GET /v2/eval/runs`
- **说明:** 列出评测运行记录
- **用户可见:** No
- **代码:** `apps/server/src/features/eval/router.ts`

> NOTE: 删除候选 — 同上

---

### `eval-runs-create`

- **Domain:** eval
- **Route:** `POST /v2/eval/runs`
- **说明:** 对 dataset 按 strategyIds 执行评测（LLM-as-Judge）
- **用户可见:** No
- **代码:** `apps/server/src/features/eval/router.ts`、`eval/runner.ts`、`eval/metrics.ts`

> NOTE: 删除候选 — 同上
