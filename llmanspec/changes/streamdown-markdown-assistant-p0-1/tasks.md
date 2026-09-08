# Tasks — streamdown-markdown-assistant-p0-1

> Seam：`apps/web` Vitest 组件测试（`AssistantMarkdown` 公共边界，既有 web test
> harness）+ Playwright e2e @p0（chat 相关 smoke 保持绿，既有 harness）。

## T1 渲染组件 + 单测

- [ ] `apps/web` 新增 `streamdown` 依赖；全局样式引入 `streamdown/styles.css` + tailwind `@source` 指令
- [ ] 新增 `domains/messages/AssistantMarkdown.tsx`：包装 streamdown，
      开启未完成 markdown 补全；容器样式与现有气泡排版（`text-sm leading-relaxed`）一致
- [ ] Vitest：完整 markdown 结构（标题/列表/代码块/表格/引用）渲染断言；
      未闭合代码块中间态不抛错且不输出原始围栏字符；纯文本输入保持段落语义

## T2 ChatPanel 接入 + e2e

- [ ] `ChatPanel.tsx`：assistant 消息渲染节点替换为 `AssistantMarkdown`
      （恒等三元一并清除）；user 消息保持 `whitespace-pre-wrap` 纯文本
- [ ] `useChat.ts` 的 `streamingMarkdownRef` 无消费方则清理
- [ ] 深色模式与 DESIGN.md token 抽查（代码块/表格/引用块）
- [ ] `just test-web` + `just e2e` 全绿；人工抽查流式中间态（mock gateway 下的 chat p0 路径）
