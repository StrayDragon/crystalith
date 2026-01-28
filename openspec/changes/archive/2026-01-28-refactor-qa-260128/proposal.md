## Why
当前前后端存在可维护性和一致性风险，主要体现在：
- 演示生成配置/主题模板在前后端重复维护，且前端预览逻辑与后端生成逻辑各自实现，易产生漂移与回归（`backend/py/src/crystalith/studio/slides/generator.py`, `frontend/web/src/features/workspace/components/SlidesStudioDialog.tsx`）。
- 多个大型组件与 Hook 混杂 UI、数据获取、状态流与 demo/mock 分支，导致结构臃肿、一次性逻辑难以隔离（`frontend/web/src/features/workspace/components/SlidesStudioDialog.tsx`, `frontend/web/src/features/workspace/hooks/useRefine.ts`, `frontend/web/src/features/workspace/components/StudioPanel.tsx`, `frontend/web/src/features/workspace/components/WorkspaceLayout.tsx`）。
- Demo/mock 数据散落在多处组件内部，缺少统一的 fixture 来源，造成行为不一致且难以被测试覆盖（`frontend/web/src/features/workspace/hooks/useSources.ts`, `frontend/web/src/features/workspace/components/SourceDetailDialog.tsx` 等）。
- 搜索 API 仍返回 TODO 占位消息，与实际搜索流程不一致，易导致前端展示误导信息（`backend/py/src/crystalith/api/sources.py`）。

## What Changes
- 建立演示生成配置的后端单一来源，并通过 API 提供配置/主题预设；前端以该配置驱动选项渲染与 frontmatter 预览，移除重复常量与拼装逻辑。
- 移除 demo 模式与 mock 数据分支；当后端不可用时前端明确报错并停止渲染 demo 体验，避免一次性逻辑污染生产路径。
- 拆分大型组件/Hook 为可维护的子模块，降低 UI、数据获取与状态流的耦合。
- 修正搜索返回消息来源，使用实际生成的摘要/下一步提示，移除 TODO 占位。
- 增加前后端“行为约束”的测试：后端以真实依赖（最小替身）跑集成测试；前端增加关键流程的行为测试与端到端验证，尽量减少 mock。

## Impact
- 受影响的规范：`specs/studio-slides/spec.md`、`specs/workspace-ui/spec.md`、`specs/search-engine/spec.md`
- 受影响的代码：
  - 后端：`backend/py/src/crystalith/studio/slides/`, `backend/py/src/crystalith/api/sources.py`, 新增 slides config API
  - 前端：`frontend/web/src/features/workspace/components/SlidesStudioDialog.tsx`, `frontend/web/src/features/workspace/hooks/useRefine.ts`, `frontend/web/src/features/workspace/components/StudioPanel.tsx`, `frontend/web/src/features/workspace/components/SourceDetailDialog.tsx`, `frontend/web/src/features/workspace/components/WorkspaceLayout.tsx`
  - 测试：`backend/py/tests/*`, `frontend/web/src/**/*.test.tsx`, `frontend/web/tests/*` (Playwright)
