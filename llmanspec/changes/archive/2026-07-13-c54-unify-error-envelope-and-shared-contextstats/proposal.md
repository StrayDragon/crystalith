---
depends_on: []
batch: all
---

# c54-unify-error-envelope-and-shared-contextstats — 错误信封统一执行 + ContextStats 迁移到 shared

## Why

2026-07-13 代码审计发现两个**违反 spec-defined MUST** 的债务，跨 7 个 feature router + 1 个类型定义。两者都是「规范已正确写明但实现未执行」的伪对齐：

### 错误信封：5+ 种 ad-hoc 形状，零处使用 ErrorEnvelopeSchema

- **Spec 已要求**：`workspace-api-contract r3` —— "非 SSE 错误响应 MUST 使用统一结构：`error_code`, `message`, `details?`, `retry_after?`"。
- **Schema 已定义**：`packages/shared/src/schemas/common.ts:21` 的 `ErrorEnvelopeSchema` 形状正确。
- **实现违反**：`grep ErrorEnvelope apps/server/src/` = **0 处使用**。各 router 返回至少 5 种 ad-hoc 形状：
  - `{ error: string, error_code: string }` — `outputs/router.ts:121-140, 149, 173, 177`
  - `{ error: string }`（无 error_code）— `outputs/router.ts:181, 184`、`sources/router.ts:359`
  - `{ error: string, max_bytes, uploaded_bytes }` — `sources/router.ts:248`
  - `{ error: string, reason }` — `sources/router.ts:679, 768`
  - `{ error: string, existing_tag_id }` — `sources/router.ts:370, 410`
- **字段名不一致**：规范用 `message`，实现全用 `error`。前端解析错误时无法用统一路径。

### ContextStats：server-local 定义违反 Zod SSOT 规则

- **项目规则**：`AGENTS.md:483` —— "❌ 在 packages/shared 之外重新定义类型"。
- **Spec 已要求**：`generation-core qa-context-stats-fields` —— ContextStats 字段名对齐 v1（c48 已对齐字段名）。
- **实现违反**：`ContextStats` 定义在 `apps/server/src/features/qa/retrieve-and-judge.ts:66`（server-local），未在 `packages/shared` 导出。前端要展示 token 预算信息时拿不到类型契约。

## What Changes

### 错误信封统一（workspace-api-contract）

1. 新增共享错误 helper（`apps/server/src/shared/errors.ts`）：消费 `ErrorEnvelopeSchema`，集中 HTTP 状态码 → error_code 映射（400→INVALID_REQUEST、404→NOT_FOUND、409→CONFLICT、422→SCHEMA_VALIDATION_FAILED、429→RATE_LIMITED、503→MODEL_ERROR、413→PAYLOAD_TOO_LARGE）。
2. 改造所有 feature router 的错误分支，统一走 helper：notebooks、sessions、messages、sources、qa、research、outputs、studio、analysis、refine、source-connectors、citations、tasks、models、workspace。
3. 统一 SSE 错误事件形状（保留现有 SSE error 事件，但非 SSE 路径全部对齐 ErrorEnvelope）。

### ContextStats → shared（generation-core）

1. 把 `ContextStats` interface（含 `compressed` 等字段）迁到 `packages/shared/src/schemas/`，用 Zod 定义 + 导出 type。
2. `apps/server/src/features/qa/retrieve-and-judge.ts` 改为从 `@crystalith/shared` 导入。
3. `apps/server/src/features/qa/handler.ts` 的 re-export 改为 re-export shared 类型。

## Capabilities

- `workspace-api-contract` — 新增 2 requirement（错误信封实际下发 + 共享 helper）
- `generation-core` — 新增 1 requirement（ContextStats 定义在 shared）

## Impact

- **用户可见契约改进**：所有错误响应形状一致，前端可用统一 `{error_code, message}` 解析；不引入 BREAKING（仅规范化已有但散乱的错误体）。
- **代码量**：+1 helper 模块，~15 router 错误分支改造（机械替换），ContextStats 迁移 ~10 行。
- **风险**：低。错误响应字段名从 `error` → `message` 是契约收紧；需确认前端无硬编码 `.error` 解析（c14 前端清理时一并核对）。
- **验证**：`bun test` + `bun typecheck` + 新增错误信封一致性测试。
