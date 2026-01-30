## Context
当前前端会将“选中引用（chunk）”或“选中来源”解析为 chunk_ids 传给后端，并在未形成子集时回退为自动检索全来源。用户期望最小选择单元为“来源”，并且不再触发自动检索。

## Goals / Non-Goals
- Goals:
  - 统一来源级别选择作为对话与 Studio 输出的唯一上下文范围。
- 允许“未选中来源”时发起 Chat/Refine，但不触发自动检索。
- Studio/Slides 在未选中来源时禁止触发生成。
- 在来源列表中清晰显示 embedding/索引状态，并为失败来源提供重嵌入入口。
- Non-Goals:
  - 不改变向量检索算法本身或 chunk 结构。
  - 不引入新的来源管理界面或复杂权限逻辑。

## Decisions
- API 输入新增 `source_ids`（QA / Refine / Slides）。
- 后端在收到 `source_ids` 时，限定检索范围为这些来源；`source_ids` 为空时 Chat/Refine 返回空上下文与“无证据”。
- 移除 `chunk_ids` 兼容（破坏性变更），前后端与测试同步删除。
- Studio/Slides 生成必须提供 `source_ids`，后端校验为空或无效时返回 400。
- 来源列表使用现有 `status`/`chunk_count` 等字段展示“已索引/处理中/失败”标识，并禁用处理中/失败来源的选择。
- 失败来源提供“重新嵌入”入口，触发后端重试索引。

## Risks / Trade-offs
- Studio/Slides 因强制来源选择可能降低可用性，需要 UI 明确提示。
- API 变更要求同步更新 OpenAPI 客户端与测试。

## Migration Plan
1) 后端新增/扩展 payload 支持 `source_ids` 并更新检索逻辑。
2) 移除 `chunk_ids` 兼容路径与测试。
3) 前端移除引用级选择/比较/复制 UI，Studio/Slides 阻止空来源生成。
4) 更新 OpenAPI 生成与相关测试。

## Open Questions
- 无。
