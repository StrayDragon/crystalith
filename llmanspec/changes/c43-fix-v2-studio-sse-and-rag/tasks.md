# fix-v2-studio-sse-and-rag — Tasks

## 1. SSE 流式生成端点

- [x] `features/studio/router.ts`: 新增 GET /studio/slides/:id/outline/stream — SSE 发 progress/busy/done/error
- [x] `features/studio/router.ts`: 新增 GET /studio/slides/:id/markdown/stream — SSE 同上
- [x] 现有 POST outline/markdown 保留为非流式别名
- [ ] 前端 `apps/web` studio consumer 适配 SSE（后续前端迁移）

## 2. getContext 接入 ragRegistry

- [x] `features/studio/router.ts`: getContext 优先 ragRegistry.retrieveWith，RAG 不可用时 fallback 直接查询
- [x] 删除原始 join chunks+sources + slice 6000 代码

## 3. drafts/latest 端点

- [x] `features/studio/router.ts`: GET /studio/slides/latest — 按 updatedAt desc 取最新

## 4. stale-RUNNING 清理

- [x] `features/studio/router.ts`: clearStaleRunningStatus（10min 阈值）+ busy 守卫

## 5. preview 文件写入

- [x] `features/studio/router.ts`: writeSlideFile 同时写全局 preview 文件 slides/preview/slides.md

## 6. generation_config 解释

- [x] `features/studio/router.ts`: buildConfigHints 读 quantity/density/audience/tone/structure/language 注入 prompt

## 7. theme presets 对齐 v1

- [x] 已有 theme-presets.ts 覆盖 6 preset（minimal-clean/business-brief/product-launch/research-paper/data-insight/creative-visual）

## 8. frontmatter 确定性 strip+apply

- [x] `features/studio/router.ts`: stripFrontmatter + applyFrontmatter（确定性，非 LLM 生成）
- [x] 移除 system prompt 中的 frontmatter 指令

## 9. fallback outline/markdown

- [x] `features/studio/router.ts`: SSE 端点生成失败时产出 fallback（POST 端点保持 throw）

## Verification

```bash
cd apps/server && bun typecheck  # ✅ pass
cd apps/server && bun test       # ✅ 209 pass / 2 fail (network timeout, no regression)
```
