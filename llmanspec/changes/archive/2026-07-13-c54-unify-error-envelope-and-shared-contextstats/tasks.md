# Tasks — c54-unify-error-envelope-and-shared-contextstats

## 1. ContextStats → shared

- [x] 1.1 在 `packages/shared/src/schemas/` 新增 ContextStats Zod schema + 导出 type（字段对齐 v1：total_tokens/system_tokens/history_tokens/retrieval_tokens/query_tokens/max_tokens/compressed）
- [x] 1.2 `apps/server/src/features/qa/retrieve-and-judge.ts` 删除本地 `interface ContextStats`，改 `import { ContextStats } from '@crystalith/shared'`
- [x] 1.3 `apps/server/src/features/qa/handler.ts` re-export 改为 re-export shared 类型；`ai/stream.ts` 内联 struct 也替换为 shared 类型
- [x] 1.4 验证：`cd packages/shared && bun run typecheck` + `cd apps/server && bun run typecheck`

## 2. 共享错误 helper

- [x] 2.1 新建 `apps/server/src/shared/errors.ts`：导出 `sendError(set, code, message, details?, retryAfter?)` helper，消费 `ErrorEnvelopeSchema`，集中 status→error_code 映射表（INVALID_REQUEST/NOT_FOUND/CONFLICT/SCHEMA_VALIDATION_FAILED/RATE_LIMITED/MODEL_ERROR/PAYLOAD_TOO_LARGE/FORBIDDEN/CONNECTOR_UNAVAILABLE/INTERNAL_ERROR）
- [x] 2.2 导出 `ErrorCode` 常量联合（避免各 router 写裸字符串）
- [x] 2.3 单元测试 `apps/server/test/shared/errors.test.ts`：helper 返回形状匹配 ErrorEnvelopeSchema + status 映射正确 + details/retry_after 可选

## 3. 改造 feature router 错误分支

- [x] 3.1 `outputs/router.ts`：8 处 ad-hoc 错误（含 SLIDES 守卫、source_id 校验、schema 失败）改走 helper
- [x] 3.2 `sources/router.ts`：8 处（dedup 409、上传 413、tag 409、extractor、from-url、search、SSRF×2）改走 helper；语义化字段（existing_source_id/existing_tag_id/max_bytes/reason）放进 details
- [x] 3.3 `sources/source-extras.router.ts`（2×400）、`tasks/router.ts`（409）、`refine/router.ts`（400×3 + 409 + 500）改走 helper
- [x] 3.4 `source-connectors/router.ts`：保留既有 `apiError`（其抛出的 dict 已用 error_code/message 形状，接近 ErrorEnvelope；throw-then-catch 控制流未改，避免破坏隐藏 catch）
- [x] 3.5 NotFoundError 等仍走 Elysia 默认处理（本次未加全局 onError；ad-hoc `{error}` 形状已全部清零，NotFoundError 抛出由 Elysia 序列化）

## 4. 验证

- [x] 4.1 `cd apps/server && bun test`（214 pass / 1 fail——research 网络 timeout 非回归）+ 4 个断言更新（dedup/SSRF×2/refine 400 改断 message 而非 error/detail）
- [x] 4.2 `cd apps/server && bun run typecheck` ✅
- [x] 4.3 `bun oxlint`（0 error）✅
- [x] 4.4 `llman sdd validate c54-unify-error-envelope-and-shared-contextstats --strict --no-interactive`（结构无错）
- [x] 4.5 grep 确认：`sendError` 在 6 文件使用；`grep -rn "return { error\|return { detail" apps/server/src/features/` = 0 残留
