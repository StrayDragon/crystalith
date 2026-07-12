# add-v2-pipeline-integration — Tasks

## Workstream A: Content Storage Layer

- [x] 新建 `shared/storage.ts`: Storage 接口 + LocalStorage 实现（~100 行）
- [x] `features/sources/pipeline.ts`: ingestSource parse 后 saveContent
- [x] `features/tasks/worker.ts`: document_parse handler 完整实现（fetch → parse → chunk → embed）
- [x] 验证: document_parse 任务可完成 parse→embed 全流程（WS-C 集成测试覆盖）

## Workstream B: toolApproval HITL + research parity 补全

- [x] `features/research/agent.ts`: runResearchCore shared core + runResearchFromState (resume reads currentIteration + aggregatedResults from DB, c24-B)
- [x] `features/research/router.ts`: `POST /research/:id/modify` (accept modified plan, record step, resume — HITL modify action, c24-B)
- [x] `POST /research/:id/resume`: uses runResearchFromState, reads aggregatedResults+currentIteration to rebuild ResearchState (c24-B)
- [x] `POST /research/:id/export`: report → chunkText → insert chunks → embedBatch → insertChunkVector → mark source ready → bump epochs (c24-B, v1 api.py:1245-1469)
- [x] DEFERRED → c13+: `features/research/agent.ts` waitForApproval 替换为 ToolLoopAgent + toolApproval（v2 改进项，非 v1 对齐；PROGRESS 标注"ToolLoopAgent/toolApproval 仍为延迟改进"）
- [x] DEFERRED → c13+: SSE 升级为 fullStream 事件转发（依赖 toolApproval 切换）
- [x] DEFERRED → c13+: 移除 Track A 临时锁（acquireLock/releaseLock，依赖事件驱动）
- [x] DEFERRED → c35+ 或前端专项: research UI 适配 tool-approval-request 事件
- [x] DEFERRED → 同上: 研究全流程无需 DB polling 验证（依赖 toolApproval 切换）

## Workstream C: 集成测试

- [x] `test/qa/handler.test.ts`: QA 置信度 + citations 解析（真实函数, 9 tests）
- [x] `test/sources/ingest.test.ts`: 源摄取 + dedup(prompt/reuse/create_new/跨notebook) + SSRF（7 tests）
- [x] `test/refine/queue.test.ts`: refine 经 task queue 异步执行（4 tests）
- [x] `test/outputs/core-types.test.ts`: PARAGRAPH/BULLETS/STRUCTURED generator ✅(pre-existing)
- [x] `test/research/hitl.test.ts`: Approve/skip/finish/cancel 状态转移
- [x] `test/research/execute.test.ts`: Search 并发 + 去重 + 聚合
- [x] `test/research/sse.test.ts`: SSE 事件派发 + terminal 检测
- [x] `test/research/cancel.test.ts`: AbortSignal 真中断
- [x] `test/studio/two-stage.test.ts`: Outline→markdown 两阶段（5 tests）

## 整体验证

- [x] `cd apps/server && bun test`（183 pass: 旧 164 + 新 19 research 集成测试全绿）
- [x] `cd apps/server && bun test tests/bdd/`（21 pass）
- [x] `bun typecheck`（clean）
- [x] `bun run build`（编译成功，crystalith-server ~75MB）

## 前置条件

c17-c23 已完成核心功能对齐。本 change 在这些基础上叠加 v2 特化改进。

## DEFERRED 说明

Workstream B 的 5 个 DEFERRED task 是 v2 架构改进（ToolLoopAgent/toolApproval 替代 DB polling），
**非 v1 行为对齐**——v1 用 LangGraph + DB polling，v2 用 AI SDK + DB polling，行为已对齐。
迁移到 toolApproval 是架构升级，依赖 c13（plugin/agent host）完成后推进。
PROGRESS.v2.md 已在"关键决策 §3"与状态看板 c22 行明确标注此延迟。

## Verification

```bash
cd apps/server
bun test                    # 全量
bun test tests/bdd/         # BDD
cd ../..
bun typecheck
cd apps/server && bun run build  # ✅
```
