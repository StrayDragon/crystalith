## 1. 测试基础设施

- [ ] 1.1 验证 Vitest + React Testing Library 配置
- [ ] 1.2 配置测试覆盖率报告（c8 / istanbul）
- [ ] 1.3 创建 Mock 工具函数（API 响应、localStorage 等）
- [ ] 1.4 创建测试辅助函数（render with providers 等）

## 2. Hook 测试

- [ ] 2.1 `useNotebooks.test.ts` - 笔记本 CRUD 操作
- [ ] 2.2 `useSessions.test.ts` - 会话管理
- [ ] 2.3 `useChat.test.ts` - 聊天消息发送、SSE 流处理
- [ ] 2.4 `useRefine.test.ts` - 输出精炼操作
- [ ] 2.5 `useSources.test.ts` - 来源上传、删除、搜索

## 3. 组件测试

- [ ] 3.1 `WorkspaceLayout.test.tsx` - 布局、面板调整
- [ ] 3.2 `ChatPanel.test.tsx` - 消息输入、发送、展示
- [ ] 3.3 `SourcesPanel.test.tsx` - 来源列表、上传交互
- [ ] 3.4 `StudioPanel.test.tsx` - 输出类型选择、生成、展示
- [ ] 3.5 `SessionSwitcher.test.tsx` - 会话切换器交互

## 4. 集成测试

- [ ] 4.1 完整工作流测试（创建笔记本 → 上传来源 → 问答）
- [ ] 4.2 引用交互测试（现有 `CitationInteractions.test.tsx` 增强）

## 5. CI 集成

- [ ] 5.1 确保 `pnpm test` 在 CI 中可运行
- [ ] 5.2 配置测试覆盖率阈值检查
- [ ] 5.3 添加覆盖率 badge 到 README
