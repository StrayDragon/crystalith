# add-v2-pipeline-integration — Tasks

## Workstream A: Content Storage Layer

- [ ] 新建 `shared/storage.ts`: Storage 接口 + LocalStorage 实现（~100 行）
- [ ] `features/sources/pipeline.ts`: ingestSource parse 后 saveContent
- [ ] `features/tasks/worker.ts`: document_parse handler 完整实现（fetch → parse → chunk → embed）
- [ ] 验证: document_parse 任务可完成 parse→embed 全流程

## Workstream B: toolApproval HITL

- [ ] `features/research/agent.ts`: waitForApproval 替换为 ToolLoopAgent + toolApproval
- [ ] `features/research/router.ts`: SSE 升级为 fullStream 事件转发
- [ ] 前端: research UI 适配 tool-approval-request 事件
- [ ] 验证: 研究全流程（plan→approve→search→report）无需 DB polling

## Workstream C: 集成测试

- [ ] `test/qa/handler.test.ts`: QA 全流程（检索 + 置信度 + citations）
- [ ] `test/sources/ingest.test.ts`: 源摄取 + dedup + SSRF
- [ ] `test/refine/queue.test.ts`: refine 经 task queue 异步执行
- [ ] `test/outputs/core-types.test.ts`: PARAGRAPH/BULLETS/STRUCTURED generator
- [ ] `test/research/hitl.test.ts`: Approve/skip/finish/cancel 状态转移
- [ ] `test/research/execute.test.ts`: Search 并发 + 去重 + 聚合
- [ ] `test/research/sse.test.ts`: SSE 事件派发 + terminal 检测
- [ ] `test/research/cancel.test.ts`: AbortSignal 真中断
- [ ] `test/studio/two-stage.test.ts`: Outline→markdown 两阶段

## 整体验证

- [ ] `cd apps/server && bun test`（旧 103 + 新集成测试全绿）
- [ ] `cd apps/server && bun test tests/bdd/`（21 pass）
- [ ] `bun typecheck`（clean）
- [ ] `bun run build`（编译成功）

## 前置条件

c17-c23 已完成核心功能对齐。本 change 在这些基础上叠加 v2 特化改进。

## Verification

```bash
cd apps/server
bun test                    # 全量
bun test tests/bdd/         # BDD
cd ../..
bun typecheck
cd apps/server && bun run build
```
