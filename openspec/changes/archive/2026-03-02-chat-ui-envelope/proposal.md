## Why

- 当前 Workspace 的关键流（QA/Research/Studio/导入队列/诊断）主要以“纯文本 + 分散的面板 UI”呈现：用户需要在对话与不同面板之间频繁切换，难以在对话中完成“看结果 → 选项 → 反馈/确认 → 执行”的闭环。
- 在一些场景中（例如 Research 计划审批、结构化答案可视化、导出/保存/转换等操作），对话里直接渲染可交互 UI 能显著降低认知负担、提升可发现性，并为后续 agent 自动化提供更可控的交互面。
- 需要一种“前后端都能理解、可持久化回放、并可流式更新”的消息表达方式，同时尽量避免立即引入新的 API 版本或大规模重构现有 `/v1` 契约。

## What Changes

- 定义并落地 **Chat UI Envelope**：后端在 assistant 消息 `content` 中嵌入符合约定的 JSON envelope（带稳定 marker + schema），用 `parts[]` 表达 `text/component/tool_use/tool_result` 等块状内容；前端解析并按 registry 渲染为对话内卡片 UI（失败则回退为纯文本）。
- 支持“流式 props 更新”的最小闭环：优先复用现有 QA SSE `chunk/done/error`，将 `chunk` 追加到指定组件的 props（如 `AnswerCard.props.markdown`），并在 `done` 时补齐 citations/结构化卡片/工具执行结果。
- 引入“对话内动作”语义：通过 `tool_use/tool_result` parts 表达可执行动作与结果；支持白名单内“安全操作自动执行”，并在 UI 中以可观察、可重试的方式呈现执行过程；非白名单动作默认需要用户确认。
- 在选定场景启用 UI 形态（逐步扩展）：Research 计划审批卡、QA 结构化答案/引用卡、导出/保存/转换动作卡、健康/诊断提示卡等。
- 增加必要的安全与兼容约束：解析与渲染必须是确定性的；限制 envelope 大小与深度；禁止任意脚本执行；在旧客户端/纯文本环境下保持可读。

## Capabilities

### New Capabilities

- `chat-ui-envelope`: 定义对话消息内的 UI envelope 协议（marker、schema、`parts[]` 类型集、流式更新语义、兼容/回退与安全边界），并明确前后端在该协议上的责任分工。

### Modified Capabilities

- `workspace-api-contract`: 扩展消息与 SSE 的稳定契约，允许在不新增字段的前提下，通过 `content` 内嵌 UI envelope 表达结构化内容；明确流式与完成态的最小字段语义与兼容策略。
- `workspace-ui-panels`: 扩展 Chat 面板的最小 UI 契约：能识别并渲染 envelope parts、展示 tool/action 卡、在刷新后可回放渲染，且对失败/不支持情况提供一致回退与恢复路径。

## Impact

- Backend:
  - 不强制新增 `/v2` API；主要变更是对 assistant `Message.content` 的约定与在 QA/Research 等链路中产出 envelope 的策略。
  - 可能需要在 SSE `done` 阶段固化最终 envelope 以支持历史回放与导出（保持 `content` 仍为字符串）。
- Frontend:
  - Chat 渲染层新增 envelope 解析与组件 registry；为关键卡片实现受控渲染与交互（含自动执行可视化）。
  - 需要补充单测（解析/回退、流式追加、动作执行状态）与少量端到端的人工验收路径。
- Security/UX:
  - 引入新的用户输入与自动执行路径，需要白名单、确认策略与错误可恢复设计；并需对 JSON 解析与渲染做资源上限保护。
