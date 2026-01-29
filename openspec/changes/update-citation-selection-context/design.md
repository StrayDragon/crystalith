## Context
当前引用选择状态保存在 workspace state，但聊天 QA 接口不支持显式范围，导致 UI 选中引用无法影响对话结果；Studio 输出虽然支持 chunk_ids，但与聊天缺少一致的上下文约束规则。

## Goals / Non-Goals
- Goals:
  - 对话与 Studio 输出在选中引用时使用显式 chunk_ids 作为上下文。
  - 聊天消息展示引用范围快照，方便用户理解该回答基于哪些引用。
  - 与现有默认检索兼容：未选中引用时保持现状。
  - 让前后端数据流一致（同一选择状态驱动 QA 与输出）。
- Non-Goals:
  - 不新增新的引用选择 UI（仅在现有选择机制上扩展行为）。
  - 不改变向量检索策略或排序算法。

## Decisions
- Decision: 使用 `chunk_ids` 作为 QA 的显式范围输入。
  - Reason: 引用选择天然对应 chunk；前端已在 Studio 输出使用 chunk_ids。
- Decision: QA 在提供 chunk_ids 时跳过向量检索。
  - Reason: 选中引用即为“显式上下文”，避免混入未选中来源。
- Decision: 无效 chunk_ids 直接返回 400。
  - Reason: 防止静默忽略导致结果混乱。
- Decision: 引用选择在发送后保持不清空，并在消息上记录当时的引用快照。
  - Reason: 用户可连续对多个问题使用同一选择，且快照可解释为何结果与当前选择不一致。

## Alternatives considered
- 使用 `source_ids` 作为范围：粒度过粗，且与“选中引用”语义不一致。
- 继续向量检索并将 chunk_ids 作为加权：仍可能返回未选中来源，违背预期。

## Risks / Trade-offs
- 选中引用过少可能导致答案不足 → 前端提示“仅基于选中引用”，保留无证据提示。
- chunk_ids 过多会影响上下文长度 → 依赖现有 context window 截断机制。
- 选择状态持久化可能造成误用 → 需要清晰指示当前是否使用选中引用。

## Migration Plan
1. 后端增加可选 `chunk_ids` 字段并发布。
2. 更新 OpenAPI schema，前端生成 SDK。
3. 前端在 QA 请求中传递选中引用。
4. 验证回归测试与手动流程。

## Open Questions
- 是否需要在聊天输入区显式展示“当前基于选中引用”的提示或开关？
