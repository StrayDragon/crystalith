---
depends_on: []
batch: all
---

# c63-adapt-frontend-v2-contracts — 前端适配 v2 服务端契约（notebook_id query / extractors / ErrorEnvelope / config_schema）

## Why

c57–c62 服务端变更后,前端需适配 3 类契约差异。经深度审计（Explore agent 逐文件排查 `apps/web/src/`）,实际需要改动的代码比预期少——extractors 新字段前端**已消费**（`ExtractorPolicyDialog.tsx` 已读 type/enabled/description/requires_service）,QA/research SSE **已用 /v2/**,studio **用非 SSE POST**。真正缺口集中在 sources `notebook_id` query 传递和 ErrorEnvelope 统一解析。

### 实现违反

1. **P0-A：sources 单 source 路由不传 `notebook_id` query**。c57 在服务端 4 个单 source 路由加了 `?notebook_id=` 归属校验,但前端 3 处调用点（`useSources.ts:492` removeSource、`:846` handleReembedSource、`SourceDetailDialog.tsx:143` fetchSourceChunks）不传此参数。服务端在 `notebook_id` 缺失时跳过校验（`nid && row.notebookId !== nid` 短路），导致归属校验**形同虚设**——任何用户可读/删/re-embed 任意 source。`notebookId` 已在每个调用点的闭包中（`useWorkspaceStore` `activeNotebookId`），修复成本极低。

2. **P1-B：ErrorEnvelope 解析逻辑散落且接在 dead client 上**。`api/setup.ts:81-144` 的共享错误拦截器配置在 **hey-api generated client**（v1,实际未用于 v2 调用）上。v2 用 eden treaty,调用点各自 inline cast `{ errorCode?, details?, message? }`（`useSources.ts:268-274,729-737`）——逻辑重复且无统一 helper。需抽取 `parseServerError(error)` 共享 helper 供 eden 调用点使用。

3. **P1-C：陈旧重复类型 `shared-types.ts:67-74`**。`ExtractorInfoResponse` 缺 `priority/display_name/requires_api_key/requires_service/recovery_hint` 等字段。实际调用用的是 `api/generated/types.gen.ts` 的完整版,这个重复类型纯属混淆,应删除。

4. **P2-D：SLIDES config_schema 未被前端消费**。c56 在 `workspace/tools` SLIDES tool 加了 `config_schema`（options/defaults）,但前端 slides 生成用硬编码 `SlideGenerationConfig`（`useOutputQueue.ts:53-67`）,未消费服务端 schema。`useRefine.ts:141` 的 `normalizeTool` 已读 `tool.config_schema`,但无 UI 渲染。这是可选增强（服务端驱动配置）,非 bug。

### 不需要改动（审计确认已对齐）

- **Extractors 响应新字段**：`ExtractorPolicyDialog.tsx:254-333` 已消费 type/enabled/description/requires_service/priority/display_name/requires_api_key/recovery_hint/plugin_id/error_code/message。**无需改动**。
- **QA SSE**：`useChat.ts:250` 已用 `/v2/qa/stream`,处理 chunk/state_snapshot/done 事件。**已对齐**。
- **Research SSE**：`useResearch.ts:467` 已用 `/v2/research/:id/stream`,处理 status/done/report 事件。**已对齐**。
- **Studio SSE**：`useOutputQueue.ts:77` 用非 SSE POST（`/studio/slides/:id/outline.post`）,注释明确"Replaces v1 EventSource streams"。`_postprocessed` flag 被安全忽略（前端只读 content）。**已对齐**。
- **OutputRead**：前端 `normalizeOutputPayload`（`shared/outputPayload.ts:129`）读 content 树;citations 在客户端从 content 收集（`StudioOutputsList.tsx:149`）。服务端 citation 树映射 + OutputRead 契约不破坏现有消费。**已对齐**。

## What Changes

### P0（安全/正确性,必须）
1. **`useSources.ts`** — `removeSource`（:492）和 `handleReembedSource`（:846）的 eden 调用加 `{ query: { notebook_id: activeNotebookId } }`。
2. **`SourceDetailDialog.tsx`** — `fetchSourceChunks` 签名加 `notebookId` 参数,eden 调用加 `{ query: { notebook_id: notebookId } }`（:143-146）。`notebookId` 已在 :156 可用。

### P1（一致性,建议）
3. **`api/shared-types.ts`** — 删除陈旧重复的 `ExtractorInfoResponse`（:67-74）,消除与 `api/generated` 完整版的混淆。
4. **新增 `api/parseServerError.ts`** — 抽取 eden 调用点的 inline `{ errorCode?, details?, message? }` cast 为共享 helper: `parseServerError(error): { errorCode?, message?, details?, status? }`。
5. **`useSources.ts`** — `:268-274` 和 `:729-737` 的 inline cast 改用 `parseServerError`。

### P2（可选增强,后置）
6. **（后置）studio config_schema 消费** — 若要服务端驱动 slides 配置,需新建组件渲染 `workspace/tools` SLIDES `config_schema` 的 options/defaults,替换 `useOutputQueue.ts:53-67` 的硬编码。标注为 future item,不在本 change 实现。

## Capabilities

- `frontend-eden-migration` — ADDED `frontend-sources-must-pass-notebook-id-query`（sources 单 source 调用 MUST 传 notebook_id）+ ADDED `frontend-error-envelope-must-use-shared-parser`（eden 调用 MUST 用共享 parseServerError）
- `workspace-ui-panels` — ADDED `frontend-extractor-types-must-not-duplicate`（MUST NOT 保留陈旧重复类型）

## Impact

- **BREAKING**: 无（纯前端内部改动,API 调用形状对服务端是加 query param）。
- **安全改进**: P0 修复归属校验绕过。
- **风险**: 低。P0 是加 query param;P1 是类型清理 + helper 抽取。
- **依赖**: 独立于 c13/c14;c57–c62 已完成。
- **工作量**: P0 约 3 行改动;P1 约 20 行（helper + 2 处替换 + 类型删除）;P2 后置。
