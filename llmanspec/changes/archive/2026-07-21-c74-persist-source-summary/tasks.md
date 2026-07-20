## 1. Shared schema + server

- [x] 1.1 调整 `SourceSummarySchema`：支持未生成态（`generatedAt` nullable/optional；空 summary/数组合法）
- [x] 1.2 抽出 `generateAndPersistSourceSummary(sourceId)`；GET 只读 metadata；新增 POST 同 path 写缓存
- [x] 1.3 ingest/`ready` 后异步预生成（失败仅日志）；re-embed 成功路径同样触发（若适用）
- [x] 1.4 单测：GET 无缓存 → 空态且不调 LLM；POST → 写入 metadata；再次 GET → 命中缓存

验证：`cd apps/server && bun test test/sources`（或等价路径）

## 2. Frontend

- [x] 2.1 打开详情：GET 只读；空态展示「尚未生成自动摘要」+ **生成摘要** → POST
- [x] 2.2 有摘要时：既有 **RefreshIcon** → POST 重新生成（`aria-label` 可保留「刷新摘要」）；loading 转圈
- [x] 2.3 内存 `briefCache` 仅作 GET/POST 结果缓存，不再假设「GET 必有正文」

验证：相关 web Vitest / 手动打开来源详情

## 3. Specs + 门禁

- [x] 3.1 delta：修改 `r49` + 场景（GET 无副作用 / POST 持久化 / 空态 UI）+ UI refresh 图标语义
- [x] 3.2 `llman sdd validate c74-persist-source-summary --strict --no-interactive`（apply 勾完实现任务后跑 full；提案阶段 `--stage spec` 已绿）
- [x] 3.3 `just qa`
