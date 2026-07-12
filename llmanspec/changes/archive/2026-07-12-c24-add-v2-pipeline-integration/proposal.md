---
depends_on:
  [
    c17-fix-v2-qa-citations,
    c18-add-v2-source-dedup-and-safety,
    c19-add-v2-task-queue,
    c20-fix-v2-outputs-and-refine,
    c21-add-v2-web-extractors,
    c22-add-v2-research-agent,
    c23-fix-v2-studio-and-analysis,
  ]
blocks: [c13-add-v2-distribution]
batch: all
---

# c24-add-v2-pipeline-integration — v2 特化管线整合

## Why

c17-c23 完成了核心功能从 v1 到 v2 的行为对齐，但遗留了三条"v2 特有"的工作线，
这些工作无法简单地用"对齐 v1 行为"来定义——它们本身就是 **v2 相对于 v1 的改进**。

### 三条工作线

1. **Content Storage 层**（来自 c19 document_parse stub）
   - v2 当前：pipeline.ts 取 `buffer: Uint8Array` 透传，parse 后即丢弃，无原始字节持久化
   - **v2 改进**：用 Bun 原生 API 实现轻量存储抽象（local fs），让 document_parse 任务可以从持久化存储读取原始文件
   - 这是 **v2 独有设计**（v1 也无原始字节持久化——见 design.md 勘误），非 v1 对齐，是 v2 单二进制架构下的存储设计

2. **toolApproval 事件驱动 HITL + research parity 补全**（来自 c22 残留）
   - v1：DB 轮询 + DB 锁实现人工审批；v1 graph.py 完整 5 状态机
   - v2 当前：DB polling（临时方案），且 c22 残留多个 v1 行为缺口
   - **v2 改进**：AI SDK v7 `toolApproval: 'user-approval'` 事件驱动审批，完全消除 DB 轮询
   - **同时补全 c22 残留的 v1 parity 缺口**（详见 GAP-REPORT 发现 1）：
     - resume-with-state：`/resume` 读 `aggregatedResults` 重建 ResearchState（当前从 iteration 1 + 空结果重跑，丢失累积）
     - export-to-source：report → chunk + embed + vector + source 创建（当前是只读 stub）
     - HITL 动作词汇：补 modify（改 plan 后 resume，当前仅 approve/skip/finish）
   - 注意：Track A 已加临时 DB 锁（acquireLock/releaseLock）防并发，c24-B 切事件驱动后移除

3. **集成测试套件**（跨所有 changes）
   - v1：无等效的 LLM mock 集成测试
   - v2 当前：103 单元测试覆盖各模块，但缺少跨模块集成测试
   - **v2 改进**：用 AI SDK mock 构建研究/QA/提炼全流程集成测试
   - 这是 v2 测试基础设施，不是 v1 对齐项

### 为什么是 c13 前置条件

三条工作线都影响 distribution：

- Storage 层决定二进制需要包含哪些文件系统操作
- toolApproval 决定前端打包策略（是否需要 WebSocket/SSE 升级）
- 集成测试是 v2.0.0 发布的质量门禁

## What Changes

### Workstream A — Content Storage Layer

- **NEW** `shared/storage.ts`: Storage 接口 + LocalStorage 实现（文件系统持久化）
  - `saveContent(sourceId, buffer)` — 写入 `~/.crystalith/storage/{sourceId}`
  - `fetchContent(sourceId) → Uint8Array` — 从存储读取
- **MODIFIED** `features/sources/pipeline.ts`: ingestSource 在 parse 后 saveContent
- **MODIFIED** `features/tasks/worker.ts`: document_parse handler 使用 fetchContent + 完整 parse-embed 流程
- **REMOVED** 当前 document_parse stub（替换为完整实现）

### Workstream B — toolApproval HITL + research parity 补全

- **MODIFIED** `features/research/agent.ts`: waitForApproval 替换为 ToolLoopAgent + toolApproval
- **MODIFIED** `features/research/router.ts`: SSE 端点升级为 AI SDK fullStream 事件转发
- **NEW** `POST /research/:id/modify`: 接受修改后的 SearchPlan，记录 step 后 resume（补 HITL modify 动作）
- **MODIFIED** `POST /research/:id/resume`: 读 `aggregatedResults` + `currentIteration` 重建 ResearchState（当前从空结果重跑）
- **MODIFIED** `POST /research/:id/export`: report → chunk + embed + vector store + source 创建（当前返回原始 JSON）
- **FRONTEND** 前端 research UI 改为监听 tool-approval-request 事件
- **REMOVED** DB polling + 临时 DB 锁（Track A 加的 acquireLock/releaseLock）

### Workstream C — 集成测试套件

新建集成测试文件（AI SDK mock）：

| 文件                              | 内容                                     | 覆盖 change |
| :-------------------------------- | :--------------------------------------- | :---------: |
| `test/qa/handler.test.ts`         | QA 完整流程（检索 + 置信度 + citations） |     c17     |
| `test/sources/ingest.test.ts`     | 源摄取 + dedup + SSRF 全流程             |     c18     |
| `test/refine/queue.test.ts`       | refine 经 task queue 异步执行            |   c19/c20   |
| `test/outputs/core-types.test.ts` | 3 种 output type generator               |     c20     |
| `test/research/hitl.test.ts`      | Approve/skip/finish/cancel 状态转移      |     c22     |
| `test/research/execute.test.ts`   | Search 并发 + 去重 + 结果聚合            |     c22     |
| `test/research/sse.test.ts`       | SSE 事件派发 + heartbeat + terminal      |     c22     |
| `test/research/cancel.test.ts`    | AbortSignal 真中断                       |     c22     |
| `test/studio/two-stage.test.ts`   | Outline→markdown 两阶段                  |     c23     |

### 保持不变

现有的 103 单元测试 + 21 BDD 测试不动。新测试只追加。

## Capabilities

- data-and-storage
- background-jobs-and-task-runtime
- evidence-review-workflow
- bdd-test-harness
- source-ingestion-core

## Impact

- 新增 1 存储抽象文件（~100 行）
- 修改 pipeline.ts, worker.ts, agent.ts, router.ts（4 文件）
- 新增 ~9 集成测试文件
- 前端 research panel 需适配 toolApproval 事件
- 不改变任何对外 API 合约
