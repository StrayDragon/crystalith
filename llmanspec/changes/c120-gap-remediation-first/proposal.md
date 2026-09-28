---
depends_on: ["c119-low-effort-deferred-tests"]
---

# 缺口处置第一批：r290 产品修复 + r111/r351 合约对齐

## Why

B 区扫出的缺口清单中，本批处置三件调研定论明确的事项：r290 是用户可踩到的真缺陷（空文件上传返回 200/ready/0 chunk 且创建来源行）；r111 与 r152（fork-run 必须以 `?rid=` 导航）存在合约张力——被动恢复恰是 r152 的必要侧，实现有意为之（页面 loading 提示佐证），应修合约厘清而非砍功能；r351 描述的专用端点（/ui/state、/ui/event）不存在，但能力已由 session 资源承载（GET 返回 sharedState + sharedStateRevision，PATCH 做 revision 冲突检查），应修合约对齐现实而非造无人使用的端点。

## What Changes

- **r290 产品修复**：`ingestSource` 在插行前对空 buffer 直接 400（INVALID_REQUEST，不创建来源）；解析分块后零 chunk 时清理已插的 processing 行与 contentStorage 字节并 400（无可索引内容）。补集成测试（空 txt、纯空白 txt 均 400 且 sources 表无行）+ spec 场景。
- **r111 合约对齐（修 spec）**：规则文本改写为「v1 不提供可分享/可收藏的外部 deep link 保证；应用内导航 MAY 携带 `?rid=` 且 Lab 到达时恢复该 Run（r152 fork-run 所必需）」。补场景锚定 labRouting/ResearchLabPage 既有行为。
- **r351 合约对齐（修 spec）**：规则改写为 session 资源承载 UI 状态：`GET .../sessions/{sessionId}` 返回 `sharedState` + `sharedStateRevision`；`PATCH` 携带 `sharedState` 时做 revision 冲突检查（409）。补场景锚定 sessions/router 既有行为与测试。chat-ui-envelope r29 文本中「经 `/ui/state` 拉取恢复」同步改为「经 session 资源拉取恢复」。
- 不新增任何端点；r290 之外产品代码零改动。

## Capabilities

source-ingestion-upload-and-url（r290）、deep-research-ui（r111）、workspace-api-contract（r351）、chat-ui-envelope（r29 文本勘误）

## Impact

- review `pending` 111 → 108（三条款补场景）；r290 修复后空文件上传不再产生垃圾来源行。
- r111/r351 为锁定规则文本改写（报告制 WARNING，预期内）；修改经由 SDD 提案批准。
