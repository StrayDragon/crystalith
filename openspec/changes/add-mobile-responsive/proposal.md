## Why

当前三栏布局在移动设备上无法正常使用，用户在手机或平板上的体验较差。移动端响应式设计可以扩大产品的使用场景。

## What Changes

- 移动端布局优化（面板堆叠/Tab 切换）
- 添加底部导航栏
- 支持触摸手势

## Impact

- 受影响的规范：`workspace-ui`
- 受影响的代码：
  - `frontend/web/src/features/workspace/components/WorkspaceLayout.tsx`
  - `frontend/web/src/features/workspace/WorkspacePage.css`
- 依赖关系：依赖 T12（深色模式支持）提供主题基础
