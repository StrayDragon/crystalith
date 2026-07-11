# fix-v2-studio-sse-and-rag — Tasks

## 1. SSE 流式生成端点

- [ ] `features/studio/router.ts`: 新增 GET /studio/slides/:id/outline/stream — SSE 发 progress/toolcall/busy/done/error
- [ ] `features/studio/router.ts`: 新增 GET /studio/slides/:id/markdown/stream — SSE 同上
- [ ] `features/studio/router.ts`: 现有 POST outline/markdown 保留为非流式别名或标记 deprecated
- [ ] 前端 `apps/web` studio consumer 适配 SSE（如需要）

## 2. getContext 接入 ragRegistry

- [ ] `features/studio/router.ts`: 替换 getContext 的 slice 6000 逻辑为 ragRegistry.retrieveWith('embed', {notebookId, sourceIds, topK, minScore})
- [ ] 删除原始 join chunks+sources + slice 代码

## 3. drafts/latest 端点

- [ ] `features/studio/router.ts`: GET /studio/slides/latest — 按 updated_at desc 取最新（需 notebook_id query）

## 4. stale-RUNNING 清理

- [ ] `features/studio/router.ts`: 实现 clearStaleRunningStatus（10min 阈值）
- [ ] 生成前检查 RUNNING 状态，若 stale 则清理；若 active 则返回 busy

## 5. preview 文件写入

- [ ] `features/studio/router.ts`: writeSlideFile 同时写全局 preview 文件（data/output/preview/slides.md 或等价路径）

## 6. generation_config 解释

- [ ] `features/studio/router.ts`: 从 generation_config 读 quantity/density/audience/tone/structure/language 注入 prompt

## 7. theme presets 对齐 v1

- [ ] `features/studio/theme-presets.ts`: 对齐 v1 config.py:74-123 的 theme/font/colorSchema/class

## 8. frontmatter 确定性 strip+apply

- [ ] `features/studio/router.ts`: 移除 system prompt 中的 frontmatter 指令
- [ ] 实现 stripFrontmatter + applyFrontmatter（确定性，非 LLM 生成）

## 9. fallback outline/markdown

- [ ] `features/studio/router.ts`: 生成失败时产出 fallback outline/markdown 而非 throw

## Verification

```bash
cd apps/server && bun test features/studio
# SSE 端点返回 progress/done 事件
# getContext 调用 ragRegistry（可通过日志或 mock 验证）
# drafts/latest 返回最新 draft
# stale RUNNING 被清理
```
