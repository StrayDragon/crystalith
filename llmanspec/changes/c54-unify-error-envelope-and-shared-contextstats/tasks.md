# Tasks — c54-unify-error-envelope-and-shared-contextstats

## 1. ContextStats → shared

- [ ] 1.1 在 `packages/shared/src/schemas/` 新增 ContextStats Zod schema + 导出 type（字段对齐 v1：total_tokens/system_tokens/history_tokens/retrieval_tokens/query_tokens/max_tokens/compressed）
- [ ] 1.2 `apps/server/src/features/qa/retrieve-and-judge.ts` 删除本地 `interface ContextStats`，改 `import { ContextStats } from '@crystalith/shared'`
- [ ] 1.3 `apps/server/src/features/qa/handler.ts` re-export 改为 re-export shared 类型
- [ ] 1.4 验证：`cd packages/shared && bun run typecheck` + `cd apps/server && bun run typecheck`

## 2. 共享错误 helper

- [ ] 2.1 新建 `apps/server/src/shared/errors.ts`：导出 `sendError(set, status, code, message, details?)` helper，消费 `ErrorEnvelopeSchema`，集中 status→error_code 映射表（INVALID_REQUEST/NOT_FOUND/CONFLICT/SCHEMA_VALIDATION_FAILED/RATE_LIMITED/MODEL_ERROR/PAYLOAD_TOO_LARGE/FORBIDDEN）
- [ ] 2.2 导出常用 error_code 常量（避免各 router 写裸字符串）
- [ ] 2.3 单元测试：helper 返回形状匹配 ErrorEnvelopeSchema + status 映射正确

## 3. 改造 feature router 错误分支

- [ ] 3.1 `outputs/router.ts`：~8 处 ad-hoc 错误（含 SLIDES 守卫、source_id 校验、schema 失败）改走 helper
- [ ] 3.2 `sources/router.ts`：~8 处（dedup 409、上传 413、tag 409、extractor、from-url、search）改走 helper；保留语义化 details（existing_tag_id/max_bytes/reason 放进 details）
- [ ] 3.3 `qa/router.ts`、`research/router.ts`、`studio/router.ts`、`analysis/router.ts`：错误分支改走 helper
- [ ] 3.4 `sessions/router.ts`、`messages/router.ts`、`notebooks/router.ts`、`citations/router.ts`、`tasks/router.ts`、`models/router.ts`、`workspace/router.ts`、`refine/router.ts`、`source-connectors/router.ts`：错误分支改走 helper
- [ ] 3.5 NotFoundError 等 thrown Error 的全局 onError handler（server.ts）统一兜底为 ErrorEnvelope

## 4. 验证

- [ ] 4.1 `cd apps/server && bun test`（新增错误信封一致性测试 + 全量回归）
- [ ] 4.2 `cd apps/server && bun run typecheck`
- [ ] 4.3 `bun oxlint`（0 error）
- [ ] 4.4 `llman sdd validate c54-unify-error-envelope-and-shared-contextstats --strict --no-interactive`
- [ ] 4.5 grep 确认：`grep -rln "ErrorEnvelope\|sendError" apps/server/src/` 有 helper + 至少一处使用；`grep -rn "{ error:" apps/server/src/features/` 无残留 ad-hoc 形状
