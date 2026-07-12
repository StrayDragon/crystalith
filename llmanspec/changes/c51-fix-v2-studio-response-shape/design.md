# c51-fix-v2-studio-response-shape — Design

## 关键决策

### D1: serializeSlide 补字段

直接加 `output_id: row.outputId ?? null` 与 `generation_config: row.generationConfig ?? null`，对齐 v1 SlideDraftRead。无 breaking（纯新增字段）。

### D2: SSE done payload 收敛到 v1

done payload 从 `serializeSlide(...)` 改为 `{trace_id, slide_id}`（对齐 v1 `api.py:428,538`）。trace_id：复用现有 request id 或生成 UUID，贯穿所有 SSE 事件（progress/done/error/busy）。

### D3: toolcall 事件

在 outline/markdown 生成阶段调用前 emit `toolcall` 事件，payload 含工具名（slides_generate_outline / slides_generate_markdown，对齐 v1 `api.py:401,506`）。

### D4: syncSlideOutput 写 FK + 完整 content

- 写 `studioSlides.outputId`（当前从不写，列恒 null）。
- content 改为 {title, engine, outline, markdown, slide_id}（对齐 v1 `_sync_output`）。
- 放弃用 prompt='studio:<id>' 匹配 output，改用 FK 关联。
- 需确认：PUT markdown / POST markdown / SSE markdown/stream 三处调用点都更新。

### D5: stale 清理清空 errorMessage

`clearStaleRunning` 设 `errorMessage = null`（非字符串），对齐 v1。返回 bool 表示是否清理了。

## 迁移与回滚

- syncSlideOutput 改 FK 关联：需数据校验（已有 slide 行的 outputId 迁移填充？当前为 null，新建/更新时写入；历史 null 保留，不回填）。
- 无 DB schema 变更（outputId 列已存在）。
- 回滚 = git revert。
