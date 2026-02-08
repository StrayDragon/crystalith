## Why

当前系统仅支持浅色主题，在低光环境下使用会造成眼睛疲劳。深色模式已成为现代 Web 应用的基本期望。本提案在 notplan-changes/add-dark-mode 基础上扩展，提供完整的主题系统设计。

## What Changes

- 基于 Tailwind CSS dark mode 建立主题系统
- 支持三种模式：浅色、深色、跟随系统
- 主题偏好持久化到 localStorage
- 所有组件适配深色模式色彩变量
- 添加主题切换控件到 WorkspaceHeader

## Impact

- 受影响的规范：`workspace-ui`（MODIFIED）
- 受影响的系统：
  - 前端全局样式（CSS 变量、Tailwind 配置）
  - 所有前端组件（深色模式样式适配）
  - WorkspaceHeader（主题切换控件）
