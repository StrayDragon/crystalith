## Why

当前 Crystalith 是单用户应用，不支持多用户协作。在团队场景下（如研究小组、项目团队），多人需要共享 notebook、协同添加 source 和讨论。引入协作功能可扩展产品的适用范围，从个人工具升级为团队工具。

## What Changes

- 支持 notebook 共享（生成分享链接、设置权限）
- 实时协作：多用户同时查看和编辑同一 notebook
- 基于 WebSocket 的实时状态同步（source 更新、新消息通知）
- 简单的权限模型（Owner / Editor / Viewer）
- 协作光标/在线状态指示

## Impact

- 受影响的规范：`workspace-ui`（MODIFIED），`data-access`（MODIFIED）
- 受影响的系统：
  - 后端需引入 WebSocket 支持
  - 数据库 schema 需添加用户和权限相关表
  - 前端需添加实时同步层和协作 UI 元素
- 依赖：此变更依赖 `add-auth-system` 先行实施
