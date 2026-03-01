## 1. UI envelope 协议与解析（Frontend）

- [x] 1.1 定义 delimiter 常量（`[[crystalith-ui:v1]]`）与 `crystalith.ui.message.v1` 的 TypeScript 类型（含 `parts[]`）。
- [x] 1.2 实现 `parseChatUiEnvelope(content)`：返回 `{ fallbackText, envelope | null }`，并在解析失败时稳定回退。
- [x] 1.3 为解析增加资源上限（最大 JSON 字节数、最大 parts 数、最大嵌套深度）并确保不会卡死 UI。

## 2. 对话内渲染（Frontend）

- [x] 2.1 引入 component registry（`name -> React component + props 校验`），实现最小组件集：`AnswerCard`、`ToolActionCard`、`JsonFallbackCard`。
- [x] 2.2 在 ChatPanel 中集成 envelope 渲染：解析成功渲染 parts；解析失败显示 `fallback_text`；未知组件走安全回退。
- [x] 2.3 确保与现有 citations 交互兼容（同一条消息仍可定位/跳转/导出）。

## 3. 流式 props 更新（Frontend）

- [x] 3.1 在发送消息的流式路径中，以“streaming component message”替代纯文本 streaming buffer（例如把 chunk 追加到 `AnswerCard.props.markdown`）。
- [x] 3.2 `done/error/abort` 生命周期收敛：停止追加、清理定时器与 abort controller，并进入可恢复状态（可重试）。
- [x] 3.3 刷新/重连后能基于后端持久化的 envelope 回放同样的 UI（不依赖前端内存状态）。

## 4. Tool/action 卡与自动执行策略（Frontend）

- [x] 4.1 定义 `tool_use/tool_result` 的渲染与状态机（pending/running/success/error）并展示最小诊断信息。
- [x] 4.2 实现 auto-exec 白名单：仅当 `auto_execute=true` 且工具在白名单内才自动执行；其余动作必须显式确认。
- [x] 4.3 为执行请求增加幂等/去重策略（例如基于 `tool_use.id` 的重复提交防护），失败可重试。

## 5. Envelope 产出与持久化（Backend）

- [x] 5.1 在 QA `/stream` 的完成态构造最终 envelope（包含 `schema/parts/meta`），并以“可读前缀 + delimiter + JSON”写入 assistant `Message.content`（保持 `/v1` shape 不变）。
- [x] 5.2 处理导出/引用等读路径：导出 Markdown/JSON 时不应把 delimiter 与 JSON 元数据当作正文混入（需要明确剥离或选择性导出策略）。
- [x] 5.3 为后续扩展预留开关与场景门控（先 QA，后 Research/Studio/诊断），并确保旧消息不受影响。

## 6. Tests & Verification

- [x] 6.1 Frontend：为解析/回退/未知组件/资源上限/流式更新增加 Vitest 单测。
- [x] 6.2 Backend：为 envelope 生成与导出剥离逻辑增加 pytest 覆盖（至少 1 条 happy-path + 1 条失败回退）。
- [x] 6.3 验收（单元测试）：覆盖“QA 流式 AnswerCard 增长/完成态持久化 + 导出剥离 + 刷新后回放渲染”关键路径。
- [x] 6.4 验收（单元测试）：覆盖 tool/action 卡渲染与 auto-exec 白名单行为；非白名单默认需要确认。
