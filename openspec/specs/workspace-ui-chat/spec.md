# workspace-ui-chat Specification

## Purpose

定义 Chat 面板最小契约：消息区、输入区、流式反馈、失败重试与引用入口。

## Non-goals

- 不定义 RAG 检索算法
- 不定义来源管理行为

## Requirements

### Requirement: Chat panel composition is stable
Chat MUST 包含消息区、状态区、底部输入区，且输入区在可用场景下持续可访问。

### Requirement: Streaming UX supports send/chunk/done/error and cancel
流式问答 MUST 提供可见生成状态，并支持用户取消且保留已生成内容。

### Requirement: Failure notice and retry are available
发送或生成失败时 MUST 提供明显提示与重试入口。

### Requirement: Assistant message actions are consistent
assistant 消息 SHOULD 提供复制、查看引用及可用的保存/转换动作。

### Requirement: Citation list and navigation are accessible
存在 citations 时 MUST 可查看列表并跳转到来源详情或定位位置。
