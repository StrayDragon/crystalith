# Tasks: refactor-citation-ui

## Phase 1: 创建通用引用悬浮组件

- [x] **1.1** 创建 `CitationPopover` 组件
  - 文件：`frontend/web/src/features/workspace/shared/components/citations/CitationPopover.tsx`
  - Props: `citations`, `isOpen`, `onClose`, `anchorEl`, `onJumpToCitation`
  - 使用 Portal 渲染，支持动态定位
  - 显示引用列表，每项包含：索引、来源标题、页码、片段预览
  - 支持点击引用项跳转

- [x] **1.2** 添加 `CitationPopover` 样式
  - 使用 Tailwind CSS
  - 支持最大高度和滚动
  - 响应式设计（移动端适配）

## Phase 2: 集成到 ChatPanel

- [x] **2.1** 修改 `ChatPanel` 组件
  - 在引用标记区域添加"查看引用"按钮
  - 管理 Popover 的打开/关闭状态
  - 传递当前消息的引用列表给 Popover

- [x] **2.2** 实现引用跳转回调
  - 点击 Popover 中的引用项时调用 `onCitationJump`

## Phase 3: 集成到 StudioOutputViewer

- [x] **3.1** 修改 `StudioOutputViewer` 组件
  - 在引用区域添加"查看全部"按钮
  - 使用 `CitationPopover` 替代当前的引用标记列表展示
  - 保留现有的 `CitationMark` 作为快捷入口

## Phase 4: 修复深度研究并发问题

- [x] **4.1** 修改 `SourcesPanel.tsx` 的 `handleSearch` 函数（第 321-354 行）
  - 在 `if (mode === 'Deep Research')` 块内添加并发检查
  - 检查 1：`research.isLoading` 为 true 时阻止并提示
  - 检查 2：`research.sessions.some(s => ['searching', 'analyzing', 'waiting_user'].includes(s.status))` 时阻止并提示
  - 使用 `toast.error()` 显示友好的中文提示信息


## Phase 5: 测试验证

- [x] **5.1** 手动测试 ChatPanel 引用展示
  - 验证"查看引用"按钮显示正确 ✓
  - 验证 Popover 定位和内容 ✓
  - 验证引用跳转功能 ✓

- [x] **5.2** 手动测试 StudioOutputViewer 引用展示
  - 验证"查看全部"按钮功能
  - 验证 Popover 内容正确

- [x] **5.3** 手动测试深度研究并发控制
  - 验证进行中的研究阻止新建
  - 验证提示信息显示
  - 验证已完成研究不影响新建

## Dependencies

- Phase 2 依赖 Phase 1
- Phase 3 依赖 Phase 1
- Phase 4 独立，可并行
- Phase 5 依赖 Phase 1-4
