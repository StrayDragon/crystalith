## 1. Server: ungrounded QA when source_ids empty

- [x] 1.1 `retrieveAndJudge`：区分「笔记本无来源」vs「空/缺失 source_ids」；后者返回可生成的 ungrounded 结果（跳过向量检索，citations=[]）
- [x] 1.2 `streamQa` / `runQa`：ungrounded 路径注入空上下文并进入 LLM；笔记本无来源仍短路 `no_sources`
- [x] 1.3 更新/补充 `apps/server` QA 测试覆盖 empty scope 与 notebook-empty

验证：`cd apps/server && bun test test/qa`

## 2. Web: Chat 允许未勾选发送 + 引用文案

- [x] 2.1 确认 Chat 发送不因 `selectedSourceIds` 为空而禁用；请求省略或传空 `source_ids`
- [x] 2.2 `CitationsControl` / `CitationPopover`：展示「来自 N 个来源 · K 个片段」
- [x] 2.3 补充前端单测（引用文案计数；可选 Chat body 空 scope）

验证：`cd apps/web && bun run test:ci -- src/features/workspace/shared/components/citations src/features/workspace/domains/messages/useChat.test.tsx`

## 3. 门禁

- [x] 3.1 `llman sdd validate c63-ungrounded-qa-and-citation-labels --strict --no-interactive`
- [x] 3.2 相关测试全绿后勾选本文件全部任务
