## Context

- 后端/前端/SDK/配置 schema 都存在生成或一致性约束：OpenAPI schema、前端生成客户端、Python SDK、`config/app.schema.json`、以及后端模块分层导入规则。
- CI 已覆盖 OpenAPI 与前端生成客户端一致性，但本地开发流与 pre-commit 对 check-imports/config-schema 覆盖不足，导致“提交后才发现 drift”。

## Goals / Non-Goals

**Goals:**
- 提供统一的本地入口（`just check`/`just verify`）让开发者一次性跑完关键 guardrails。
- 在 CI 增加缺失的 guardrails（至少 check-imports 与 config schema 一致性），形成 PR 级别的硬门槛。
- 在 pre-commit 中对相关路径变更触发 fast checks，尽量在提交前暴露 drift。

**Non-Goals:**
- 不把“全量测试/构建”强制塞进每次 commit（避免过慢）；通过分层（fast checks vs full checks）控制成本。

## Decisions

### 1) 将 guardrails 分为 fast checks 与 full checks
**Decision:** 提供两个入口：
- `just check`（fast）：import 分层、config schema 一致性、OpenAPI schema check、前端生成客户端一致性（无构建）
- `just test`（full）：沿用现有 test 目标（后端 pytest + 前端 vitest/build/typecheck）

**Rationale:** 在保持提交体验的同时，最大化提前发现 drift 的概率。

### 2) config schema 一致性用“生成后 git diff”校验
**Decision:** 在 CI（及可选本地）运行 schema 生成命令，然后用 `git diff --exit-code` 验证没有未提交变更。

**Rationale:** 简单、可移植、与 OpenAPI/前端生成客户端的校验方式一致；无需额外引入复杂的 check 脚本。

### 3) pre-commit 按路径触发
**Decision:** 在 `.pre-commit-config.yaml` 中新增 local hooks：
- 修改后端 Python 代码时运行 `check-imports`
- 修改 Settings/config 相关文件时运行 config schema consistency check
- 修改 OpenAPI 相关后端代码时运行现有 api-schema-check（已存在）

**Rationale:** 避免每次 commit 都跑重检查，但保证相关变更不会漏检。

## Risks / Trade-offs

- **[风险]** CI 多跑几步增加耗时 → **缓解**：检查本身应很快；并可与现有 job 并行/缓存。
- **[风险]** config schema 生成在 CI 中会修改工作区文件 → **缓解**：通过 `git diff --exit-code` 明确失败原因；保持生成确定性。

## Migration Plan

1. 增加 `just check` 与 CI steps（先落地 CI，确保 PR 不漂移）。
2. 增加 pre-commit hooks（可选：先以 warning/手动启用方式发布，再转为默认）。

## Open Questions

- 是否需要为 `just check` 提供一个 `--fast/--full` 参数（或拆成多个明确子任务）以便团队按需组合？
