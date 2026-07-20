---
depends_on: []
---

## Why

来源详情「自动摘要」当前由 `GET …/summary` **每次调用 LLM 生成**，服务端不持久化；前端仅有进程内 `briefCache`，刷新页面即失效。打开详情经常卡住数秒，且重复计费/耗时。用户需要：默认读取无副作用、写入显式触发，并在 ingest 就绪后尽量预生成。

## What Changes

1. **GET `/v2/notebooks/:nid/sources/:sid/summary`** — 只读 `sources.metadata.autoSummary`（或约定键）；**MUST NOT** 调用 LLM。无缓存时仍 **200**，返回空态字段（空 `summary` / 空数组；`generatedAt` 可空），供 UI 展示「尚未生成」+ **生成摘要**。
2. **POST 同 path** — 生成摘要并写入 `metadata`；用于首次生成与重新生成。响应形状与有缓存时的 GET 一致。
3. **Ingest** — source 进入 `ready` 后 **异步**预生成并写入（失败不拖垮 ready / 不改 status）。
4. **Web `SourceDetailDialog`**：
   - 无缓存：空态 + 文案按钮 **「生成摘要」** → POST
   - 有缓存：展示摘要；既有右上角 **刷新图标** → POST（重新生成），不再依赖「打开即 GET 触发生成」
5. **Schema**：`SourceSummarySchema` 允许未生成态（如 `generatedAt` optional/nullable）；必要时加 POST 请求体（空 body 即可）。
6. **Spec**：修改 `source-ingestion-summary-and-conversion` 的 `r49`（从「按需 GET 生成」改为「缓存读 + POST 写」）。

## Capabilities

- `source-ingestion-summary-and-conversion`（主）
- `workspace-ui-panels`（详情空态 / 刷新图标语义，若需补 UI 约束）

## Impact

- **BREAKING（语义）**：原依赖「GET 即生成」的客户端会拿到空态，须改调 POST。
- 现有 FE 仅详情对话框消费该端点；需同步改 UI。
- 历史已 ready 的来源无 `autoSummary` 直至 POST 或后台补算（本变更以异步预生成覆盖**新** ingest；旧数据靠按钮补）。
