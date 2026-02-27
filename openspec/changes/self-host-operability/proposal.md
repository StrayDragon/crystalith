## Why

- Crystalith 以本地/自托管为主，但“可运维性”仍偏工程向：健康端点存在、Compose overlays 存在，但缺少面向用户的诊断入口与系统化的排障/备份恢复说明。
- 自托管用户的核心诉求是“能跑、出问题能定位、数据可迁移可恢复”。缺少明确文档与 UI 入口会显著提高支持与流失风险。

## What Changes

- 增加“自托管诊断面板”（前端）：展示后端连接状态、可选服务状态（含 recovery_hint）、常见故障处理建议。
- 文档化数据位置与备份/恢复路径：SQLite/Chroma/上传文件/配置的最小备份集，以及恢复步骤与风险提示。
- 强化 deployments 文档的“核心 + 可选 overlays”说明：每个 overlay 的启用条件、验收步骤、常见失败原因与修复方式。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `delivery-and-deployment`: 增加自托管诊断入口、备份恢复与 overlays 排障的交付要求。

## Impact

- Frontend: 新增诊断视图/面板（复用 `/health/dependencies`），并在 Workspace 提供可发现入口。
- Docs: `deployments/README.md`、docs 的 deployment/configuration 增补 runbook 与备份恢复章节。
- CI: 可扩展 composition smoke 覆盖更多 overlay 情景（不要求一次完成）。
