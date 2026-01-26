## 1. 基础设施搭建

- [ ] 1.1 创建 `frontend/web/src/shared/layer/` 目录结构
- [ ] 1.2 实现 `constants.ts`：定义 LAYER_LEVELS 常量（base, dropdown, popover, modal, toast, tooltip）
- [ ] 1.3 实现 `types.ts`：定义 LayerName、LayerConfig 等类型
- [ ] 1.4 实现 `LayerProvider.tsx`：创建 LayerContext 和 Provider 组件
- [ ] 1.5 实现 `useLayer.ts`：创建 useLayer hook，支持 (layerName, slot?) 参数
- [ ] 1.6 创建 `index.ts` 导出入口
- [ ] 1.7 在 `App.tsx` 根组件添加 LayerProvider 包裹

## 2. Toast 组件迁移

- [ ] 2.1 重构 `shared/toast.tsx`，使用 `useLayer('toast')` 替代硬编码 `z-[99999]`
- [ ] 2.2 验证多个 Toast 的堆叠顺序正确
- [ ] 2.3 验证 Toast 在 Dialog 打开时仍然可见

## 3. 对话框/覆盖层组件迁移

- [ ] 3.1 重构 `AddSearchResultDialog.tsx`，使用 `useLayer('modal')` 替代 `z-[99999]`
- [ ] 3.2 重构 `SourceDetailDialog.tsx` 内的 MenuList，使用 `useLayer('dropdown')` 替代 `z-[10001]`
- [ ] 3.3 重构 `StudioOutputViewer.tsx`，使用 `useLayer('modal')` 替代 `z-[60]`
- [ ] 3.4 重构 `ResearchDetailPanel.tsx`，使用 `useLayer('modal')` 替代 `z-50`
- [ ] 3.5 重构 `KnowledgeGraphView.tsx`，使用 `useLayer('modal')` 替代 `z-50`
- [ ] 3.6 重构 `CitationMark.tsx`，使用 `useLayer('tooltip')` 替代 `z-[99999]`

## 4. 搜索结果相关组件迁移

- [ ] 4.1 重构 `SearchResultsQueue.tsx`：
  - MenuList 使用 `useLayer('dropdown')` 替代 `z-[10001]`
  - Tooltip 使用 `useLayer('tooltip')` 替代 `z-[10000]`
- [ ] 4.2 重构 `SearchResultCard.tsx`，MenuList 使用 `useLayer('dropdown')` 替代 `z-50`

## 5. 下拉/弹出组件迁移

- [ ] 5.1 重构 `ModelSelector.tsx`，为 PopoverContent 使用 `useLayer('popover')` 替代 `z-[9999]`
- [ ] 5.2 重构 `NotebookSwitcher.tsx`，为 PopoverContent 使用 `useLayer('popover')` 替代 `z-[9999]`
- [ ] 5.3 重构 `SessionSwitcher.tsx`，为 PopoverContent 使用 `useLayer('popover')` 替代 `z-[9999]`

## 6. 其他面板内 Menu 组件迁移

- [ ] 6.1 重构 `StudioPanel.tsx`，MenuList 使用 `useLayer('dropdown')` 替代 `z-50`
- [ ] 6.2 重构 `ChatPanel.tsx`，MenuList 使用 `useLayer('dropdown')` 替代 `z-50`

## 7. 集成验证

- [ ] 7.1 验证场景：打开 Modal → 显示 Dropdown → 触发 Toast → 显示 Tooltip，各层级正确堆叠
- [ ] 7.2 验证场景：从全屏搜索结果对话框触发添加来源对话框，层级正确
- [ ] 7.3 验证场景：知识图谱视图中的 Tooltip 和弹出菜单层级正确
- [ ] 7.4 验证场景：StudioOutputViewer 打开时，Toast 仍然可见
- [ ] 7.5 验证场景：ResearchDetailPanel 内的操作按钮 Tooltip 正确显示
- [ ] 7.6 验证场景：多个对话框同时打开时（如来源详情 + 添加确认），层级正确
- [ ] 7.7 清理所有遗留的硬编码 z-index（使用 grep 搜索确认无 `z-[` 或 `z-\d{2,}` 残留）

## 8. 文档更新

- [ ] 8.1 在 `frontend/web/AGENTS.md` 或 README 中添加 Layer 系统使用说明
- [ ] 8.2 添加代码注释说明各层级的用途和使用场景
- [ ] 8.3 创建 Layer 使用示例代码片段
