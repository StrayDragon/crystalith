## Why

当前前端存在多处性能瓶颈：所有列表（消息、来源、输出）均无虚拟化，数据量增长时 DOM 节点数线性增加导致渲染卡顿；KnowledgeGraphView、SlidesStudioDialog 等重组件无代码分割，首屏加载 bundle 过大；WorkspaceContext 的任意状态变化触发所有消费者重渲染（需配合 `refactor-state-to-zustand` 一起解决）。这些问题在中大型 notebook（50+ sources、100+ messages）中尤为明显。

## What Changes

- 消息列表、来源列表、输出列表引入虚拟列表（react-virtuoso）
- KnowledgeGraphView、SlidesStudioDialog、ResearchDetailPanel 使用 React.lazy + Suspense 懒加载
- 统一 loading 状态模式：建立骨架屏组件库，替换不一致的 loading 展示
- 图片/资源懒加载策略
- 列表搜索/过滤操作添加 debounce 防止高频重渲染

## Impact

- 受影响的规范：`workspace-ui`（MODIFIED）、`frontend-module-structure`（MODIFIED）
- 受影响的系统：
  - 前端 ChatPanel — 消息虚拟列表
  - 前端 SourcesPanel — 来源虚拟列表
  - 前端 StudioPanel — 输出虚拟列表
  - 前端 WorkspaceLayout — 懒加载重组件
  - 前端 shared — 骨架屏组件库
