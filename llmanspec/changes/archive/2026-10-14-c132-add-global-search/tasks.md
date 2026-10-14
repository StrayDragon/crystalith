# Tasks — c132 全局搜索（SearchService + /v2/search + 分组召回 UI + 中文 FTS）

> 测试 seam（2026-10-14 用户确认，六缝全要，全部沿用既有 harness 无新 runner）：
> ① API 集成缝（setupIntegrationEnv + 假 embed）② SearchService 单元缝（临时 DB + mock embed）
> ③ CJK 分词纯函数 + FTS 中文召回缝 ④ origin 过滤零变化缝（既有检索测试保持绿 + searchVectors 断言）
> ⑤ outputs 索引生命周期缝（集成）⑥ web rstest + e2e @p0 一条 happy path。
> 产出与验收都在 change 分支上测量；`just qa` 从仓库根跑。

## A. 中文关键词地基

- [x] T1 CJK tokenizer 纯函数
  - `rag/cjk-tokenizer.ts`：`tokenizeForIndex(text)`（CJK 逐字滑窗 bigram、拉丁/数字整词小写、空格连接）+ `buildMatchQuery(query)`（token 引号包裹 + `OR` 连接，防 FTS 语法注入）。
  - 验证：`bun test apps/server/tests/rag/cjk-tokenizer.test.ts`（③缝：滑窗/整词/混合/单字/空串/引号注入安全）。
  - [blocked-by: ]

- [x] T2 text_tokens 列 + FTS 通道切换
  - migration 0010：`chunks.text_tokens TEXT NULL`；db 层 chunk 写入 helper（内部算 text_tokens），6 个写入点（sources/pipeline、from-url、source-extras、sessions/convert、research/convert、outputs convert-to-source）全部改走。
  - boot ensure 幂等：回填 NULL 行 → chunks_fts 旧形状（索引 `text`）检测即 DROP + 新 DDL（索引 `text_tokens`，触发器形状不变搬 `new/old.text_tokens`）+ `('rebuild')` 重建。
  - keyword 通道检索改 MATCH `buildMatchQuery(query)`（FTS 列 `text_tokens`）。
  - 验证：中文召回用例（真 FTS：2 字词 / 3+ 字词 / 拉丁 / 混合均命中且 bm25 可排，③缝）+ 既有 keyword/hybrid/retrieval 测试全绿（`bun test apps/server/tests/rag/`）。
  - [blocked-by: T1]

## B. origin 泛化与零变化护栏

- [x] T3 检索 origin 过滤（既有行为零变化）
  - `searchVectors` 与 keyword FTS 查询加 `originTypes` 参数，**缺省 `['source']`**；research retrieveSources 直连处同缺省——5 个既有消费方（QA / studio / outputs 管线 / 单源 QA / research）行为零变化。
  - 验证：searchVectors/keyword 过滤断言（origin_type='output' 行不进默认检索；显式全量时进，④缝）+ 既有 `tests/rag/`、`tests/qa/`、`tests/sources/` 全绿。
  - [blocked-by: T2]

- [x] T4 outputs 派生同步索引 + 级联 + 隐藏
  - migration 0011：`sources.derived_output_id INTEGER NULL` + `ix_sources_derived_output_id`。
  - 索引服务（outputs 行持久化点统一收口，生成响应前**同步**执行）：建派生行（filename `<type>-<id>`、hidden）→ `outputs/render.ts` 类型感知分块 → 写入 seam（origin_type='output'/origin_id/modality）→ 同步嵌入 → ready/failed；按 `derived_output_id` 先删旧再建保证幂等；嵌入失败不拖垮生成（派生行 failed + errorMessage）。
  - `handleDeleteOutput` 级联清理派生行（deleteSourceVectors + 删行 → chunks FK 级联 + FTS 触发器）；sources 用户可见查询统一排除派生行（单一 helper 收口，禁止各处手写谓词）。
  - `GET /v2/notebooks/:nid/search-index` 扩展 `derivedFailedCount`。
  - 验证：生命周期集成测试（⑤缝：建→隐藏+ready；嵌入失败→failed 且生成不炸；删→级联净；全局重建覆盖派生行；列表/详情/统计不见派生行）。
  - [blocked-by: T2]

## C. 搜索服务与 API

- [x] T5 SearchService（固定 hybrid + 降级 + facets）
  - `rag/search-service.ts`：scope（all | notebook）双通道——KNN（`searchVectors` originTypes 全量）× keyword（FTS 通道）RRF 融合（k=60 同款）+ minScore/topK（默认来自 config）+ facets（notebooks / originTypes 分组计数）。
  - 降级矩阵：索引状态非 ready → 跳 KNN 通道 + `degraded` 透出；embed 网关失败 → 跳 KNN + `degraded:'embed_unavailable'`；keyword 通道恒可用。
  - config 新增 search 默认项（topK 默认 / 延迟预算）→ `shared/config.ts` Zod + `just gen-app-schema` + `just check-app-schema` + `just check-env-examples`（drift 门）。
  - 验证：`bun test apps/server/tests/search/service.test.ts`（②缝：融合、降级矩阵、scope、facets、topK/minScore）。
  - [blocked-by: T3]

- [x] T6 POST /v2/search wire
  - `packages/shared/src/schemas/search.ts`（desc() + `.openapi()`，SearchRequest/Response/Facet/Item 系列）+ `features/search/router.ts` + `registerApiDoc`（tag `search`、中文业务 summary）+ Eden 类型透出自查。
  - 验证：`bun test apps/server/tests/search/api.test.ts`（①缝：wire 合约、scope 过滤、facets、originTypes、degraded 字段、跳转引用字段、参数校验失败）+ `bun typecheck`。
  - [blocked-by: T5]

## D. 前端

- [x] T7 顶栏本地搜索模式 + 分组结果 + 跳转
  - `WorkspaceTopbarSearch` 增「本地知识库」模式（默认）：防抖输入即搜；面板内范围切换（当前笔记本 / 全局）；结果按 facets 分组渲染（笔记本 → 类型组头 + 条目）；跳转（source chunk → `setJumpToCitation(chunkId)` + 打开 source 详情；output → `overlays.setViewerOutputId(originId)`）；degraded 横幅提示；testids + i18n keys。
  - 新测试文件注册 `.fallowrc.json` entry。
  - 验证：web Rstest（⑥缝：hook 防抖/范围切换/请求态、组件模式切换/分组渲染/跳转回调/degraded）`bun run --cwd apps/web test:ci`。
  - [blocked-by: T6]

## E. 实测、文档与门禁

- [x] T8 全局 KNN 延迟实测 + 文档
  - 真机数据实测 scope=all 全链路（无分区谓词 KNN + FTS + 融合）延迟，对照 config 预算；超标才启用 notebook 扇出备选（回 design.md 补记实测数据与决策）。
  - docs：`docs/search.md`（索引对象范围、降级语义、预算与取消边界）；AGENTS/README 如有搜索入口描述同步。
  - [blocked-by: T6]

- [x] T9 e2e + 全量门禁
  - e2e @p0 happy path：顶栏搜索 → 分组结果 → 跳转（source 与 output 各一）。
  - `just qa` 全绿；`just test-bdd` 自查（CRUD 子集不受新列/过滤影响）。
  - [blocked-by: T7, T8]
