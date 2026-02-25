## Context

仓库已具备完整 guardrails 命令（`check-imports`、`config-schema-check`、`api-check`、前端 generated client diff 检查），但它们分散在 `check` 命令中；而开发者最常运行的 `just test` 默认不覆盖这些检查。

## Goals / Non-Goals

**Goals:**
- 让常用测试入口默认包含关键 guardrails，降低遗漏概率。
- 对现有命令结构做最小侵入改动，不引入新脚本。

**Non-Goals:**
- 不新增 CI job。
- 不改动 guardrails 的检查实现逻辑，仅调整命令编排顺序。

## Decisions

### 1) 后端 `just test` 前置 backend guardrails
**Decision:** 在 `backend/py/justfile` 中让 `test` 依赖 `check`（含 import layering 与 config schema consistency）。
**Rationale:** 与后端 CI 路径保持一致，减少“本地绿、CI 红”。

### 2) 仓库根 `just test` 前置 `just check`
**Decision:** 根 `justfile` 的 `test` 先执行 `check`，再跑 backend/frontend tests。
**Rationale:** 把 OpenAPI 与 generated client 一致性检查纳入默认测试习惯。

## Risks / Trade-offs

- **[风险]** 本地 `just test` 速度变慢 → **缓解**：保留 `test-backend`、`test-frontend`、`check` 子命令供按需单跑。
- **[风险]** 旧脚本依赖原 `just test` 行为 → **缓解**：改动仅增强前置检查，不改变原测试命令参数与输出格式。
