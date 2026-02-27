## Why

- Sources 是 Notebook/RAG 的基础资产，但当前“失败原因、可恢复性、批量管理、去重”等产品化能力不足，用户在导入失败或规模增长时缺少可预期的管理与排障路径。
- 缺少稳定的失败诊断与语义化错误码会放大支持成本，并让 UI 无法给出正确的修复建议（例如网络/解析/SSRF/依赖服务降级）。

## What Changes

- 标准化来源失败诊断：记录并返回 `error_code/error_message/recovery_hint/last_error_at`（仅当失败/降级时出现），并在 UI 中展示与提供可执行的恢复动作。
- 增加可选的来源去重策略（upload/url）：在不丢数据的前提下避免重复导入，必要时提供“复用/仍要导入”选择。
- 强化批量管理语义：批量删除、批量 re-embed、tag 绑定/解绑在缓存失效（epoch bump）、幂等性与错误回显上保持一致。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `source-ingestion-management-and-tags`: 增加来源失败诊断、去重与批量操作的稳定语义要求。

## Impact

- Backend: Source 数据模型与 API 响应需要扩展失败诊断字段；批量端点需要更强的幂等/错误回显语义（含 epoch 规则）。
- Frontend: Sources 面板需展示失败原因、提供重试/修复提示，并在规模增长时保持可用。
- Docs: 增加“导入失败排障”与“去重策略说明”。
