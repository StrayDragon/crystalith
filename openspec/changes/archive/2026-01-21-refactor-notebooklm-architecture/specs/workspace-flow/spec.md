## ADDED Requirements

### Requirement: 工作流状态管理
系统 MUST使用 Context + Reducer 模式管理工作流状态。

#### Scenario: 状态管理
- **WHEN** 用户操作工作区
- **THEN** 系统通过 `WorkspaceContext` 和 `workspaceReducer` 管理状态

### Requirement: 输入-对话-输出流程
系统 MUST优化输入→对话→输出的主流程。

#### Scenario: 主流程
- **WHEN** 用户输入问题
- **THEN** 系统依次：检索来源 → 生成回答 → 展示引用 → 可选生成输出

### Requirement: 会话切换
系统 MUST支持在多个会话之间切换。

#### Scenario: 切换会话
- **WHEN** 用户选择不同会话
- **THEN** 系统加载该会话的消息历史和上下文

#### Scenario: 新建会话
- **WHEN** 用户点击新建会话
- **THEN** 系统创建新会话并切换到空白对话界面

### Requirement: 输出类型选择
系统 MUST提供输出类型选择界面。

#### Scenario: 选择输出类型
- **WHEN** 用户点击输出区域
- **THEN** 系统展示可用的输出类型列表（FAQ/指南/时间轴等）

### Requirement: 建议问题展示
系统 MUST在界面中展示建议问题。

#### Scenario: 展示建议
- **WHEN** 用户打开 Notebook 或完成对话
- **THEN** 系统在聊天区域展示建议问题卡片

### Requirement: 面板联动
系统 MUST实现三栏面板的联动交互。

#### Scenario: 引用联动
- **WHEN** 用户点击回答中的引用
- **THEN** 左侧来源面板高亮对应的来源和片段

#### Scenario: 输出联动
- **WHEN** 用户生成输出
- **THEN** 右侧输出面板自动展示新生成的内容

### Requirement: 加载状态
系统 MUST清晰展示各种加载状态。

#### Scenario: 加载指示
- **WHEN** 系统正在处理请求
- **THEN** 界面展示对应的加载指示器（骨架屏/进度条/动画）

### Requirement: 错误处理
系统 MUST优雅处理错误情况。

#### Scenario: 错误提示
- **WHEN** 请求失败
- **THEN** 系统展示友好的错误提示，提供重试选项

### Requirement: 键盘快捷键
系统 MUST支持常用的键盘快捷键。

#### Scenario: 快捷键
- **WHEN** 用户按下快捷键
- **THEN** 系统响应：Enter 发送消息、Cmd/Ctrl+K 搜索、Esc 关闭弹窗

---

## 技能要求

### 前端实现技能

1. **UI/UX Pro Max** (`ui-ux-pro-max`)
   - 三栏布局使用 Tailwind CSS Grid/Flexbox
   - 响应式断点：`sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px)
   - 面板切换动画使用 `transition-all duration-200`
   - 加载状态使用骨架屏（Skeleton）而非 Spinner
   - 所有交互元素添加 `cursor-pointer`
   - 使用 Heroicons 或 Lucide 图标，禁止 emoji

2. **Vercel React Best Practices** (`vercel-react-best-practices`)
   - 状态管理使用 Context + useReducer 模式
   - 拆分为独立 hooks：`useNotebooks`, `useSources`, `useChat`, `useRefine`
   - 使用 `useMemo` 缓存派生状态
   - 使用 `useCallback` 稳定回调函数
   - 数据获取使用 SWR，自动去重和缓存
   - 大组件使用 React.lazy 懒加载

3. **Web Interface Guidelines** (`web-design-guidelines`)
   - 所有面板有 `aria-label` 属性
   - 键盘导航支持 Tab 切换面板
   - 焦点状态清晰可见（`focus:ring-2`）
   - 尊重 `prefers-reduced-motion`
   - 颜色对比度符合 WCAG AA 标准

### 代码组织

```
frontend/web/src/features/workspace/
├── context/
│   ├── WorkspaceContext.tsx    # 全局状态 Context
│   └── workspaceReducer.ts     # Reducer 逻辑
├── hooks/
│   ├── useNotebooks.ts         # Notebook 相关逻辑
│   ├── useSources.ts           # Source 相关逻辑
│   ├── useChat.ts              # 聊天相关逻辑
│   ├── useRefine.ts            # 提炼相关逻辑
│   └── useSessions.ts          # 会话相关逻辑
├── components/
│   ├── WorkspaceLayout.tsx     # 三栏布局容器
│   ├── SourcesPanel.tsx        # 左侧来源面板
│   ├── ChatPanel.tsx           # 中间聊天面板
│   ├── OutputPanel.tsx         # 右侧输出面板
│   ├── SessionSwitcher.tsx     # 会话切换器
│   └── OutputTypeSelector.tsx  # 输出类型选择器
└── WorkspacePage.tsx           # 页面入口
```
