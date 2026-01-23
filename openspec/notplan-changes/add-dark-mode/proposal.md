## Why

当前系统仅支持浅色主题，在低光环境下可能造成眼睛疲劳。深色模式是现代 Web 应用的标配功能，可以提升用户体验和可访问性。

## What Changes

- 添加深色模式主题变量
- 支持系统偏好自动检测
- 支持手动切换主题

## Impact

- 受影响的规范：`workspace-ui`
- 受影响的代码：
  - `frontend/web/src/app/theme.ts`
  - `frontend/web/src/app/index.css`
  - `frontend/web/src/features/workspace/WorkspacePage.css`
- 依赖关系：此变更为 T13（移动端响应式）提供主题基础
