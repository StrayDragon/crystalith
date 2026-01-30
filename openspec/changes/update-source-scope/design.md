## Context
当前前端会将“选中引用（chunk）”或“选中来源”解析为 chunk_ids 传给后端，并在未形成子集时回退为自动检索全来源。用户期望最小选择单元为“来源”，并且不再触发自动检索。

## Goals / Non-Goals
- Goals:
  - 统一来源级别选择作为对话与 Studio 输出的唯一上下文范围。
- 允许“未选中来源”时发送请求，但不触发自动检索。
- 在来源列表中清晰显示 embedding/索引状态，并为失败来源提供重嵌入入口。
- Non-Goals:
  - 不改变向量检索算法本身或 chunk 结构。
  - 不引入新的来源管理界面或复杂权限逻辑。

## Decisions
- API 输入新增 `source_ids`（QA / Refine / Slides）。
- 后端在收到 `source_ids` 时，限定检索范围为这些来源；若 `source_ids` 为空或缺失，则不执行检索，返回空上下文与“无证据”类响应。
- 兼容性：若请求仍包含 `chunk_ids`，后端以 `chunk_ids` 为最高优先级（保留内部/历史调用支持）；前端不再发送 `chunk_ids`。
- 来源列表使用现有 `status`/`chunk_count` 等字段展示“已索引/处理中/失败”标识，并禁用处理中/失败来源的选择。
- 失败来源提供“重新嵌入”入口，触发后端重试索引。

## Risks / Trade-offs
- 空上下文下模型生成质量下降，需要通过提示或 UI 反馈降低预期。
- API 变更要求同步更新 OpenAPI 客户端与测试。

## Migration Plan
1) 后端新增/扩展 payload 支持 `source_ids` 并更新检索逻辑。
2) 前端改为仅发送 `source_ids`，移除引用级选择。
3) 更新 OpenAPI 生成与相关测试。

## Open Questions
- 失败来源的重嵌入接口是否复用现有 `sources/{id}` 处理流程，或新增专用端点？
