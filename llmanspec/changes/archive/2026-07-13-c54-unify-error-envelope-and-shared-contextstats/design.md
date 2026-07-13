# Design — c54-unify-error-envelope-and-shared-contextstats

## 决策

### D1. 错误 helper 的形态：set + return，而非 throw

**选择**：helper 签名 `sendError(set, status, code, message, details?): ErrorEnvelope` —— 设置 `set.status` 并返回 envelope 对象，router 直接 `return sendError(...)`。

**否决**：throw 一个 `HttpError` + 全局 onError 兜底。

- 理由：现有代码大量用 `return { error: ... }` 模式（非 throw）；throw 改造面更大且改变控制流。helper 保持 `return` 风格与现有代码一致，机械替换风险最低。
- 全局 onError 仍会加（task 3.5），但只兜底真正的 thrown Error（NotFoundError 等），不强制改造所有错误分支。

### D2. error_code 集中映射表 vs 各 router 自定义

**选择**：集中常量 + status 默认映射。helper 接受 `code: ErrorCode`（联合字符串字面量），并提供 `code → default status` 表；router 可传 `status` 覆盖。

```ts
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SCHEMA_VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  MODEL_ERROR: 503,
  FORBIDDEN: 403,
  // ...
};
```

**否决**：每个错误调用都传 status + code 两个参数。

- 理由：重复且易错（code 与 status 不匹配）。集中表保证一致性，router 只需声明语义化 code。

### D3. 语义化 details 的保留

现有 ad-hoc 形状里有些携带语义化字段（`existing_tag_id`、`max_bytes`/`uploaded_bytes`、`reason`）。这些**不能丢**（前端依赖）。

**选择**：这些字段统一放进 `details: Record<string, unknown>`。

- 例：`sendError(set, 'CONFLICT', '标签名已存在', { existing_tag_id })`
- 例：`sendError(set, 'PAYLOAD_TOO_LARGE', '文件过大', { max_bytes, uploaded_bytes })`
- 前端从 `response.details.existing_tag_id` 读取（迁移路径，c14 前端清理时核对）。

### D4. ContextStats 用 Zod 还是纯 interface

**选择**：Zod schema + `z.infer` 派生 type（与项目 Zod SSOT 一致）。

- 定义在 `packages/shared/src/schemas/qa.ts`（新建或并入现有 qa schema 文件）。
- 字段对齐 v1：`total_tokens/system_tokens/history_tokens/retrieval_tokens/query_tokens/max_tokens/compressed: boolean`。

### D5. 迁移边界与回滚

- 本变更**不删**任何端点，不改成功路径响应形状，仅规范化错误响应。
- 字段名 `error` → `message` 是收紧：前端若有硬编码 `.error` 解析需同步改（task 3.x 改造时 grep `apps/web` 核对，残留留 c14）。
- 回滚：revert 单 commit 即可（无 schema 迁移、无数据迁移）。

## 验证策略

- 新增 `apps/server/test/shared/errors.test.ts`：helper 形状 + status 映射。
- grep 门禁：`grep -rn "{ error:" apps/server/src/features/` 应为空（task 4.5）。
- 全量 `bun test` 回归（现有 209 测试不应有新增失败；错误体字段断言若有需同步改）。
