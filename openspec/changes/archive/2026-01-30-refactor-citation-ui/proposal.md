# Proposal: refactor-citation-ui

## Summary

重构引用展示系统，提升用户体验和交互直觉性。主要包含两个方面：

1. **引用展示优化**：创建通用引用悬浮组件（CitationPopover），替代当前不直观的选择界面，在 ChatPanel 和 StudioOutputViewer 中统一使用
2. **深度研究并发 Bug 修复**：修复左侧研究任务进行中时右侧仍可创建新研究的并发问题

## Motivation

### 问题 1：引用展示交互不直观

当前的引用展示存在以下问题：

- **CitationActions 组件**：使用"已选 0/5 条引用"的选择界面，需要用户先选择再操作，不符合直觉
- **ChatPanel 中的引用**：仅显示引用标记 `[1][2][3]`，用户需要悬停才能看到详情，无法一次性查看所有引用
- **StudioOutputViewer 中的引用**：底部仅显示引用标记列表，缺少"查看全部引用"的入口

### 问题 2：深度研究并发控制缺失

在 `SourcesPanel.tsx` 的 `handleSearch` 函数（第 321-354 行）中：

```typescript
const handleSearch = async () => {
  if (mode === 'Deep Research') {
    // ... 基本验证 ...
    try {
      const session = await research.createSession(searchQuery.trim());
      if (session) {
        await research.startResearch(session.id);  // 直接启动，无并发检查
        // ...
      }
    }
  }
}
```

**问题分析**：
1. **无活动研究检查**：创建新研究时没有检查 `research.sessions` 中是否有状态为 `searching`、`analyzing`、`waiting_user` 的会话
2. **无加载状态检查**：没有检查 `research.isLoading`，可能导致重复提交
3. **SSE 连接覆盖**：新研究的 SSE 订阅会覆盖旧连接（`useResearch.ts` 第 326-328 行），但旧研究仍在后台运行
4. **用户困惑**：左侧显示"规划中"的研究胶囊，但用户可以同时启动新研究，导致 UI 状态混乱

## Proposed Solution

### 方案 1：通用引用悬浮组件

创建 `CitationPopover` 组件，提供统一的引用查看体验：

```
┌─────────────────────────────────────┐
│ 引用详情                    [×]     │
├─────────────────────────────────────┤
│ [1] 来源A - 第3页                   │
│     "引用片段预览..."               │
├─────────────────────────────────────┤
│ [2] 来源B - 第7页                   │
│     "引用片段预览..."               │
├─────────────────────────────────────┤
│ [3] 来源C - 第12页                  │
│     "引用片段预览..."               │
└─────────────────────────────────────┘
```

**使用场景**：

1. **ChatPanel**：在助手消息的引用标记旁添加"查看引用"按钮，点击后在消息旁显示悬浮 Popover
2. **StudioOutputViewer**：在引用区域添加"查看全部"按钮，点击后显示悬浮 Popover

**交互设计**：
- 点击"查看引用"按钮打开 Popover
- Popover 显示在触发元素附近（使用 Portal）
- 点击 Popover 外部或关闭按钮关闭
- 支持点击单个引用跳转到来源

### 方案 2：深度研究并发控制

在 `handleSearch` 函数中添加检查：

```typescript
const handleSearch = async () => {
  if (mode === 'Deep Research') {
    // ... 现有验证 ...

    // 新增：检查是否有正在运行的研究任务
    const hasActiveResearch = research.sessions.some(
      s => ['searching', 'analyzing', 'waiting_user'].includes(s.status)
    );
    if (hasActiveResearch) {
      toast.error('已有研究任务正在进行中，请等待完成后再创建新研究');
      return;
    }

    // 新增：检查加载状态
    if (research.isLoading) {
      toast.error('请稍候，操作正在进行中');
      return;
    }

    // ... 创建研究 ...
  }
}
```

**关键点**：
1. 检查 `sessions` 数组中是否有活动状态的研究
2. `planning` 状态不阻止新建（用户可能放弃未开始的研究）
3. `completed` 和 `cancelled` 状态不影响新建
4. 提供清晰的用户提示

## Scope

### In Scope

- 创建 `CitationPopover` 通用组件
- 修改 `ChatPanel` 添加"查看引用"按钮
- 修改 `StudioOutputViewer` 使用 `CitationPopover`
- 修复 `SourcesPanel` 中的深度研究并发问题
- 保留现有 `CitationMark` 组件的悬停 tooltip 功能

### Out of Scope

- 移除或重构 `CitationActions` 组件（保留现有功能，后续可考虑优化）
- 修改 `CitationList` 组件的选择逻辑
- 后端 API 变更

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Popover 定位在复杂布局中可能出问题 | 使用 Portal 渲染，参考现有 CitationMark tooltip 的定位逻辑 |
| 移动端触摸交互体验 | 确保 Popover 支持触摸关闭，考虑响应式尺寸 |
| 并发检查可能阻止合理的多研究场景 | 仅阻止"进行中"状态的研究，已完成的研究不影响新建 |

## Success Criteria

1. 用户可以通过"查看引用"按钮一次性查看消息的所有引用
2. StudioOutputViewer 中的引用展示更加直观
3. 无法在已有研究进行中时创建新的深度研究
4. 现有的引用悬停 tooltip 功能保持不变
