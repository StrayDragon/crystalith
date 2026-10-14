# c132 设计：全局搜索（SearchService + /v2/search + 分组召回 UI + 中文 FTS）

> 2026-10-14 深挖定稿。三个用户拍板（2026-10-14）：
> ① **降级以 UX 优先**——重建/维度不匹配期间搜索照常出 keyword 结果并显式带降级标志；
> ② **索引时机要「准确不惊诧」**——outputs 生成响应返回即代表「已可搜」（同步索引），不出现"刚生成却搜不到"；
> ③ **数据表可自由调整**——为 UX 与维护性直接加列/迁移，不做 metadata 变通。

## 0. 调研基线（支撑下述决策的代码事实）

- `chunks.source_id` NOT NULL + FK 级联（`db/schema/sources.ts:54`），且有 `uq_chunks_source_id_chunk_index` 唯一索引、vec_chunks 按 `source_id` 分区（`db/vectors.ts:19-24`）、FTS 查询 JOIN sources 取 notebook（`rag/keyword-strategy.ts:103`）——output chunks 绕开 source 行代价极大。
- `convert-to-source`（`features/outputs/router.ts:540-599`）是"建真 source 行 + chunks + `EmbedStrategy.indexSource` + ready/failed"的现成同款。
- 全局重建枚举 `status='ready'` 的 sources（`rag/index-rebuild.ts:183-191`）——派生行置 ready 后自动被重嵌覆盖。
- 检索消费方 5 处全部经过两个 SQL 收口点：`searchVectors`（`db/vectors.ts:203`，QA/studio/outputs 管线/单源 QA/research retrieveSources——后者直连）与 KeywordStrategy FTS 查询（`rag/keyword-strategy.ts:89`）。
- outputs 表无 status 机、append-only（每次生成都插新行，`features/outputs/pipeline.ts:297`）；`handleDeleteOutput`（`outputs/router.ts:451`）不清理派生物。
- bun:sqlite（SQLite 3.53.4）**无自定义 SQL 函数 API**（`db.createFunction`/`db.function` 均不存在）——SQL 触发器内调 JS 分词不可行。
- FTS spike 实测：unicode61 中文 0 命中；trigram 对 2 字中文词（向量/检索/索引）0 命中；char-bigram + 查询侧 OR 组合全长度可用且 bm25 可排。
- chunk 写入点共 6 处：`sources/pipeline.ts:190`、`sources/from-url.service.ts:135`、`sources/source-extras.router.ts:228`、`sessions/convert.ts:109`、`research/convert.ts:77`、`outputs/router.ts:557`。
- web 跳转基建已存在：source chunk → `workspaceStore.setJumpToCitation(chunkId)`；output → `overlays.setViewerOutputId(id)`（`layout/WorkspaceLayout.tsx:374-386`）。顶栏已有模式化搜索面板 `WorkspaceTopbarSearch`（现仅 Fast 联网搜）。
- specs：新 capability `global-search`，rN 自 **r484** 起；场景风格沿用 r480–r483（GWT + 引用具体测试用例）。

## 1. 总体架构

```
POST /v2/search（wire Zod：packages/shared/src/schemas/search.ts）
  → features/search/router.ts（registerApiDoc）
  → rag/search-service.ts（SearchService：固定 hybrid 融合 + 降级 + facets）
      ├─ db/vectors.ts searchVectors(…, { originTypes, scope })   ← KNN 通道
      ├─ rag/fts.ts（新）ftsSearch(…, { originTypes, scope })      ← BM25 通道（text_tokens）
      └─ 复用 rrfFuse 语义（embed 通道 × keyword 通道，k=60 同款）
```

- SearchService 是 `rag/` 内的独立服务，**不动 `RAGStrategy` 接口、不读 per-notebook strategy_configs**（锁定决策）。
- Eden 类型经 `treaty<App>` 自动透出；OpenAPI 由 shared Zod 实时导出（`registerApiDoc`，tag `search`）。

## 2. 决策 D1：搜索 wire 形态

**端点**：`POST /v2/search`（顶层；notebook 范围经 body 参数复用同端点）。

**请求**（`SearchRequestSchema`）：
- `query: string`（min 1）
- `scope: { kind: 'all' } | { kind: 'notebook', notebookId: number }`（缺省 `all`）
- `topK?: number`（上限入 schema；默认值来自 config，spec 不写数值）
- `originTypes?: ('source' | 'output')[]`（缺省全量——搜索面即索引面）

**响应**（`SearchResponseSchema`）：**扁平结果 + 分组摘要**，不在服务端做嵌套分组（客户端按 facets 自由分组渲染）：
- `results: SearchResultItem[]`，每项：`chunkId / text（chunk 全文，展示截断归前端）/ score（RRF 归一 0-1）/ originType / originId / sourceId（派生行的真实 id）/ sourceTitle（filename）/ notebookId / notebookTitle / chunkIndex / modality`
- `facets: { notebooks: {notebookId, title, count}[], originTypes: {type, count}[] }`
- `degraded?: 'index_rebuilding' | 'dim_mismatch' | 'embed_unavailable'`（见 D5）
- 分页：top-k 截断 + 「更多」= 提高 topK 重查（无 cursor——分数随索引变化，cursor 无稳定语义）。

**跳转引用**（前端语义，wire 只给字段）：
- `originType='source'` → `setJumpToCitation(chunkId)` + 打开 source 详情；
- `originType='output'` → `overlays.setViewerOutputId(originId)`。

## 3. 决策 D2：origin 泛化落地 = 派生 source 行

**模型**：每个自动索引的 output 在 `sources` 表落一行**派生行**：
- 新列 `sources.derived_output_id INTEGER NULL` + 索引（`ix_sources_derived_output_id`）。NULL = 普通行；非 NULL = 派生隐藏行，且是该 output 的级联句柄。
- 派生行字段：`filename = "<type>-<outputId>"`（如 `GUIDE-42`）、`mimeType='text/markdown'`、`parserType='text'`、`status` 随嵌入 ready/failed（同 convert-to-source 语义）。
- chunks 行：`origin_type='output'`、`origin_id=outputId`、`source_id=<派生行 id>`、`modality='text'`，嵌入元数据照 r483 落库。

**为什么派生行而不是放宽 source_id**：FK 级联（删 source → chunks 净）、vec0 source_id 分区、FTS JOIN、唯一索引、全局重建枚举、多样性/轮转配额——全部原样复用，零特判。放宽列类型的方案每一处都要改且丢级联。

**隐藏过滤清单**（派生行 MUST NOT 出现在用户可见的 sources 面）：
- sources 列表/详情/统计类查询统一加 `derived_output_id IS NULL` 谓词（server 侧收口在一个查询 helper，禁止各处手写）。
- QA/outputs/studio/单源 QA/research 的检索经 D4 的 origin 过滤天然排除派生 chunks。

**级联**：`handleDeleteOutput` 先查 `derived_output_id = id` 的派生行 → `deleteSourceVectors` + 删派生行（chunks FK 级联 + FTS 触发器）→ 再删 output。notebook 删除走既有 FK 级联无需特判。

**重建交互**：派生行 status=ready 自动被 notebook/GLOBAL 重建枚举覆盖；重建中生成的 output 照常同步索引（重建锁只挡"读检索"，不挡写路径——写路径已有维度护栏 r478）。

## 4. 决策 D3：outputs 同步自动索引（准确不惊诧）

**触发点**：outputs 行持久化点统一收口（`finishPipeline` persist 之后、响应返回之前）。所有产出通路（outputs 生成、studio slides、qa 导出等落 outputs 表的路径）共享该收口。

**语义**：
- 生成响应返回 = 该产出**已入索引可搜**（成功路径）。
- 嵌入失败**不拖垮生成**（产出行照常返回——LLM 已成功，丢产出才是惊诧）；派生行标 `failed + errorMessage`（同 convert-to-source 错误路径先例 `outputs/router.ts:579-591`）。
- 失败可观测：`GET /v2/notebooks/:nid/search-index` 状态扩展 `derivedFailedCount`（该笔记本 failed 派生行数）——搜索框/状态 UI 可提示"N 个产出未入索引"；重建入口即恢复手段。
- 同一 output 重复索引（理论不发生，append-only）：按 `derived_output_id` 先删旧派生行再建，幂等。

**范围**：仅 outputs 表（research artifacts 归后续；锁定决策）。分块复用 `outputs/render.ts` 的类型感知分块（convert-to-source 同款）。

## 5. 决策 D4：中文 FTS = `text_tokens` bigram 列

**Tokenizer 规则**（纯函数，`rag/cjk-tokenizer.ts`）：
- CJK 连续段 → 逐字滑窗 bigram（"向量数据库" → `向量 量数 数据 据库`）；
- 拉丁/数字连续段 → 整词小写（`EmbeddingGemma` → `embeddinggemma`）；
- 输出空格连接的 token 串。
- 纯 CJK 2 字查询产出单 token；查询侧各 token 以 `"…"` 引号包裹、` OR ` 连接（FTS 语法安全 + 搜索引擎式 OR 语义，bm25 排序）。

**存储**：`chunks` 新列 `text_tokens TEXT`（migration 先 nullable，boot 回填后应用层保证写入）；FTS 外部内容表改索引该列：

```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text_tokens, content='chunks', content_rowid='id'
);
-- 触发器形状不变，只是搬 new.text_tokens / old.text_tokens
```

unicode61 对"空格连接的 bigram 串"恰好按空格切分（CJK 不再需要分词器切分），无需自定义 tokenizer。

**写入 seam**：新增 db 层 chunk 写入 helper（内部计算 `text_tokens`），6 个写入点全部改走它；任何新写入点只有这一个口子。回填：boot ensure 幂等步骤——`text_tokens IS NULL` 的行批量补算 → `INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')` 重建索引；旧形状 chunks_fts（索引 `text` 列）检测到即 DROP 重建。

**边界**：非 CJK 语料行为不回退（拉丁整词原样可搜）；`chunks.text` 原文不动（展示/嵌入均用原文，`text_tokens` 仅为检索面）。

## 6. 决策 D5：不可用期降级（UX 优先）

| 状况 | KNN 通道 | keyword 通道 | 响应 |
| --- | --- | --- | --- |
| rebuilding / dim_mismatch / interrupted | 跳过（vec 表不可信） | 正常 | 200 + `degraded:'index_rebuilding'`（dim_mismatch 同字段值域透出原因） |
| 嵌入网关失败/超时 | 跳过 | 正常 | 200 + `degraded:'embed_unavailable'` |
| 正常 | 双通道 RRF | 正常 | 200 |

- 与 r482 分类一致：搜索属"对话类"——**可用面内继续服务 + 显式标志**，禁止无提示静默降级，也禁止整体 409（搜索框完全不可用才是差 UX）。
- 重建期**新增**的 output 同步索引照常写入（见 D3），keyword 面即时可见。

## 7. 决策 D6：全局 KNN 延迟预算

- apply 期实测任务：在真机数据上测 scope=all 的 KNN+FTS+融合全链路延迟，预算上限入 config（spec 只要求"可配置 + 有界"）。
- sqlite 同步执行不做请求内取消（v1 边界沿用：预算上限 + topK 上限 + 文档化）。embed 网络调用沿用引擎现有超时/重试。
- 备选（实测超标才启用）：notebook 级并行扇出 + 合并（复用轮转配额合并语义）。

## 8. 决策 D7：c129（pg）衔接

- SearchService 的 SQL 全部经 `DbClient`/vectors.ts 式 helper（方言中立层），融合/降级/facets 是纯逻辑；pgvector 迭代扫描天然吃 scope，无 SQLite 方言泄漏进服务层。

## 9. 迁移与回滚边界

- **migration 0010**：`sources.derived_output_id`（nullable + 索引）、`chunks.text_tokens`（nullable）。纯加列，无数据损失；回滚 = DROP COLUMN（SQLite 3.35+ 支持）。
- **boot 幂等 ensure**：text_tokens 回填 + chunks_fts 形状检测重建（ DROP/重建 FTS 虚表不碰 `chunks` 原文数据）。
- **派生行清理**：`derived_output_id IS NOT NULL` 的行可整批删除重建（由 output 重索引/重建任务驱动），无唯一状态。
- 生成产物门禁：config 若新增 search 默认项（topK 默认/延迟预算），走 `shared/config.ts` Zod + `just check-app-schema`（`app.schema.gen.json` drift 门）+ `just check-env-examples`。

## 10. 测试缝映射（用户已确认六缝全要）

| 缝 | 位置 | 覆盖 |
| --- | --- | --- |
| ① API 集成缝 | `apps/server/tests/search/api.test.ts`（setupIntegrationEnv + 假 embed） | wire 合约：scope 过滤、facets、originTypes、degraded、跳转字段 |
| ② SearchService 单元缝 | `apps/server/tests/search/service.test.ts`（临时 DB + mock embed） | RRF 融合、双通道降级矩阵、topK/minScore |
| ③ CJK 分词 + FTS 召回缝 | `apps/server/tests/rag/cjk-tokenizer.test.ts` + 中文召回用例 | 分词纯函数全规则；真 FTS 表上 2 字/多字中文查询 bm25 命中 |
| ④ origin 过滤零变化缝 | 既有 `tests/rag/*`、`tests/qa/*` 保持绿 + `searchVectors` 过滤断言 | 5 消费方行为零变化；派生 chunks 不进 citation 路径 |
| ⑤ outputs 索引生命周期缝 | `apps/server/tests/search/output-indexing.test.ts`（集成） | 建→隐藏+ready；嵌入失败→failed+生成不炸；删→级联净；重建覆盖派生行 |
| ⑥ web + e2e 缝 | `WorkspaceTopbarSearch` 同居 rstest + e2e @p0 一条 happy path | 模式切换、防抖、范围切换、分组渲染、跳转回调；端到端搜到并跳转 |
