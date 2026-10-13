# Tasks — c130 Embedding 能力层

> 测试 seam（沿用既有 harness，无新 runner）：bun test 单测/集成（`apps/server/tests/rag/`、`config.test.ts`、`db*.test.ts`、`api-contract/`）+ `just qa` 门禁。每个 task 收尾跑相关测试；全部完成后跑全量 `just qa`。

## A. 声明层

- [ ] T1 shared 模型目录 embedding 声明块
  - `packages/shared/src/schemas/model.ts`：ModelConfigSchema 增可选 `embedding`（dims / mrlDims / modalities / textOnlyLoad / prefixPreset，全部 `desc()`）；ModelInfo 增可选透出。
  - 校验：dims > 0；prefixPreset 属内置预设名（预设名常量导出，server 侧同源）。
  - `app.schema.gen.json` 再生成过 `just check-app-schema`；新 i18n key 过 `check-i18n-keys`。
  - 测试：`apps/server/tests/config.test.ts` 补解析用例（合法块 / 非法 dims / 未知 preset 拒绝）。
  - [blocked-by: ]

- [ ] T2 app.yaml 既有 embed 条目补 dims
  - bge-m3 / qwen3-embedding / text-embedding-3-small / gateway-embedding 条目补 `embedding.dims`（1024 / 1024 / 1536 / 1024——以各模型实际维度为准核实后填写）。
  - 行为零变化（纯声明）；`config.test.ts` 快照或解析断言跟进。
  - [blocked-by: T1]

## B. 引擎层

- [ ] T3 embedding-engine 模块（前缀 + 维度断言）
  - 新 `apps/server/src/rag/embedding-engine.ts`：内置 `PREFIX_PRESETS`（embeddinggemma2：query `task: search result | query: {q}`；document `title: {t}|text: {c}`，title 缺省 `none`）；`embedQuery(text)` / `embedDocuments(texts, {titles?})`；AI SDK 返回维度 ≠ 声明 dims → 明确报错。
  - 测试：新 `apps/server/tests/rag/embedding-engine.test.ts`（假 embed 模型注入：前缀拼接两侧、无声明零前缀、维度断言、titles 缺省 none）。
  - [blocked-by: T1]

- [ ] T4 embedder.ts 降级 facade + 消费方零改动回归
  - `embedSingle` → engine.embedQuery；`embedBatch(texts, opts?)` → engine.embedDocuments；模型单例解析留在 facade。
  - 回归：`rag/embed-similarity.test.ts`、`rag/epoch-wiring.test.ts`、`rag/unified-retrieval.test.ts` 全绿（无声明模型行为逐位不变）。
  - [blocked-by: T3]

- [ ] T5 indexSource 写入 chunk 元数据
  - `embed-strategy.indexSource`：插入向量时把 `embedding_model`（模型条目 id）、`embedding_dims`（实际向量长）随 chunk 行更新；`modality` 走列默认 `text`。
  - 测试：`rag/embed-similarity.test.ts` 或新用例断言 chunk 行元数据落库；重嵌路径更新而非残留旧值。
  - [blocked-by: T3]

## C. 存储层

- [ ] T6 chunks 表加列迁移
  - drizzle schema 加列（modality / embedding_model / embedding_dims / origin_type / origin_id）+ 迁移文件（generate 有已知非 TTY 问题则手写，见 docs/known-issues.md）；存量行回填 `origin_id = source_id`、`origin_type = 'source'`。
  - 测试：`apps/server/tests/db.test.ts` 补迁移后列存在 + 默认值断言；FTS5 触发器不受影响（keyword 策略回归）。
  - [blocked-by: ]

- [ ] T7 vec 维度感知（boot 警告 + 检索报错）
  - `vectors.ts`：解析现表 `embedding float[N]`；与声明维度不一致时 boot `console.warn`（含两值 + 重建指引），不阻断；KNN 查询入口检查不匹配 → 明确错误（错误码 `EMBEDDING_DIM_MISMATCH`，文案指向重建入口）。
  - 测试：新用例覆盖——表 1024 / 声明 768 时 warn + searchVectors 抛错 + countVectors/BM25 路径不报错。
  - [blocked-by: T1, T6]

## D. 暴露与文档

- [ ] T8 /v2/models 透出 embedding 能力块
  - models 路由把声明块并入 ModelInfo（additive）；`api-contract/` 相关断言跟进。
  - [blocked-by: T1]

- [ ] T9 文档：网关矩阵与精度警告
  - docs：OMLX / Ollama / llama.cpp / TEI 接入说明；EmbeddingGemma 2 精度要求（bf16/fp32，禁 fp16）；Mac MLX 与 Vulkan/ROCm 路径；维度不匹配的处理指引（指向 c131 重建入口）。
  - [blocked-by: T7]

- [ ] T10 全量门禁
  - `just qa` + `just test-bdd` 全绿；typecheck 含 web（ModelInfo additive 不破 Eden 类型）。
  - [blocked-by: T2, T4, T5, T6, T7, T8, T9]
