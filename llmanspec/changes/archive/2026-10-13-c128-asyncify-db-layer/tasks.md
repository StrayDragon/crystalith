# Tasks — c128-asyncify-db-layer

> 机械大范围重构：按**先加后删**排序（端口旁路新增 → 分片迁移调用点 → 清尾），不拆垂直切片。
> 每批次完成后跑 `just qa`；批次间 commit 分段，禁止跨批混提交。
> 纪律：本 change 是纯调用风格迁移——迁移中发现某调用点「必须顺带改逻辑才编译得过」时，先停下评估：属行为变化即越界，回滚该片并记 `docs/known-issues.md` 裁出。
> 测试随片迁移（该域 src 与其 tests 同批 await 化），不集中堆到收尾。

## Batch A — 端口落地（先加，旁路新增）

- [x] A1 新建 `apps/server/src/db/client.ts`：`DbClient` 端口（`all/get/run/raw/tx`，见 design D1）+ `client()` 访问器（与 `db()` 同单例生命周期）；tx 实现保留「失败回滚保旧表」语义；最小单测（all/get/run/tx 成败路径）新建 `apps/server/tests/db-client.test.ts`
  - 验证：`cd apps/server && bun test tests/db-client.test.ts` + `bun run typecheck`
- [x] A2 db/rag 内核迁移：`db/vectors.ts`（raw + cosine 重建事务收编进 tx）、`rag/{embed,keyword,page-index}-strategy.ts`、`rag/registry.ts`、`ai/tools/retrieve-sources.ts`、`shared/{notebook-scope,citations}.ts` + 对应 tests（`db.test.ts`、`rag/*`、epoch-wiring）
  - 验证：`just test`（重点 rag/unified-retrieval、epoch-wiring、embed-similarity 用例绿）[blocked-by: A1]

## Batch B — features 分片迁移（片内 `just test`，批末 `just qa`，绿即 commit）

- [x] B1 sources 域：`router/pipeline/batch.service/dedup/tags.service/source-summary/from-url.service/source-extras.router` + `source-connectors/{router,sync}` + 对应 tests [blocked-by: A2]
- [x] B2 会话与基础域：`sessions/{router,convert}`、`messages/router`、`notebooks/router`、`templates/router`、`prompt-presets/router`、`commands/router` + 对应 tests [blocked-by: B1]
- [x] B3 生成域：`qa/{router,retrieve-and-judge,presets}`、`outputs/{router,pipeline}` + 对应 tests [blocked-by: B2]
- [x] B4 research 域：`run-loop/run-sse/node-agent/node-chat/convert/report-revisions/report/commands/research-core` + 对应 tests；重点回归 SSE drain（`setupIntegrationEnv` 自动 drain 后台研究循环） [blocked-by: B3]
- [x] B5 studio 域与其余漏网调用点（以 grep 清单为准）+ 对应 tests；批末 `just qa` 全绿 [blocked-by: B4]

## Batch C — 清尾与完成判据

- [x] C1 残留清零（**在 change 分支测量，相对 merge-base**）：src 构建器终端仅剩注释文本命中、原生终端仅剩 `initVecChunks` boot 豁免块（design D5 修订含 tests seeding 判据收窄） [blocked-by: B5]
- [x] C2 全量门禁：`just qa` + `just test-bdd` 全绿；type-aware lint 不劣于基线（advisory） [blocked-by: C1]
