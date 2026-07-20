# 横切能力（Cross-Cutting）

非独立 HTTP 路由的基础设施：AI、RAG 管线、队列、提取、数据库。

---

### `ai-provider-registry`

- **Domain:** ai
- **Route:** —
- **说明:** Provider 白名单 + 动态 `import()`；`openai-compatible` 为主路径
- **用户可见:** Internal
- **代码:** `apps/server/src/ai/providers.ts`、`ai/middleware.ts`

> NOTE: 待盘点

---

### `ai-generate-stream`

- **Domain:** ai
- **Route:** —
- **说明:** `generateObject` / `generateText` / `streamText` 封装；AI SDK v7
- **用户可见:** Internal
- **代码:** `apps/server/src/ai/`、`features/qa/handler.ts`

> NOTE: 待盘点

---

### `ai-tool-retrieve-sources`

- **Domain:** ai
- **Route:** —
- **说明:** QA Agent `retrieveSources` tool 定义
- **用户可见:** Internal
- **代码:** `apps/server/src/ai/tools/retrieve-sources.ts`

> NOTE: 待盘点

---

### `rag-chunk-embed-search`

- **Domain:** rag
- **Route:** —
- **说明:** 分块、批量嵌入、向量检索、缓存 epoch
- **用户可见:** Internal
- **代码:** `apps/server/src/rag/chunker.ts`、`embedder.ts`、`search.ts`、`cache.ts`

> NOTE: 待盘点

---

### `rag-multi-query-diversity`

- **Domain:** rag
- **Route:** —
- **说明:** 多查询扩展与结果多样性重排
- **用户可见:** Internal
- **代码:** `apps/server/src/rag/multi-query.ts`、`diversity.ts`

> NOTE: 待盘点

---

### `task-queue-worker`

- **Domain:** tasks
- **Route:** —
- **说明:** `TaskQueue` 持久队列 + worker；崩溃恢复 `recoverStaleTasks`。当前几乎只服务 refine HTTP。
- **用户可见:** Internal
- **代码:** `apps/server/src/shared/queue.ts`、`features/tasks/worker.ts`、`server.ts`

> NOTE: 2026-07-20 — 随 `/v2/refine*` + `/v2/tasks*` 删除候选一并评估；若无 enqueue 生产者可整段移除

---

### `task-types`

- **Domain:** tasks
- **Route:** —
- **说明:** DB/enqueue 类型仅为 `refine` | `document_parse`（**不是** output / source_ingest）。`document_parse` worker 分支无调用方。
- **用户可见:** Internal
- **代码:** `apps/server/src/features/tasks/worker.ts`、`shared/queue.ts`、`db/schema.ts` tasks.type

> NOTE: 2026-07-20 — 旧文档写 output/source_ingest 为错误；以 schema enum 为准

---

### `source-ingest-pipeline`

- **Domain:** sources
- **Route:** —
- **说明:** 解析 → 分块 → 嵌入 → 状态机（processing/ready/failed）
- **用户可见:** Internal
- **代码:** `apps/server/src/features/sources/pipeline.ts`、`parsers/`、`dedup.ts`

> NOTE: 待盘点

---

### `extraction-net-guard`

- **Domain:** shared
- **Route:** —
- **说明:** URL 抓取 SSRF 防护、重定向守卫、规范化
- **用户可见:** Internal
- **代码:** `apps/server/src/shared/net/`、`shared/extraction.ts`

> NOTE: 待盘点

---

### `config-runtime`

- **Domain:** shared
- **Route:** —
- **说明:** `config/app.yaml` + `secret.env` 加载；模型与可选服务配置
- **用户可见:** Internal
- **代码:** `apps/server/src/shared/config.ts`、`config/`

> NOTE: 待盘点

---

### `db-schema-tables`

- **Domain:** db
- **Route:** —
- **说明:** Drizzle SQLite 表（16 业务表 + 4 eval 表）；`vec_chunks` 虚拟表在 `vectors.ts`
- **用户可见:** Internal
- **代码:** `apps/server/src/db/schema.ts`、`db/vectors.ts`、`db/migrate`

## 主要数据表映射

| 表                                                           | 域        |
| ------------------------------------------------------------ | --------- |
| `notebooks`                                                  | 笔记本    |
| `sessions`, `messages`                                       | 会话/消息 |
| `sources`, `chunks`, `source_tags`, `source_tag_map`         | 来源      |
| `outputs`                                                    | Output    |
| `templates`, `prompt_presets`                                | 模板/预设 |
| `source_connector_bindings`                                  | 连接器    |
| `notebook_extractor_policies`                                | 提取器    |
| `studio_slides`                                              | Slides    |
| `research_sessions`                                          | 研究      |
| `tasks`                                                      | 任务队列  |
| `eval_datasets`, `eval_items`, `eval_runs`, `eval_run_items` | 评测      |

> NOTE: 待盘点

---

### `research-agent-background`

- **Domain:** research
- **Route:** —
- **说明:** 研究 Agent 步骤机、锁过期清理 `cleanupExpiredLocks`
- **用户可见:** Internal
- **代码:** `apps/server/src/features/research/agent.ts`、`research/lock.ts`

> NOTE: 待盘点

---

### `output-generator-pipeline`

- **Domain:** outputs
- **Route:** —
- **说明:** 结构化 Output 生成（Zod schema per type）、fallback 处理
- **用户可见:** Internal
- **代码:** `apps/server/src/features/outputs/generator.ts`、`pipeline.ts`

> NOTE: 待盘点

---

### `qa-confidence-judge`

- **Domain:** qa
- **Route:** —
- **说明:** 检索+评判、stats preset JSON 解析
- **用户可见:** Internal
- **代码:** `apps/server/src/features/qa/retrieve-and-judge.ts`、`qa/confidence.ts`

> NOTE: 待盘点
