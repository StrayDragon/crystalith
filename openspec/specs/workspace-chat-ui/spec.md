# workspace-chat-ui Specification

## Purpose

定义 Workspace 中 **Chat 面板**的最小交互契约：消息列表/输入框/操作区组成，Q&A 流式生成的展示与取消，以及引用（citations）的查看与跳转入口。本规范不定义检索与答案质量；相关后端契约见 `workspace-api/spec.md` 与 `rag-qa/spec.md`。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`（QA 与 SSE 事件形状、错误 envelope）
- `rag-qa/spec.md`（检索问答语义）
- `citation-interaction/spec.md`（引用悬停/跳转体验）
- `workspace-ux-system/spec.md`（虚拟化、toast、错误态与快捷键策略）

## Requirements

### Requirement: Chat panel composition
Chat 面板 MUST 包含：

- 消息区（会话内容）
- 轻量操作区（notice/状态、可选的快捷操作）
- 底部输入区（composer：输入 + send）
消息区占据主要空间；composer MUST 固定在底部且始终可用（除非被阻塞/离线）。

### Requirement: Streaming QA UX (send / chunk / done / error)
Chat 面板 MUST 支持流式 Q&A 的可见反馈，并可在生成中取消。

最小行为：

- 进入流式生成后，assistant 消息内容 MUST 随 `chunk` 事件增量更新，并显示明确的“生成中”状态（光标/Spinner/Stop）
- 用户停止生成时客户端 MUST 中断流式连接，且已生成内容 MUST 保留
- 收到 `done` 事件时 UI MUST 更新最终消息状态，citations（若有）可在消息操作区查看/跳转
- 收到 `error` 事件或连接异常时 UI MUST 显示错误 notice，并允许重试发送（见下条）

### Requirement: Failure notice and retry
Chat 面板 SHALL 在发送/生成失败时给出可见提示，并提供 retry 入口。

最近一次发送失败时，UI MUST 提供“重试发送”入口，且重试后走同一流式生成路径。

### Requirement: Message actions (copy / save / convert)
对 assistant 消息，UI SHOULD 提供以下操作：

- 复制消息内容
- 保存为笔记（note）
- 查看全部引用（citations popover）
- 将该轮内容转换为来源或输出（若后端/产品允许）
复制操作触发时内容 MUST 写入剪贴板并给出短暂反馈。

### Requirement: Citation visibility and navigation
当消息包含 citations 时，UI MUST 提供“查看引用”入口，并支持从引用导航到来源详情/定位位置（细则见 `citation-interaction/spec.md`）。
点击“查看引用”时 MUST 展示引用条目列表，且每条引用支持跳转到来源详情或定位到来源位置。
