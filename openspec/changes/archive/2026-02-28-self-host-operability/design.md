## Context

后端已提供 `/health` 与 `/health/dependencies`（含 optional services 状态与 recovery_hint），部署形态采用“core + optional overlays”的组合模型（justfile 支持 dev compose）。但这些信息目前主要停留在工程层面，缺少：
- 前端可发现的诊断入口（减少用户查日志/猜测）。
- 文档化的 runbook（常见失败→怎么确认→怎么修复）。
- 数据备份/恢复的最小闭环说明。

## Goals / Non-Goals

**Goals:**
- 让自托管用户在 UI 内完成 80% 的“为什么不能用/怎么修复”判断。
- 明确数据资产的边界与迁移路径，降低用户对“数据丢失”的顾虑。
- 保持安全：诊断信息脱敏，不泄露 secrets。

**Non-Goals:**
- 不引入 SaaS 运维体系（多租户/计费/灰度）。
- 不在本变更中增加复杂的备份工具链（优先文档 + 最小脚本）。

## Decisions

- **诊断数据源**：优先复用 `/health/dependencies`，必要时再考虑增加版本化诊断端点（避免一次性扩大 API 面）。
- **脱敏策略**：UI 展示“是否配置/是否可用/如何修复”，不展示 raw token/API key，不回显完整连接串。
- **备份最小集合**：以“可恢复工作区”的最小文件/卷为准（DB + 向量库 + 配置），文档中明确可选项与风险。

## Risks / Trade-offs

- [不同部署方式导致数据路径不一致] → 在文档中按 compose/本地开发两套路径分别说明，并提供验证命令。
- [诊断面板信息过载] → 默认只显示关键状态与建议，提供“展开详情”查看原始字段（脱敏）。

## Migration Plan

- 无数据迁移。
- 先上线诊断面板与文档，再逐步强化 smoke regression 覆盖。
