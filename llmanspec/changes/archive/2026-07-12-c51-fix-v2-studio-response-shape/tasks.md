# fix-v2-studio-response-shape — Tasks

## 1. serializeSlide 补 output_id + generation_config (P1)

- [x] `features/studio/router.ts` serializeSlide: 返回 `output_id`（row.outputId ?? null）与 `generation_config`（row.generationConfig ?? null），对齐 v1 SlideDraftRead (api.py:76-94)

## 2. SSE done payload 改 {trace_id, slide_id} + 全事件带 trace_id (P1)

- [x] `features/studio/service.ts` createSseResponse: 生成 trace_id（crypto.randomUUID）；所有事件 payload 注入 trace_id
- [x] 新增 SseContext 类型（trace_id + slide_id）；run 回调签名加 ctx
- [x] `features/studio/router.ts` outline/stream + markdown/stream: done payload 改 `{trace_id, slide_id}`（对齐 v1 api.py:428,538）

## 3. SSE toolcall 事件 (P1)

- [x] `features/studio/router.ts` outline/stream: 生成前 emit `toolcall` {tool: 'slides_generate_outline'}（对齐 v1 api.py:401）
- [x] markdown/stream: 生成前 emit `toolcall` {tool: 'slides_generate_markdown'}（对齐 v1 api.py:506）

## 4. syncSlideOutput 写 FK + 完整 content (P1)

- [x] `features/studio/service.ts` syncSlideOutput: 写 studioSlides.outputId 外键（列已存在但 v2 从不写入）
- [x] content 改 {title, engine, outline, markdown, slide_id}（对齐 v1 _sync_output api.py:194-229）
- [x] 兼容 pre-c51 数据：无 outputId 时按 prompt='studio:<id>' 回退查找

## 5. stale 清理清空 errorMessage (P1)

- [x] `features/studio/service.ts` clearStaleRunning: 设 errorMessage=null（非 'stale running status cleared'），对齐 v1 api.py:107-118

## Verification

```bash
cd apps/server && bun typecheck    # ✅ pass
cd apps/server && bun test         # ✅ 209 pass / 2 fail（research 网络 + URL 超时，非回归，与基线一致）
cd apps/server && bun test test/studio/  # ✅ 5 pass / 0 fail
```

人工：

- serializeSlide 含 output_id/generation_config
- SSE done 为 {trace_id, slide_id}，全事件带 trace_id
- toolcall 事件在 outline/markdown 阶段前发出
- studioSlides.outputId 被写入；content 含 engine/outline/markdown/slide_id
- stale 清理后 errorMessage 为空
