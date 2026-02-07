## 1. 虚拟列表

- [x] 1.1 安装 `react-virtuoso` 依赖
- [x] 1.2 将 ChatPanel 的消息列表替换为 `<Virtuoso>`，保留自动滚动到底部行为
- [x] 1.3 将 SourcesPanel 的来源列表替换为 `<Virtuoso>`，保留多选交互和状态标识
- [x] 1.4 将 StudioPanel 的输出历史列表替换为 `<Virtuoso>`
- [x] 1.5 将 SearchResultsQueue 的搜索结果列表替换为 `<Virtuoso>`
- [x] 1.6 编写测试：渲染 500 条消息，验证仅可见区域的 DOM 节点被挂载
- [x] 1.7 验证：Chrome DevTools Performance 面板录制，100+ 消息场景下滚动帧率 > 30fps

## 2. 代码分割与懒加载

- [x] 2.1 将 `KnowledgeGraphView` 改为 `React.lazy(() => import(...))` + `<Suspense fallback={<Skeleton />}>`
- [x] 2.2 将 `SlidesStudioDialog` 改为懒加载
- [x] 2.3 将 `ResearchDetailPanel` 改为懒加载
- [x] 2.4 将 `SourceDetailDialog` 改为懒加载
- [ ] 2.5 验证 Vite 构建产物 chunk 拆分：主 bundle 减小 >20%，懒加载 chunk 按需加载
- [ ] 2.6 验证：首屏加载时间（LCP）改善，DevTools Network 面板确认懒加载 chunk 在触发时才加载

## 3. 骨架屏统一

- [x] 3.1 在 `shared/` 创建通用骨架屏组件：`SkeletonLine`、`SkeletonCard`、`SkeletonList`
- [x] 3.2 替换 ChatPanel 的 pulse 动画为 `SkeletonList`
- [x] 3.3 替换 SourcesPanel 的 loading 状态为 `SkeletonList`
- [x] 3.4 替换 StudioPanel 的 loading 状态为 `SkeletonCard`
- [x] 3.5 为 Suspense fallback 使用对应的骨架屏组件
- [x] 3.6 验证：所有面板的 loading 状态视觉风格一致

## 4. 防抖与节流

- [x] 4.1 来源列表搜索输入添加 300ms debounce
- [x] 4.2 面板 resize 事件添加 requestAnimationFrame 节流
- [x] 4.3 窗口 resize 事件处理添加 debounce
- [x] 4.4 验证：快速输入搜索关键词时，不出现卡顿或闪烁
