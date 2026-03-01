## Context

- 现状：
  - 后端 messages 表仅持久化 `role/content/citations` 等字段；前端 ChatPanel 主要按纯文本展示 `content`，并在 QA/Research 等场景通过 SSE（`chunk/done/error` 等）完成流式体验。
  - 关键操作（Research 计划审批、导出/保存/转换、诊断修复等）分散在面板或对话外入口；对话里缺少“可执行、可回放”的结构化 UI 表达。
- 约束：
  - 本变更优先保持 `/v1` 兼容，不引入新的 message 字段或 DB 迁移；通过 `Message.content: string` 的约定扩展实现。
  - 必须明确安全边界：前端只能把结构当“数据”渲染，不能执行任意脚本；自动执行必须白名单化、可观察、可回退。

## Goals / Non-Goals

**Goals:**

- 在对话中支持“直接渲染 UI”的最小闭环，并能在刷新/重连后自动回放渲染。
- 兼容现有 SSE：在不新增 SSE 事件类型的前提下支持“流式 props 更新”（例如回答卡片随 `chunk` 增长）。
- 支持“动作卡”：用结构化 `tool_use/tool_result` 表达可执行动作与结果，并支持白名单内安全操作的自动执行。
- 具备明确的兼容/回退策略：解析失败/未知组件时仍可用且可恢复。

**Non-Goals:**

- 不引入完整 Tambo SDK/Provider（`@tambo-ai/react`）或 Tambo 后端替换；仅对齐其“块状内容/工具调用”表达方式以降低未来迁移成本。
- 不要求 LLM 直接生成可执行的 tool 调用（避免提示注入造成副作用）；初期 tool parts 由后端/前端策略生成并受控。
- 不在本变更中引入新的 `/v2/messages` 或新增 `content_blocks` 字段（可作为后续演进）。
- 不定义组件的视觉风格细节（由 UI 实现自行迭代）。

## Decisions

1. **消息载体：在 `Message.content` 中内嵌 UI envelope（无迁移）**
   - 选择：assistant 消息内容使用“可读前缀 + 版本化 delimiter + JSON envelope”的格式，避免 DB/API 变更。
   - delimiter（固定字符串，含版本）：`\n\n[[crystalith-ui:v1]]\n`
   - 理由：最小侵入、可持久化、可灰度；未来若引入结构化字段或 `/v2`，可通过解析器双栈迁移。
   - 备选：
     - 新增 `content_blocks` 字段：更干净但需要 DB/OpenAPI 迁移与兼容策略。
     - 新建 `/v2/messages`：最稳但双维护成本高。

2. **Envelope 形状：对齐 Tambo 的 content parts 思路，但以 Crystalith schema 固化**
   - Envelope（JSON object）固定字段：
     - `schema`: `"crystalith.ui.message.v1"`
     - `parts`: `ContentPart[]`
     - `meta?`: 可选（例如 citations 摘要、生成耗时、来源范围等）
   - `ContentPart` 支持四类（最小集合）：
     - `text`：`{ type:"text", format:"markdown", text:"..." }`
     - `component`：`{ type:"component", name:"AnswerCard", id:"...", props:{...}, streaming?:boolean }`
     - `tool_use`：`{ type:"tool_use", id:"...", name:"...", input:{...}, auto_execute?:boolean, requires_confirm?:boolean }`
     - `tool_result`：`{ type:"tool_result", tool_use_id:"...", status:"success|error", output?:{...}, error_message?:string }`
   - 理由：能覆盖“结构化展示 + 动作 + 结果回写 + 流式更新”；同时保持未来与 Tambo/其它 SDK 的概念对齐。

3. **流式策略：复用现有 `chunk/done/error`，先不做 JSON patch SSE**
   - 选择：QA `/stream` 的 `chunk` 仍传递纯文本；前端把 chunk 追加到某个 streaming component 的 props（例如 `AnswerCard.props.markdown`）。
   - `done` 阶段：
     - 前端停止流式状态；
     - 后端持久化最终 assistant message（包含完整 envelope），用于刷新后回放渲染；
     - citations/结构化摘要等可在 `done` 时一次性补齐。
   - 备选：新增 SSE 事件 `ui`（发送 `parts_delta/props_patch`）。优点是更通用，缺点是复杂度高；建议作为后续迭代。

4. **动作执行：白名单自动执行 + 结果必须回写为 `tool_result`**
   - 选择：
     - 仅当 `tool_use.auto_execute=true` 且 `tool_use.name` 在白名单内时，前端才允许自动执行。
     - 白名单外动作默认 `requires_confirm=true`，由用户在卡片中显式确认。
     - 每次执行必须产生对应 `tool_result` 并在 UI 中可观察（running/success/error），失败可重试。
   - 理由：把“自动执行”限制在可控范围内，降低误触发与提示注入风险；同时提供审计与可恢复路径。

5. **解析与安全：严格解析、有限资源、确定性渲染**
   - 选择：
     - 解析器只在检测到 delimiter 时尝试解析；并对 JSON 长度、嵌套深度、parts 数量设置上限。
     - 所有 component props 通过 schema 校验（前端），未知组件/未知字段走“JSON fallback”渲染，且不阻塞消息列表。
     - 不执行任何来自 envelope 的脚本/表达式；tool 只能映射到内置动作集合。
   - 理由：避免 DoS（超大 JSON/深度递归）与 XSS/注入风险；确保渲染可预测。

## Risks / Trade-offs

- [风险] `content` 内嵌 JSON 会对非 UI 客户端造成噪音 → 缓解：保持可读前缀；delimiter 后 JSON 作为元数据；后续可演进到结构化字段或 `/v2/messages`。
- [风险] 提示注入诱导执行危险操作 → 缓解：tool parts 不直接信任 LLM 输出；自动执行仅白名单；高风险动作必须确认；执行前后都记录 `tool_use/tool_result`。
- [风险] 流式中间态与持久化最终态不一致 → 缓解：把中间态视为纯前端状态；`done` 时以后端持久化为准并在刷新后回放。
- [风险] 组件 registry 扩展失控 → 缓解：定义“最小可用组件集”，未知组件统一 fallback；新增组件必须配套 schema 与测试用例。

## Migration Plan

1. 先在前端引入 envelope 解析与 fallback（即使后端暂不产出 envelope 也不影响）。
2. 在 QA 流式链路先启用 envelope：
   - streaming 阶段使用本地组件 props 更新；
   - `done` 阶段后端固化最终 envelope 到 messages。
3. 引入 tool_use/tool_result 的动作卡，并只对白名单动作开放 `auto_execute`。
4. 逐步扩展到 Research/Studio/诊断等场景，并补齐对应组件与验收脚本。
5. 若 envelope 使用规模扩大且需要更强约束，再评估新增结构化字段或 `/v2/messages`。

## Open Questions

- 是否需要在后端引入可配置的开关（按 notebook/用户/环境）来启用 envelope 与自动执行？
- tool 白名单与幂等/回滚语义如何统一建模（尤其是“转换为 output/source”“保存到笔记”等动作）？
- 是否要引入通用的 `ui` SSE 事件来支持非文本型 props 的流式 patch（例如表格行逐步增加）？
