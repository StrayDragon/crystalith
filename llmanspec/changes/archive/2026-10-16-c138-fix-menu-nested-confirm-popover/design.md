# Design: 菜单内嵌确认弹层的存活机制

## 背景

`ConfirmPopover` 采用 `cloneElement` 把 onClick 挂到子元素、并在自身 `useState` 里维护
`open`。当它作为 `MenuList` 的子节点时，菜单项 `onSelect` 触发的默认关闭会让
Radix `DropdownMenuContent` 卸载，连带把 `ConfirmPopover` 从树上移除，`open` 状态随之
销毁 —— portal 永不出现。

## 方案对比

| 方案                                        | 说明                                                                                                                         | 取舍                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **A. 共享 `MenuItem` prop（选用）**         | `MenuItem` 增加可选 prop（暂名 `keepMenuOpen`），置位时其 `onSelect` 调用 `event.preventDefault()`，仅该菜单项不触发菜单关闭 | 纯增量、默认行为不变；一处机制覆盖全部 4 站点；不碰 `ConfirmPopover` 与定位策略 |
| B. Menu 级 `dismiss={{ itemPress: false }}` | 整个菜单项点击都不关闭                                                                                                       | 会连带让「放大查看 / 复制修复建议 / 重新嵌入」也不关菜单 —— 新回归，否          |
| C. 受控 Menu + 逐项手动 close               | `open`/`handler` 上提，除删除项外每项手动关闭                                                                                | 每站点都要写受控状态，代码更重、易漏；否                                        |
| D. 把 `ConfirmPopover` 移出菜单树           | 结构级重排，另找锚点                                                                                                         | 锚点为被删菜单项，移出后难以定位；改动面大，否                                  |

## 机制细节（方案 A）

- `MenuItem.onSelect` 现有逻辑：`onClick?.(event)` 之后，若 `closeOnItemPress === false`
  则 `event.preventDefault()`。新增 prop 与该条件取或即可复用同一逃生通道。
- 顺序保证：`onClick`（即 `ConfirmPopover` 的 `handleTriggerClick`）先执行并判断
  `event.defaultPrevented` 决定是否 `setOpen(true)`；此后再 `preventDefault()` 保留菜单。
  因此弹层打开与菜单保留可同时成立。
- 层级：`ConfirmPopover` 走 `useLayer('tooltip', 1)`（500 层），高于菜单的 `dropdown`
  （100 层），视觉与点击不被菜单遮挡。

## Pointer-events 屏障（实施期发现，e2e 才暴露）

`Menu` 用 Radix **modal** 菜单，打开时对 `body` 施加 `pointer-events: none`；因此单纯
「保持菜单开启」会让同页的 `ConfirmPopover` portal（挂在 body 下）继承 `none`、
在真实浏览器里点不动（jsdom 直接派发事件、测不出来）。修复：`ConfirmPopover` 的
portal 容器显式 `pointerEvents: 'auto'`，在任何 modal 宿主（菜单或对话框）之上重新
获得可点击性。这同时修正了其它「弹层嵌在 modal 容器内」的潜在同源问题。

## 测试 seam

- **共享 UI**：组件级 Rstest，`Menu + MenuList + ConfirmPopover + MenuItem` 最小复现，
  断言点击菜单项后 `confirm-popover-confirm` 出现（进 `just qa` 的 `test:ci`）。
- **站点级**：`SourceListRow`、`StudioOutputsList` 各一条 Rstest，锁定真实装配路径。
- **e2e**：现有 S12（`@p1`）恢复绿；不改其断言。

## 风险与回滚

- 风险低：prop 纯增量、默认关闭；仅 4 处显式启用。
- 回滚：撤新增 prop 与 4 处启用即可，无数据/协议残留。
