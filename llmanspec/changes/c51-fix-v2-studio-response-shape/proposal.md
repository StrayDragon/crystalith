---
depends_on: []
batch: all
---

# c51-fix-v2-studio-response-shape — Studio 响应字段 + SSE done/toolcall + output 同步 + stale 清理

## Why

2026-07-12 第四轮深度复核发现 studio 域存在 **5 个 P1**（c32/c23/c43 端点齐全，但响应字段与 SSE 事件契约多处偏离 v1）。

### P1-1 — serializeSlide 丢 output_id 与 generation_config

- **v1** (`api.py:76-94` `SlideDraftRead`): 含 `output_id` 与 `generation_config`。
- **v2** (`router.ts:51-67` `serializeSlide`): 两者都缺。前端读 `output_id` 做 slide→output 跳转、读 `generation_config` 复用配置时会拿到 `undefined`。

### P1-2 — SSE done payload 错 + 缺 trace_id

- **v1** (`api.py:428,538`): `done_payload = {"trace_id": trace_id, "slide_id": slide.id}`；且所有 SSE 事件都带 trace_id。
- **v2** (`router.ts:218,240`): `emit('done', serializeSlide(...))` 直接序列化整个 slide；且**所有事件都无 trace_id**。可观测性/关联回归。

### P1-3 — SSE 缺 toolcall 事件

- **v1** (`api.py:401,506`): outline/markdown 各阶段前发 `toolcall` 事件（`slides_generate_outline`/`slides_generate_markdown`）。
- **v2**: 完全不发 toolcall。前端依赖此事件做工具调用展示/埋点会缺失。

### P1-4 — syncSlideOutput 不写 outputId FK + content schema 错

- **v1** (`api.py:194-229` `_sync_output`): content={title, engine, outline, markdown, slide_id}，且通过 `slide.output_id` 外键关联。
- **v2** (`service.ts:133-157`): content={title, markdown, stage:'markdown'}（缺 engine/outline/slide_id），且用 `prompt='studio:<id>'` 匹配而非 FK。**`studioSlides.outputId` 列（schema.ts:361）v2 从不写入，恒为 null**——任何依赖 slide→output join 的 UI/查询失效。

### P1-5 — stale-RUNNING 清理设了 errorMessage

- **v1** (`api.py:107-118`): 设 status=IDLE、**error_message=None**、返回 bool。
- **v2** (`service.ts:105-118`): 设 `errorMessage='stale running status cleared'`（非空字符串）。stale 清理后的 slide 在 v2 显示错误信息而 v1 不显示。

## What Changes

1. **serializeSlide 补字段**: 返回 `output_id`（含 null）与 `generation_config`，对齐 v1 SlideDraftRead。
2. **SSE done payload 改 {trace_id, slide_id}**: 所有 SSE 事件携带 trace_id，对齐 v1。
3. **SSE toolcall 事件**: outline/markdown 各阶段前发 toolcall。
4. **syncSlideOutput 写 FK + 完整 content**: 写 `studioSlides.outputId`；content={title, engine, outline, markdown, slide_id}。
5. **stale 清理清空 errorMessage**: 设 null 而非字符串；返回 bool。

## Capabilities

- `studio-slides-workflow`（spec delta: serializeSlide 字段 + SSE done/trace_id + toolcall 事件）
- `studio-output-types`（spec delta: output sync FK + content schema + stale 清理）

## Impact

- **前端字段可用**: output_id/generation_config 不再 undefined。
- **SSE 可观测**: done payload 轻量 + trace_id 贯穿。
- **slide→output join 可用**: outputId FK 被写入。
- **stale 清理干净**: 不再误显错误信息。
- **无 BREAKING**: 端点路径不变；新增字段；SSE done payload 收敛到 v1 契约（v1 是 SSOT）。
