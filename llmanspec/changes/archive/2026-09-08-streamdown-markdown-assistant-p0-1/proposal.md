---
depends_on: []
branch: sdd/streamdown-markdown-assistant-p0-1
base_sha: 88e420481b9cf3a0ac9d9e0628e5355f8266cdb3
checkpointed: true
checkpoint_sha: 88e420481b9cf3a0ac9d9e0628e5355f8266cdb3
---

# 聊天 AI 消息接入 streamdown 流式 Markdown 渲染

## Why

- 聊天面板 assistant 消息目前是**裸文本渲染**（`ChatPanel.tsx` 中 `whitespace-pre-wrap` 直接输出
  `message.content`），模型回答里的标题 / 列表 / 代码块 / 表格 / 粗体全部以原始字符显示。
- QA 回答与 Deep Research 产出天然是 markdown；裸字符模式与 NotebookLM 的体验参照差距明显，
  是当前最影响产品观感的短板（用户列为 P0）。
- 仓库已有 `remark-gfm` + `@platejs/markdown`，但仅用于 research-lab 的 Plate 报告编辑器，
  聊天面板未接；直接复用 Plate 对聊天气泡而言过重。
- 选型 **streamdown**（Vercel AI 生态、专为 LLM 流式输出设计）：对未闭合代码块 / 未完成行内语法
  能优雅降级渲染，与 AI SDK v7 技术栈同源；备选 react-markdown（更轻但无流式中间态优化），
  在 apply 阶段按 peer deps 与 React 18.2 锁版本的兼容性实测后定案。

## What Changes

- `apps/web` 新增 streamdown（或 fallback react-markdown）依赖，确认与 React 18.2 锁版本兼容。
- `ChatPanel.tsx` 中 assistant 消息渲染节点替换为流式 markdown 渲染器；用户消息保持纯文本。
- 流式中间态验证：打字光标、未闭合代码块 / 列表的中间渲染不破版。
- 渲染样式与 `apps/web/DESIGN.md` token 对齐（代码块、引用块、列表、表格）。
- **不改**消息 wire 协议（`packages/shared` message schema）与 `useChat` 数据流；
  `useChat` 中已存在的 `streamingMarkdownRef` 缓冲如与渲染器配合需要则顺手清理。

## Capabilities

- `web-chat-message-rendering`（新）：assistant 消息以流式安全 markdown 渲染，user 消息保持纯文本。

## Impact

- `apps/web/package.json`（+1 依赖）
- `apps/web/src/features/workspace/domains/messages/ChatPanel.tsx`（渲染节点替换 + 样式）
- 可能涉及少量共享样式 / 测试（web Vitest 快照或渲染单测）
- 执行顺序：本变更先于 `urlpatterns-extractor-p0-2`（会话内串行，代码上无耦合）
