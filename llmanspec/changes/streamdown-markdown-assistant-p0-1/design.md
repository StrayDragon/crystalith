# Design — streamdown-markdown-assistant-p0-1

## D1 选型：streamdown 2.6.0（备选 react-markdown / Plate MarkdownPlugin）

| 候选                 | 结论     | 理由                                                                                                                                                                               |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **streamdown 2.6.0** | **采用** | 专为 LLM 流式设计：`remend` 修复未闭合代码块/行内语法中间态；peer `react ^18 \|\| ^19` 兼容 18.2 锁版；自带 `styles.css` 可独立于 Tailwind 主题工作；与 AI SDK v7 同属 Vercel 生态 |
| react-markdown 10    | 备选     | 更轻，但流式中间态无处理（未闭合 ``` 会渲染成裸字符直到闭合）                                                                                                                      |
| Plate MarkdownPlugin | 否       | 已在 deps 但绑定 Plate 编辑器体系，聊天气泡接入过重                                                                                                                                |

依赖盘点：streamdown 内部依赖 `remark-gfm ^4`（仓库已有同版本，无冲突）、
`rehype-sanitize`/`rehype-harden`（自带消毒，无需额外 XSS 处理）、`marked`（流式补全）。
新增依赖仅 `streamdown` 一个。

## D2 接入面：仅 assistant 消息渲染节点

- `ChatPanel.tsx` 中 assistant 分支的 `<div className="whitespace-pre-wrap">{content}</div>`
  替换为 `<AssistantMarkdown content={...} />` 包装组件；user 消息保持纯文本 `whitespace-pre-wrap`。
- 抽出独立包装组件（`domains/messages/AssistantMarkdown.tsx`）而非内联：
  承载 streamdown 组件属性（`parseIncompleteMarkdown`、组件覆盖）与样式类，
  并给 Vitest 单测一个稳定的公共边界（seam）。
- typing cursor 逻辑不变（仍由 `isStreaming && streamingMessageId` 驱动，追加在渲染节点后）。

## D3 样式与主题

- 全局样式入口 `import "streamdown/styles.css"`（仅一次）。
- Tailwind v3.4 支持 `@source`（3.2+）：`@source "../node_modules/streamdown/dist/*.js";`
  让扫描器收录 streamdown 的 utility classes。
- 深色模式：streamdown 基于 `dark:` variant，与现有 `dark:` 约定一致；
  代码块/表格边框色以 DESIGN.md token 校准，允许少量覆盖类。

## D4 流式中间态与数据流

- 不改 `useChat` 数据流与 wire 协议（message schema 不动）；streamdown 每次渲染对
  当前 `message.content` 全量 parse（聊天长度下无性能问题），`parseIncompleteMarkdown`
  负责中间态补全。
- `useChat.ts` 中已有的 `streamingMarkdownRef` 缓冲若证实无消费方则顺手清理（apply 阶段核实）。

## D5 合约落点

- 仅新增 `workspace-ui-panels` 规则（assistant 流式 markdown 渲染 + user 纯文本 +
  中间态不破版），不改 r246 既有文案（其「纯文本/markdown」语义与本变更一致）。
