---
depends_on: []
---

## Why

工作区三栏（来源 / 笔记 / 对话）本应职责清晰，但「在网络中搜索新来源」主条嵌在来源栏，把**库管理**与**外网检索/调研入口**混在一起，也阻碍后续顶栏「整本笔记搜索」与 Deep Research 二级台。产品基线（`docs/product/deep-research-prd.md` v0.2.1）要求 **P-1 先迁顶栏**：Fast 网搜添来源迁到中间顶栏 + E1 宽幅面板；来源栏瘦身；深研 Tab 仅壳（Runtime 另 change）。

## What Changes

1. **顶栏**：中置搜索/调研输入；点击或聚焦打开 **E1** 顶栏锚定宽幅面板（Layer 统一管理；Esc/遮罩关闭）。
2. **面板 Tabs**：
   - **快速搜索**（必须可用）：现有 SearXNG 网搜 → 选结果 → 添加到来源（行为与迁出前一致，禁止复制第二套 fetch）。
   - **深度研究**（仅壳）：空队列/重建中提示；MUST NOT 调用已 stub 的深研 agent；旧 Sources「Deep Research」模式切换 MUST 移除或隐藏。
3. **来源栏**：移除主网搜条与 Deep/Fast 模式切换；可保留「筛选已有来源」本地 filter。
4. **测试**：更新 Vitest / e2e `@p0` testid（原 Sources 搜索入口 → 顶栏）。
5. **文档**：删除临时 `docs/product/workspace-topbar-search.md`（契约并入本 change）。

## Capabilities

- `workspace-ui-core` — 顶栏职责与弹层策略
- `workspace-ui-panels` — 来源栏瘦身、顶栏面板 Tabs、深研壳

## Impact

- **BREAKING（UI）**：来源栏不再提供主网搜；用户改走顶栏。
- API：无服务端契约变更（仍用现有 sources 网搜 + ingest）。
- 后续 Deep Research Runtime / 转化 / chat-with-result 不在本 change 范围。
