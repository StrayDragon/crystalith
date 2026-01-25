## Context

当前前端代码库使用 `@material-tailwind/react` 作为主要 UI 组件库，配合 Tailwind CSS 进行样式管理。多个组件（Dialog、Popover、Menu、Tooltip、Toast）需要渲染在页面顶层，但各自使用硬编码的 z-index 值导致层级冲突。

**当前问题示例（完整清单）：**

| 组件 | z-index 值 | 问题 |
|------|-----------|------|
| `toast.tsx` | `z-[99999]` | 过大，与其他 99999 冲突 |
| `AddSearchResultDialog.tsx` | `z-[99999]` | 与 Toast 同级，无法区分 |
| `CitationMark.tsx` | `z-[99999]` | Tooltip 不应与 Modal 同级 |
| `SourceDetailDialog.tsx` MenuList | `z-[10001]` | 任意数值 |
| `SearchResultsQueue.tsx` MenuList | `z-[10001]` | 任意数值 |
| `SearchResultsQueue.tsx` Tooltip | `z-[10000]` | 低于同组件的 Menu |
| `ModelSelector.tsx` | `z-[9999]` | 与其他 Popover 相同 |
| `NotebookSwitcher.tsx` | `z-[9999]` | 与其他 Popover 相同 |
| `SessionSwitcher.tsx` | `z-[9999]` | 与其他 Popover 相同 |
| `StudioOutputViewer.tsx` | `z-[60]` | 低于其他 Modal |
| `ResearchDetailPanel.tsx` | `z-50` | Tailwind 预设值 |
| `KnowledgeGraphView.tsx` | `z-50` | 与其他面板冲突 |
| `StudioPanel.tsx` MenuList | `z-50` | 低于其他 Menu |
| `ChatPanel.tsx` MenuList | `z-50` | 低于其他 Menu |
| `SearchResultCard.tsx` MenuList | `z-50` | 低于其他 Menu |

**问题分类：**
1. **数值膨胀**：99999、10001、10000 等任意大数值
2. **层级不一致**：同类组件使用不同 z-index（如 Modal 有 60、50、99999）
3. **优先级错误**：Tooltip 应高于 Menu，但实际相反（10000 < 10001）

**根本原因：**
1. 缺乏统一的 z-index 层级规范
2. Material Tailwind 组件的 z-index 控制不够灵活
3. 开发者采用"数字越大越安全"的策略，导致数值膨胀

## Goals / Non-Goals

### Goals
- 建立统一的 z-index 层级系统，消除硬编码值
- 提供声明式 API 管理层级，开发者只需指定语义层级名称
- 确保弹窗、通知等元素按预期顺序堆叠
- 支持动态层级（如多个 Toast 的堆叠顺序）
- 与现有 Material Tailwind 组件兼容

### Non-Goals
- 不更换 UI 组件库（继续使用 Material Tailwind）
- 不重写所有对话框组件（渐进式迁移）
- 不引入大型第三方层级管理库（保持轻量）

## Decisions

### Decision 1: 自研轻量级 Layer System 而非引入第三方库

**选择：** 创建项目内部的 Layer 管理系统

**理由：**
- `react-layered` 库社区较小（仅 7 星），长期维护存疑
- Base Web Layer 需要引入整个设计系统，与 Material Tailwind 冲突
- Radix UI 需要迁移现有组件，成本过高
- 自研方案可完全控制实现，与现有架构无缝集成

**权衡：**
- 优点：零额外依赖、完全可控、与 Material Tailwind 兼容
- 缺点：需要自行维护、功能相对简单

### Decision 2: 使用语义化层级名称 + CSS 变量

**选择：** 定义语义化层级常量，通过 CSS 变量注入 z-index 值

**层级定义（从低到高）：**
```typescript
const LAYER_LEVELS = {
  base: 0,        // 普通内容
  dropdown: 100,  // 下拉菜单
  popover: 200,   // 弹出框
  modal: 300,     // 模态对话框
  toast: 400,     // 通知消息
  tooltip: 500,   // 工具提示（始终最高）
} as const;
```

**理由：**
- 语义化名称比数字更易理解和维护
- 预留间隔（100）支持未来扩展
- CSS 变量支持运行时调整

### Decision 3: LayerProvider + useLayer Hook 模式

**选择：** React Context + Hook 的组合模式

**API 设计：**
```typescript
// 在 App 根组件包裹
<LayerProvider>
  <App />
</LayerProvider>

// 在组件中使用
const { zIndex, style } = useLayer('modal');
// 或支持动态 slot
const { zIndex } = useLayer('toast', toastIndex);
```

**理由：**
- 声明式 API，开发者无需关心具体数值
- Hook 模式与 React 生态契合
- 支持嵌套层级上下文（未来扩展）

### Decision 4: 渐进式迁移策略

**选择：** 分阶段迁移现有组件，优先处理问题最严重的组件

**迁移顺序：**
1. Toast 组件（全局唯一，影响面最广）
2. 自定义 Portal 对话框（AddSearchResultDialog 等）
3. Material Tailwind 组件覆盖（通过 className 注入）
4. 其他弹出组件（Tooltip、Popover 等）

## Risks / Trade-offs

### Risk 1: Material Tailwind 组件样式覆盖可能失效
- **缓解：** 使用 `!important` 或更具体的选择器
- **缓解：** 必要时使用 Portal 包装器

### Risk 2: 迁移过程中可能出现短暂的层级错乱
- **缓解：** 分批迁移，每批完成后验证
- **缓解：** 保留临时兼容层，支持新旧系统并存

### Risk 3: 嵌套弹窗场景的层级计算复杂度
- **缓解：** 初期不支持嵌套，先解决扁平场景
- **缓解：** 在对话框内打开的下拉菜单自动提升层级

## File Structure

```
frontend/web/src/
├── shared/
│   ├── layer/
│   │   ├── index.ts           # 导出入口
│   │   ├── LayerProvider.tsx  # Context Provider
│   │   ├── useLayer.ts        # Hook
│   │   ├── constants.ts       # 层级常量
│   │   └── types.ts           # 类型定义
│   └── toast.tsx              # 迁移后的 Toast
```

## Migration Plan

### Phase 1: 基础设施搭建
1. 创建 `shared/layer/` 模块
2. 实现 LayerProvider 和 useLayer
3. 在 App.tsx 添加 LayerProvider

### Phase 2: Toast 迁移
1. 重构 `toast.tsx` 使用 useLayer
2. 移除硬编码 `z-[99999]`
3. 验证 Toast 在各场景下正确显示

### Phase 3: 对话框迁移
1. 重构 AddSearchResultDialog
2. 为 SourceDetailDialog 的子组件添加层级覆盖
3. 处理 SearchResultsQueue 中的 Menu 和 Tooltip

### Phase 4: 其他组件迁移
1. 迁移 ModelSelector、NotebookSwitcher、SessionSwitcher
2. 迁移 CitationMark
3. 清理所有遗留的硬编码 z-index

### Rollback
- 保留原有 z-index 值作为注释，便于回滚
- 如遇问题，可快速恢复硬编码值

## Open Questions

1. 是否需要支持用户自定义层级优先级？（建议：暂不支持，保持简单）
2. 如何处理第三方库（如 ReactFlow）的 z-index？（建议：单独处理，不纳入统一系统）
3. 是否需要 SSR 兼容？（建议：当前项目为 SPA，暂不考虑）
