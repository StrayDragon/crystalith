# Tasks — c131 Adopt EmbeddingGemma 2

> 测试 seam（沿用既有 harness，无新 runner）：bun test（`apps/server/tests/`：config / api-contract / rag / sources / qa）+ web Rstest（`apps/web`）+ `just qa`。质量脚本（T7）面向真机 tufa:50233，手动执行不进 CI。

## A. 地基

- [x] T1 eg2 目录条目与配置
  - app.yaml：`eg2_gateway` anchor（`CL_EMBEDDING2_API_BASE` 缺省 `http://tufa:50233/v1`）+ `embeddinggemma2-gateway` 条目（model `embeddinggemma-2`，能力块 dims 768 / mrlDims / prefixPreset embeddinggemma2）。
  - gen-app-schema + i18n keys；`config.test.ts`：条目解析、能力块字段、缺省 baseUrl 展开。
  - [blocked-by: ]

- [x] T2 W2：直写向量路径补 chunk 元数据
  - 抽 `markChunksEmbedded(sourceId, model, dims)` helper；indexSource / sessions convert / source-extras QA-to-source 三处接线。
  - 测试：三条路径各断言 `embedding_model`/`embedding_dims` 落库（假 embed）。
  - [blocked-by: ]

## B. 重建任务与状态面

- [x] T3 重建任务引擎（两模式 + 异步生命周期）
  - `index_jobs` 表 + 迁移 0009（手写）；任务管理器：启动（防重入 409）、后台逐 source `deleteSourceVectors + indexSource`、逐条诊断、完成 bumpVectorEpoch（全局模式逐笔记本）、boot 扫描 running → interrupted。
  - 维度不匹配时走全局模式（DROP + 按声明维度重建 vec_chunks + 重嵌全部笔记本）。
  - 测试：fake embed 下——笔记本模式只动该笔记本向量；全局模式重建表维度并跨笔记本重嵌；防重入；中断态。
  - [blocked-by: T2]

- [x] T4 重建与状态 API
  - `POST /v2/notebooks/:nid/search-index/rebuild`（202 + jobId；running 再启 409）+ `GET /v2/notebooks/:nid/search-index`（state/progress/dims/lastJob）；shared Zod schema（desc()）+ registerApiDoc（中文业务语义 summary）。
  - c130 的 boot 警告文案与 409 错误指引更新指向本端点。
  - 测试：api-contract 断言两端点 wire 与状态迁移（ready → rebuilding → succeeded）。
  - [blocked-by: T3]

## C. 降级接线

- [x] T5 调用方降级分类落地
  - 检索入口读索引状态；QA 对话 + 单源问答：no-evidence reason `index_rebuilding` + 提示文案（wire `noEvidenceReason` 透出）；outputs 生成 + studio slides：`409 INDEX_REBUILDING`；research 工具：空数组（不改）。
  - 测试：qa 降级用例（rebuilding 状态下回答带提示且不调用 embed）；outputs/studio 报错用例。
  - [blocked-by: T3]

## D. 前端

- [x] T6 来源面板重建按钮与进度
  - 工具栏按钮（与批量操作同区）+ 确认弹窗（两模式文案区分：笔记本级 / 全局含"影响所有笔记本"）；启动后轮询状态端点显示进度；完成/失败 toast；QA 降级提示渲染（`noEvidenceReason=index_rebuilding`）。
  - web Rstest：按钮流程（MSW mock 状态迁移）。
  - [blocked-by: T4]

## E. 质量与翻转

- [x] T7 真机质量脚本
  - `scripts/embedding-quality.ts`：前缀交叉验证（cos ≥ 0.999999）、中文/中英混合/代码 self-retrieval top-1 命中率、延迟基线；结果记 docs/embedding.md。对 tufa:50233 实跑并留档输出。
  - [blocked-by: T1]

- [x] T8 默认翻转 + 文档收口
  - `defaults.embedding` → `embeddinggemma2-gateway`（config.test 断言）；docs/embedding.md 网关矩阵补 tufa 行、重建指引改按钮优先；README 无需动。
  - [blocked-by: T7]

- [x] T9 全量门禁
  - `just qa` + `just test-bdd` 全绿。
  - [blocked-by: T2, T4, T5, T6, T8]
