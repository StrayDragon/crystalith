# Tasks — allow-low-similarity-qa

> Seam：`bun test apps/server/tests/qa/`（集成环境 + 真实 db + ragRegistry
> 注册假策略驱动 low_similarity / 正常接地两条路径）。

## T1 裁判放行

- [x] `retrieve-and-judge.ts`：`WEAK_GROUNDING_TIP` 常量；`JudgeResult`
      增加 `groundingNotice?: string`；Step 10 low_similarity 改为
      evidence=true 无接地放行 + groundingNotice；`reason` 仅在
      evidence=false 时设置；管线注释同步

## T2 流尾提示投递

- [x] `ai/stream.ts`：`StreamQaOptions.settleNotice?: string`——生成结束后
      emit `chunk` 并 append 进 accumulated（落库含提示）
- [x] `qa/handler.ts`：`settleNotice: judgment.groundingNotice` 透传

## T3 测试

- [x] 低相似度：假策略返回低分命中 → evidence=true、citations=[]、
      context=''、groundingNotice 有值、reason undefined
- [x] 高相似度对照：假策略返回高分命中 → 正常接地（context 非空、无 notice）
- [x] stream 层 settleNotice：由 typecheck + handler 透传覆盖；独立单测待 mock-model 基建（记录为已知缺口）

## T4 文档

- [x] docs/known-issues.md 或 proposal 记录行为变更点（QA 低相似度不再拒答）
