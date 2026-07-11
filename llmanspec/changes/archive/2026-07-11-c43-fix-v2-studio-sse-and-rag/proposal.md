---
depends_on: [c23-fix-v2-studio-and-analysis]
batch: all
---

# c43-fix-v2-studio-sse-and-rag — Studio SSE 流式 + RAG 检索对齐

## Why

c32 标 DONE（落盘修复），但 2026-07-11 第三轮复核发现 studio 仍是 v2 内部最大的质量异常：生成端点从 v1 的 SSE 流改成了 JSON 同步返回，且 `getContext()` 绕过了 v2 自己的 ragRegistry。存在 2 个 P0 + 7 个 P1：

- **outline/markdown 非流式** [P0]: v1 `studio/api.py:353-560` 用 `GET /drafts/{id}/outline/stream` 和 `/markdown/stream` 返回 SSE，发 `progress`/`toolcall`/`busy`/`done`/`error` 事件。v2 `studio/router.ts:268,338` 改为 `POST` 返回 JSON，SSE 契约完全丢失。前端进度 UX 不可用。
- **getContext 绕过 ragRegistry** [P0]: v2 `studio/router.ts:126-142` 直接 join chunks+sources 然后 `.slice(0,6000)` 原始文本。v1 走 `retrieve_context`（embed→KNN→fusion→diversity→token budget）。v2 其它域（qa/outputs/refine）都用 ragRegistry，唯独 studio 不用——内部不一致。
- **缺 drafts/latest 端点** [P1]: v1 `api.py:232-247` 有 `GET /drafts/latest`。v2 无。
- **缺 stale-RUNNING 清理** [P1]: v1 `api.py:51,107-118` 有 `SLIDE_RUNNING_STALE_AFTER=10min`，并发生成有 busy 守卫。v2 无。
- **preview 文件未写** [P1]: v1 `storage.py:57-66` 除 per-slide 文件外还写全局 `data/output/preview/slides.md`。v2 仅写 per-slide。
- **generation_config 存而不用** [P1]: v1 `generator.py:202-290` 解释 quantity/density/audience/tone/structure/language。v2 `router.ts:193` 存为 `Record<string,unknown>` 但生成时只读 theme_preset。
- **theme presets 内容偏离** [P1]: v2 `theme-presets.ts:13-55` 的 theme 值/font/colorSchema 与 v1 `config.py:74-123` 不同，渲染不同 Slidev 输出。
- **frontmatter 非确定性** [P1]: v1 `generator.py:150-170` 确定性 strip LLM frontmatter 后 apply preset。v2 `router.ts:360-368` 把 frontmatter 写进 system prompt 让 LLM 自己生成——可能泄漏。
- **缺 fallback outline/markdown** [P1]: v1 生成失败有 fallback。v2 `router.ts:304` 直接 throw + status=error。

## What Changes

1. **outline/markdown 改回 SSE**: 新增 `GET /studio/slides/:id/outline/stream` 和 `/markdown/stream`，发 `progress`/`toolcall`/`busy`/`done`/`error` 事件；保留现有 POST 作为非流式别名（或移除，取决于前端契约）
2. **getContext 接入 ragRegistry**: 替换 slice 6000 为 `ragRegistry.retrieveWith('embed', {notebookId, sourceIds, topK, minScore})`
3. **drafts/latest 端点**: 按 updated_at desc 取最新
4. **stale-RUNNING 清理**: 10min 阈值清理 + busy 守卫
5. **preview 文件写入**: 除 per-slide 外写全局 preview
6. **generation_config 解释**: quantity/density/audience/tone/structure/language 注入 prompt
7. **theme presets 对齐 v1**: theme/font/colorSchema 对齐 `config.py:74-123`
8. **frontmatter 确定性 strip+apply**: 移除 system prompt 中的 frontmatter 指令，改为确定性 strip+apply
9. **fallback outline/markdown**: 生成失败时产出 fallback 内容

## Capabilities

- studio-slides-workflow（spec delta: SSE 流式事件契约 + drafts/latest + stale 清理）
- retrieval-and-cache（spec delta: studio 检索必须走统一 ragRegistry 而非原始文本 slice）

## Impact

- studio 生成端点从 JSON 改为 SSE（BREAKING v2 内部）；前端需适配 SSE consumer
- studio 检索质量显著提升（接入 embed/fusion/diversity）
- theme 渲染输出变化（对齐 v1）
