## ADDED Requirements

### Requirement: 引用悬停预览
系统必须支持引用的悬停预览。

#### Scenario: 悬停预览
- **WHEN** 用户悬停在引用标记上
- **THEN** 系统展示 Tooltip，显示来源名称、页码、原文片段

### Requirement: 跳转到原文
系统必须支持从引用跳转到原文位置。

#### Scenario: 跳转原文
- **WHEN** 用户点击引用标记
- **THEN** 左侧来源面板滚动到对应位置，高亮显示引用片段

### Requirement: 引用多选
系统必须支持选择多个引用进行操作。

#### Scenario: 多选引用
- **WHEN** 用户勾选多个引用
- **THEN** 系统显示已选数量和操作栏

### Requirement: 引用操作栏
系统必须提供引用的批量操作功能。

#### Scenario: 操作栏功能
- **WHEN** 用户选择引用后
- **THEN** 操作栏提供：发送到提炼、对比分析、复制引用、全选、清除选择

### Requirement: 引用高亮联动
系统必须实现引用与来源的高亮联动。

#### Scenario: 悬停联动
- **WHEN** 用户悬停在引用上
- **THEN** 左侧来源面板对应片段高亮显示

#### Scenario: 消息联动
- **WHEN** 用户悬停在消息上
- **THEN** 该消息引用的所有片段在来源面板高亮

### Requirement: 引用来源标识
系统必须清晰标识引用的来源。

#### Scenario: 来源标识
- **WHEN** 展示引用
- **THEN** 显示来源文件名、图标、页码（如适用）

### Requirement: 引用复制
系统必须支持复制引用内容。

#### Scenario: 复制引用
- **WHEN** 用户点击复制按钮
- **THEN** 系统将引用文本和来源信息复制到剪贴板

### Requirement: 引用展开
系统必须支持展开查看完整引用内容。

#### Scenario: 展开引用
- **WHEN** 引用片段较长被截断
- **THEN** 用户可点击展开查看完整内容

### Requirement: 引用分组
系统必须支持按来源分组展示引用。

#### Scenario: 分组展示
- **WHEN** 回答包含多个来源的引用
- **THEN** 系统按来源分组展示，显示每个来源的引用数量

---

## 技能要求

### 前端实现技能

1. **UI/UX Pro Max** (`ui-ux-pro-max`)
   - 引用标记使用 `inline-flex` 确保与文本对齐
   - 悬停预览使用 Tooltip 组件，`z-index: 50`
   - 高亮效果使用 `bg-yellow-100 dark:bg-yellow-900/30`
   - 多选复选框使用 `accent-primary` 颜色
   - 操作栏使用 `sticky bottom-0` 固定在底部

2. **Vercel React Best Practices** (`vercel-react-best-practices`)
   - 引用列表使用 `useMemo` 缓存
   - 悬停状态使用 `useState` + `onMouseEnter/Leave`
   - 滚动定位使用 `useRef` + `scrollIntoView`
   - 多选状态使用 `Set` 数据结构

3. **Web Interface Guidelines** (`web-design-guidelines`)
   - 引用标记有 `role="button"` 和 `tabIndex={0}`
   - 支持 Enter/Space 键触发点击
   - 悬停预览有 `role="tooltip"`
   - 高亮不依赖颜色（添加边框或图标）

### 组件结构

```
frontend/web/src/features/workspace/components/
├── citations/
│   ├── CitationMark.tsx        # 内联引用标记 [1]
│   ├── CitationTooltip.tsx     # 悬停预览 Tooltip
│   ├── CitationList.tsx        # 引用列表
│   ├── CitationItem.tsx        # 单个引用项
│   ├── CitationActions.tsx     # 多选操作栏
│   └── CitationHighlight.tsx   # 高亮效果
└── index.ts
```
