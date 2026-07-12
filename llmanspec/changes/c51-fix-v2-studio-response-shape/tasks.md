# fix-v2-studio-response-shape — Tasks

## 1. serializeSlide 补 output_id + generation_config (P1)

- [ ] `features/studio/router.ts:51-67` serializeSlide: 返回 `output_id`（row.outputId，含 null）与 `generation_config`（row.generationConfig），对齐 v1 SlideDraftRead (api.py:76-94)
- [ ] 验证：前端读 slide.output_id 与 slide.generation_config 非 undefined

## 2. SSE done payload 改 {trace_id, slide_id} + 全事件带 trace_id (P1)

- [ ] `features/studio/router.ts:218,240`: done payload 改为 `{trace_id, slide_id}`（对齐 v1 api.py:428,538）
- [ ] 所有 SSE 事件（progress/done/error/busy）携带 trace_id
- [ ] 生成 trace_id（若无现有机制，用 crypto.randomUUID 或 request id）

## 3. SSE toolcall 事件 (P1)

- [ ] `features/studio/router.ts:206-242`: outline/markdown 各生成阶段前发 `toolcall` 事件（slides_generate_outline / slides_generate_markdown，对齐 v1 api.py:401,506）

## 4. syncSlideOutput 写 FK + 完整 content (P1)

- [ ] `features/studio/service.ts:133-157` syncSlideOutput: 写 `studioSlides.outputId` 外键（用新创建/匹配的 output.id）
- [ ] content 对齐 v1 _sync_output (api.py:194-229): {title, engine, outline, markdown, slide_id}
- [ ] 放弃用 prompt='studio:<id>' 匹配，改用 FK
- [ ] 验证：studioSlides.outputId 非null；slide→output join 可用

## 5. stale 清理清空 errorMessage (P1)

- [ ] `features/studio/service.ts:105-118` clearStaleRunning: 设 errorMessage=null（非 'stale running status cleared'），对齐 v1 api.py:107-118
- [ ] 返回 bool 表示是否清理了
- [ ] 验证：stale 清理后的 slide 无错误信息显示

## Verification

```bash
cd apps/server && bun typecheck   # MUST pass
cd apps/server && bun test        # studio 相关测试 MUST pass，无回归
```

人工：

- serializeSlide 含 output_id/generation_config
- SSE done 为 {trace_id, slide_id}，全事件带 trace_id
- toolcall 事件在 outline/markdown 阶段前发出
- studioSlides.outputId 被写入
- stale 清理后 errorMessage 为空
