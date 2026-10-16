# Tasks

每个 task 是一条可独立验证的窄切片；`[blocked-by]` 标明实现依赖。

## T1 — 共享 MenuItem keep-open 机制 + 共享 UI 回归

- [ ] `shared/ui/Menu.tsx`：`MenuItem` 新增可选 prop（`keepMenuOpen?: boolean`，默认
  false），置位时其 `onSelect` 走 `event.preventDefault()` 保留菜单；默认行为不变。
- [ ] 新增共享 UI Rstest：`Menu + MenuList + ConfirmPopover + MenuItem` 最小复现，
  断言点击菜单项后 `confirm-popover-confirm` 出现；并断言未置位 prop 时菜单正常关闭。
- [ ] 验证：`cd apps/web && bun run test:ci`
- [ ] 验证：`bun typecheck`

## T2 — SourceListRow 删除项应用 + 站点 Rstest [blocked-by: T1]

- [ ] `SourceListRow` 删除项 `MenuItem` 置 `keepMenuOpen`，其余项（放大查看 / 复制修复建议 /
  重新嵌入）行为不变。
- [ ] 新增/扩展 `SourceListRow.test.tsx`：打开行菜单 → 点删除 → 断言确认气泡出现并可确认。
- [ ] 验证：`cd apps/web && bun run test:ci`

## T3 — StudioOutputsList 删除项应用 + 站点 Rstest [blocked-by: T1]

- [ ] `StudioOutputsList` 卡片删除项 `MenuItem` 置 `keepMenuOpen`。
- [ ] 新增 `StudioOutputsList` 组件级 Rstest：菜单删除项触发确认气泡渲染。
- [ ] 验证：`cd apps/web && bun run test:ci`

## T4 — SourcesPanelToolbar 批量删除 + StudioOutputViewer 应用 [blocked-by: T1]

- [ ] `SourcesPanelToolbar` 批量删除项 `MenuItem` 置 `keepMenuOpen`。
- [ ] `StudioOutputViewer` 卡片删除项 `MenuItem` 置 `keepMenuOpen`。
- [ ] 验证：`cd apps/web && bun run test:ci`

## T5 — 收尾验证

- [ ] 现有 e2e S12（`@p1`）恢复绿：`just e2e-p1`
- [ ] `just qa`（typecheck + lint + format + drift + server/shared + web Rstest + e2e @p0）全绿
- [ ] 确认 4 处 menu-nested 删除均无残留 `dismiss`/受控改动；`ConfirmPopover` 未改动
