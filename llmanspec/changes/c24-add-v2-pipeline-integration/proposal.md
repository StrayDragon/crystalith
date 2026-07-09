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
   - v1：FastAPI 用文件系统存储原始上传内容，parse 时从磁盘读取
   - v2 当前：pipeline.ts 取 `buffer: Uint8Array` 透传，无持久化
   - **v2 改进**：用 Bun 原生 API 实现轻量存储抽象（local fs），让 document_parse 任务可以从持久化存储读取原始文件
   - 这不是 v1 对齐，是 v2 单二进制架构下的存储设计

2. **toolApproval 事件驱动 HITL**（来自 c22）
   - v1：DB 轮询 + DB 锁实现人工审批
   - v2 当前：DB polling 兼容前端（临时方案）
   - **v2 改进**：AI SDK v7 `toolApproval: 'user-approval'` 事件驱动审批
   - 完全消除 DB 轮询/DB 锁，这是 v2 AI SDK v7 原生优势

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

### Workstream B — toolApproval HITL

- **MODIFIED** `features/research/agent.ts`: waitForApproval 替换为 ToolLoopAgent + toolApproval
- **MODIFIED** `features/research/router.ts`: SSE 端点升级为 AI SDK fullStream 事件转发
- **FRONTEND** 前端 research UI 改为监听 tool-approval-request 事件
- **REMOVED** DB polling + DB 锁残留

### Workstream C — 集成测试套件

新建集成测试文件（AI SDK mock）：

| 文件 | 内容 | 覆盖 change |
|:---|:---|:---:|
| `test/qa/handler.test.ts` | QA 完整流程（检索 + 置信度 + citations） | c17 |
| `test/sources/ingest.test.ts` | 源摄取 + dedup + SSRF 全流程 | c18 |
| `test/refine/queue.test.ts` | refine 经 task queue 异步执行 | c19/c20 |
| `test/outputs/core-types.test.ts` | 3 种 output type generator | c20 |
| `test/research/hitl.test.ts` | Approve/skip/finish/cancel 状态转移 | c22 |
| `test/research/execute.test.ts` | Search 并发 + 去重 + 结果聚合 | c22 |
| `test/research/sse.test.ts` | SSE 事件派发 + heartbeat + terminal | c22 |
| `test/research/cancel.test.ts` | AbortSignal 真中断 | c22 |
| `test/studio/two-stage.test.ts` | Outline→markdown 两阶段 | c23 |

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
