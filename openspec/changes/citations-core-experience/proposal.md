## Why

- Citations/证据链是 Crystalith 的核心差异化，但当前体验仍偏“数据结构存在”而非“用户可验证”：缺少快速复查上下文、可分享导出、以及跨 QA/messages/outputs 的一致交互。
- 引用字段在不同输出路径中可能出现缺失或语义不明确（例如仅有 chunk 标识但无来源信息），导致 UI 难以稳定定位与呈现证据。

## What Changes

- 引入“引用可复查”能力：提供获取 citation 上下文（片段前后文/页码/段落信息）的稳定端点，并在 UI 支持一键定位与复查。
- 引入“带引用导出”：QA 与 Outputs 支持导出 Markdown/JSON（含引用清单与来源元信息），用于写作/分享/复盘。
- 明确 citation 统一语义：在对外 API 中保证 `source_id/source_name/chunk_id/chunk_index/snippet` 等字段稳定；并定义 snippet 长度与缺失字段处理策略。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `workspace-api-contract`: 扩展并稳定 citations、citation context 查询与带引用导出的 API 契约。

## Impact

- Backend: 新增/调整端点与响应结构（OpenAPI 变更）；补齐 citations 在不同输出路径的字段一致性。
- Frontend: 统一 citation 展示组件；增加“复查上下文/导出”交互；减少对隐式映射的依赖。
- Docs: 增加“证据链使用指南”与导出示例。
