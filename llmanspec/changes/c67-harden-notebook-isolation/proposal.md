---
depends_on: []
---

## Why

单用户本地场景下，部分全局 id 端点（sources / outputs / research / studio slides / tasks / citations）的 `notebookId` 为可选或缺失校验，省略时可按全局 id 读取甚至列举跨 notebook 资源。这与「notebook 为资源边界」的产品模型不一致，也会在后续 c13 鉴权落地时放大枚举与误访问风险。

同时，部分业务错误仍 `throw new Error` 或用 `NotFoundError` 伪装乐观锁/状态机冲突，破坏统一 `ErrorEnvelope` 与 409/400 语义。

## What Changes

- **归属硬化（BREAKING 对未传参调用）**：对跨 notebook 有风险的读取/变更端点，`notebookId` MUST 为必填（query 或 path）；跨本访问 MUST 返回 `404 NOT_FOUND`（不泄露资源是否存在）。
- **禁止全表列举**：`GET /v2/research` 等列表在缺省 notebook 范围时 MUST NOT 返回全部 session。
- **错误信封补齐**：业务状态机非法与乐观锁冲突 MUST 走 `AppHttpError`（`400 INVALID_REQUEST` / `409 CONFLICT`），MUST NOT 用裸 `Error` 或 `NotFoundError` 伪装。
- **前端同批传参**：`useOutputQueue`、`evidenceExport`、research/slides 单资源调用 MUST 携带所属 `notebookId`。
- **非目标**：不做路径嵌套 BREAKING 迁移（留给后续 phase）；不实现 c13 auth。

## Capabilities

- `workspace-api-contract`
- `frontend-eden-migration`（若无对应 requirement 则仅 tasks 覆盖前端传参）

## Impact

- Server routers：`sources`、`outputs`、`research`、`studio`、`tasks`、`citations`、`sessions`（乐观锁）
- Shared Zod query schemas（`notebookId` 必填）
- Web：`useOutputQueue`、`evidenceExport`、`useResearch`、`useSlidesStudioDialog` 等
- 测试：server 集成测试覆盖跨 notebook 拒绝；相关 web 单测更新
- **BREAKING**：原先省略 `notebookId` 仍能命中资源的客户端调用将变为 400/404
