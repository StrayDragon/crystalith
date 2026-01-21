## Why

当前前端测试覆盖率极低（仅 2 个测试文件覆盖约 40 个组件），存在高回归风险。核心功能变更可能引入难以发现的 bug，影响用户体验和开发效率。

## What Changes

- 为核心 hooks 添加单元测试（useNotebooks, useSessions, useChat, useRefine, useSources）
- 为主要 UI 组件添加组件测试（WorkspaceLayout, ChatPanel, SourcesPanel, StudioPanel）
- 配置测试覆盖率报告
- 集成 CI 测试运行

## Impact

- 受影响的规范：新增 `frontend-testing` 规范
- 受影响的代码：
  - `frontend/web/src/features/workspace/hooks/*.ts`
  - `frontend/web/src/features/workspace/components/*.tsx`
  - 新增 `*.test.ts` / `*.test.tsx` 文件
- 目标覆盖率：核心 hooks > 80%，UI 组件 > 60%
