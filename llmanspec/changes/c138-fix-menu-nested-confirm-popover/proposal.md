---
depends_on: []
title: 修复菜单内嵌确认弹层不渲染（共享 MenuItem 保持菜单开启）
needs_specs_change: true
---

## Why

破坏性操作若把 `ConfirmPopover` 嵌在 `Menu`/`MenuList` 内，选中菜单项时 Radix
DropdownMenu 默认关闭并卸载 Content，`ConfirmPopover` 随之卸载、其 `open` 状态丢失，
portal 永不渲染 —— 点击「删除」变成死路。当前共有 4 处同源站点：

- `SourceListRow` 行删除（e2e S12 `@p1` 长期红，c137 二分实证与依赖升级无关）
- `SourcesPanelToolbar` 批量删除
- `StudioOutputsList` 卡片删除
- `StudioOutputViewer` 卡片删除

其余 `ConfirmPopover` 都是独立按钮、不嵌菜单，因此门禁一直未暴露该缺陷（唯一有测试的
`SystemConfigDialog` 是独立按钮）。该缺陷违反 workspace-ui-panels r415「移除操作仅当
真实可用时呈现」与 studio-output-types「最小可用交互」的既有意图。

## What Changes

- 共享 `MenuItem` 新增可选 prop，使**单个**菜单项在被选中后保持菜单开启（其余项行为不变），
  供内嵌确认弹层的破坏性项使用。
- 4 处 menu-nested 删除项应用该 prop，恢复确认气泡渲染与确认/取消流程。
- 新增 web-ui-foundation 条款 + 场景，锁定「瞬态容器内触发的交互弹层不得因容器关闭而失效」。
- 测试：共享 UI 组件级 Rstest（最小复现）+ `SourceListRow` / `StudioOutputsList`
  站点级 Rstest；现有 e2e S12 恢复绿。

**非目标**：不改 `ConfirmPopover` 的定位/Layer 策略；不把 4 处菜单改成受控 Menu；
不引入新的 dialog 运行时。

## Capabilities

- **web-ui-foundation**（shared `Menu`/`MenuItem`；新增一条 overlay 生命周期条款）
- **workspace-ui-panels**（Sources 行删除、批量删除）
- **studio-output-types**（Studio 输出卡片删除）

## Impact

- 纯前端修复；无 wire/协议/配置变更，无迁移。
- 新增条款遵守「不写文件/函数名」守则；共享 `MenuItem` prop 为纯增量、默认关闭，
  对既有调用零影响。
