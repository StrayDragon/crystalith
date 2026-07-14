# c63 Design — 前端适配 v2 服务端契约

> 审计基础: Explore agent 逐文件排查 `apps/web/src/`,确认 extractors/SSE/OutputRead 已对齐,真正缺口在 sources notebook_id + ErrorEnvelope。

## 决策

### D1: notebook_id query 传递——eden treaty query API

eden treaty 的 query 传递语法:

```ts
// 删除 source
api.v2.sources({ id: sourceId }).delete({ query: { notebook_id: activeNotebookId } });
// re-embed
api.v2
  .sources({ id: sourceId })
  ['re-embed'].post(null, { query: { notebook_id: activeNotebookId } });
// chunks
api.v2.sources({ id: sourceId }).chunks.get({ query: { notebook_id: notebookId } });
```

`activeNotebookId` / `notebookId` 已在每个调用点的闭包中（`useWorkspaceStore((s) => s.activeNotebookId)`），无需额外 props 传递。

注意: POST 的 query 传递语法可能需要 `post(null, { query: {...} })` 或 `post({}, { query: {...} })`——eden treaty 对 POST+query 的处理需验证。若 treaty 不支持 POST query,改用 fetch（参考 `stream.ts` 模式）或服务端改为 path param。

### D2: parseServerError helper

```ts
// api/parseServerError.ts
export interface ParsedServerError {
  errorCode?: string;
  message: string;
  details?: Record<string, unknown>;
  status?: number;
}

export function parseServerError(error: unknown): ParsedServerError {
  if (!error || typeof error !== 'object') return { message: String(error) };
  const e = error as Record<string, unknown>;
  return {
    errorCode:
      typeof e.code === 'string'
        ? e.code
        : typeof e.errorCode === 'string'
          ? e.errorCode
          : undefined,
    message:
      typeof e.message === 'string'
        ? e.message
        : typeof e.detail === 'string'
          ? e.detail
          : 'Unknown error',
    details:
      typeof e.details === 'object' && e.details
        ? (e.details as Record<string, unknown>)
        : undefined,
    status: typeof e.status === 'number' ? e.status : undefined,
  };
}
```

替换 `useSources.ts:268-274` 和 `:729-737` 的 inline cast:

```ts
const { errorCode, details, message } = parseServerError(err);
if (errorCode === 'SOURCE_DEDUP_HIT') { ... }
```

### D3: 删除陈旧 ExtractorInfoResponse

`api/shared-types.ts:67-74` 的 `ExtractorInfoResponse` 只有 `id/name/type/enabled/available/description?`,缺 `priority/display_name/requires_api_key/requires_service/recovery_hint/plugin_id/error_code/message`。实际调用用 `api/generated/types.gen.ts` 的完整版（`useSources.ts:5-12` import）。这个重复类型无人引用（confirmed via grep），直接删除。

### D4: config_schema 后置

`useRefine.ts:141` 的 `normalizeTool` 已读 `tool.config_schema`,但无 UI 渲染 SLIDES options。`useOutputQueue.ts:53-67` 的 `SlideGenerationConfig` 是前端硬编码（preference/quantity/audience/structure/tone/language/density/theme_preset/frontmatter）。要消费服务端 config_schema 需新建配置面板组件——工作量较大且非 bug,标注 future.md 后置。

## 涉及文件

### 修改

- `apps/web/src/features/workspace/domains/sources/useSources.ts` — removeSource + handleReembedSource 加 query;inline cast 改 parseServerError
- `apps/web/src/features/workspace/domains/sources/SourceDetailDialog.tsx` — fetchSourceChunks 加 notebookId 参数 + query
- `apps/web/src/api/shared-types.ts` — 删除陈旧 ExtractorInfoResponse

### 新增

- `apps/web/src/api/parseServerError.ts` — 共享 error 解析 helper

### 后置（future.md）

- studio config_schema 消费组件（替换硬编码 SlideGenerationConfig）
