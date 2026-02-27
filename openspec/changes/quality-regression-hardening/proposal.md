## Why

- 仓库已具备较完整的 guardrails（分层检查、配置 schema 漂移、生成客户端漂移、compose smoke），但缺少统一的静态质量基线（Python lint / Frontend lint / API contract tests），随着规模增长会逐步积累维护债与回归风险。
- 目前的漂移检查主要覆盖“生成物一致性”，但不覆盖“语义契约稳定性”（例如关键响应字段/错误码/引用语义的回归）。

## What Changes

- 增加 Python lint 基线（ruff 或等价）与最小 CI gate（先增量、避免一次性全仓重写）。
- 增加前端 lint 基线（eslint/biome）并纳入 CI。
- 增加关键 API contract tests：对核心端点的响应形状、错误信封、citations/tool schemas 等做稳定断言，补齐“生成物一致性之外”的回归防线。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `quality-and-regression`: 增加 lint/contract checks 的质量门槛与本地/CI 一致的执行入口。

## Impact

- Dev tooling: 新增 lint 配置与 just 入口；CI 增加检查步骤。
- Backend/Frontend: 需要逐步清理或豁免现存 lint 问题（以最小侵入、可维护为目标）。
- Docs: 更新贡献指南与本地检查说明。
