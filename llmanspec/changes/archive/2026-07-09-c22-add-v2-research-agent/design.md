# c22 design — Research 完整复刻 (v2, AI SDK v7 方案)

> 初始版本基于 "async function chain 替代 pydantic-graph"。2026-07-09 CDP 调研后重写：
> 发现 AI SDK v7 已原生提供 `ToolLoopAgent`、`WorkflowAgent`、`toolApproval`、`Workflow Patterns`。
> **不需要引入任何额外依赖**（Pi agent-core / Mastra / LangGraph.js），全部用 `ai` 包解决。

---

## 背景：架构决策更新（2026-07-09）

### 调研结论

| 原先假设                                   | 调研后发现                                                                   |
| :----------------------------------------- | :--------------------------------------------------------------------------- |
| AI SDK 只有 `maxSteps`，没有 Agent runtime | ✅ `ToolLoopAgent` 从 `ai` 直接导出（`ai@7.0.18`）                           |
| AI SDK 没有 HITL                           | ✅ `toolApproval: 'user-approval'` 原生支持                                  |
| AI SDK 没有工作流/循环                     | ✅ `WorkflowAgent` + Workflow Patterns（sequential/parallel/feedback loops） |
| 需要 Pi agent-core 补 Agent runtime        | ❌ 不需要，`ToolLoopAgent` 已覆盖                                            |
| 需要 pi-ai 做 provider                     | ❌ 不需要，`@ai-sdk/*` 已覆盖                                                |
| 需要自建轻量 runner                        | ❌ 不需要，`WorkflowAgent` + Loop Control 已覆盖                             |
| 需要 DB 轮询做 HITL                        | ❌ 不需要，`toolApproval` 事件驱动                                           |

### 新架构原则

```
AI SDK v7 是 Crystalith 唯一的 AI 层：
├── ToolLoopAgent   → Agent runtime（工具调用 + 循环）
├── WorkflowAgent   → 工作流编排（顺序/并发/反馈循环）
├── toolApproval    → HITL（等待用户审批）
├── generateObject  → 结构化输出（plan/analyze 等）
├── streamText      → 流式报告生成
└── @ai-sdk/*       → Provider 抽象（openai/anthropic/google/...）
```

**禁用规则更新：**

- ~~禁用 Graph Library~~ → ✅ AI SDK v7 的 WorkflowAgent 是官方内置，非第三方图库
- ~~不引入 LangChain、LangGraph 等~~ → 维持
- 不引入 Pi agent-core / Mastra / XState 等 → **新增：** 不引入任何第三方 agent 框架

---

## 状态机（v1 pydantic-graph 5 节点）

```
PlanSearches → WaitForApproval → ExecuteSearches → AnalyzeResults → GenerateReport
                    ↑                                    │
                    └──── need_more AND iter<max ────────┘
                                                         │ else
                                                         ↓
                                                    GenerateReport → End
```

### v2 实现：ToolLoopAgent + toolApproval + while 循环

```ts
// features/research/agent.ts
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { generateObject } from 'ai';

// ================================================================
// Step 1: Plan — 结构化输出（不用 agent，用 generateObject）
// ================================================================
const planSearchSchema = z.object({
  queries: z
    .array(
      z.object({
        query: z.string(),
        engine: z.string().default('Web'),
        priority: z.number().min(1).max(3).default(1),
        reason: z.string(),
      }),
    )
    .min(1)
    .max(5),
  reasoning: z.string(),
});

async function planSearches(state: ResearchState): Promise<SearchPlan> {
  const { object } = await generateObject({
    model: state.model,
    schema: planSearchSchema,
    system: `You are a research assistant planning search queries. 生成 2-4 个搜索查询。`,
    prompt: `研究主题：${state.topic}。第 ${state.iteration}/${state.maxIterations} 轮。已有 ${state.results.length} 条结果。`,
  });
  return object;
}

// ================================================================
// Step 3: Execute — 工具函数，用 semaphore 限制并发
// ================================================================
const webSearchTool = tool({
  description: 'Search the web for information',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    /* SearXNG fetch */
  },
});

// ================================================================
// Step 4: Analyze — 结构化输出
// ================================================================
const analysisSchema = z.object({
  summary: z.string(),
  coverage_estimate: z.number().min(0).max(1),
  need_more: z.boolean(),
  suggested_queries: z.array(z.string()),
});

async function analyzeResults(state: ResearchState): Promise<AnalysisResult> {
  const { object } = await generateObject({
    model: state.model,
    schema: analysisSchema,
    prompt: `分析 ${state.results.length} 条结果...`,
  });
  return object;
}

// ================================================================
// 主循环：while + ToolLoopAgent
// ================================================================
export async function runResearch(sessionId: number, topic: string, signal: AbortSignal) {
  const state = new ResearchState(sessionId, topic);

  for (let iter = 1; iter <= state.maxIterations && !signal.aborted; iter++) {
    state.iteration = iter;

    // 1. Plan — generateObject
    const plan = await planSearches(state);
    await persistStep(sessionId, 'plan', plan);

    // 2. HITL — toolApproval 等用户确认
    //    用 ToolLoopAgent + toolApproval
    const approvalAgent = new ToolLoopAgent({
      model: state.model,
      instructions: `等待用户审批搜索计划。`,
      tools: {
        webSearch: webSearchTool,
        approvePlan: tool({
          description: '用户已审批搜索计划，继续执行',
          inputSchema: z.object({}),
          // toolApproval: 'user-approval' 控制
          execute: async () => ({ approved: true }),
        }),
      },
    });

    const approved = await waitForUserApproval(sessionId, state, plan, signal);
    if (!approved || signal.aborted) break;

    // 3. Execute — 并发搜索 (Semaphore 3)
    const newResults = await executeSearches(plan.queries, signal);
    state.results.push(...deduplicate(newResults));

    // 4. Analyze — generateObject
    const analysis = await analyzeResults(state);
    await persistStep(sessionId, 'analyze', analysis);

    if (!analysis.need_more) break;
  }

  // 5. Report — streamText 流式生成
  const reportStream = await generateReport(state, signal);
  // relay 到 SSE
  for await (const chunk of reportStream.textStream) {
    emitSSE({ type: 'report_delta', text: chunk });
  }
}
```

---

## 每个节点的 AI SDK v7 实现

### 1. PlanSearches（移植 graph.py:136）

```ts
// 用 generateObject + Zod schema（替代 pydantic-ai Agent(output_type=...)）
const { object: plan } = await generateObject({
  model,
  schema: planSearchSchema,
  system: PLAN_SYSTEM_PROMPT,
  prompt: `Research topic: ${topic}. Iteration: ${iter}/${maxIter}.`,
});
// plan.queries: SearchQuery[], plan.reasoning: string
```

### 2. WaitForApproval（移植 graph.py:277）

```ts
// 用 toolApproval: 'user-approval' 替代 DB 轮询
// ToolLoopAgent 收到 tool call 时，AI SDK 会 emit approval request
// 前端/用户响应后继续
const result = await agent.generate({
  prompt: '请确认搜索计划：' + JSON.stringify(plan),
  toolApproval: {
    approvePlan: 'user-approval', // 等用户审批
    webSearch: 'not-applicable', // 自动执行
  },
});
```

**不再需要 DB 轮询！** `toolApproval` 是事件驱动的：

```
Agent 调用 approvePlan tool
  → AI SDK 发出 { type: 'tool-approval-request', toolCall, toolName: 'approvePlan' }
  → 前端收到事件，显示审批 UI
  → 用户点击"批准"
  → AI SDK 继续执行 tool
  → Agent 继续循环
```

### 3. ExecuteSearches（移植 graph.py:428）

```ts
// 并发 cap 3（c19 Semaphore）
const semaphore = new Semaphore(3);
const results = await Promise.all(
  plan.queries.map((q) => semaphore.run(() => searxngSearch(q.query))),
);
// 去重：URL 规范化 + 标题 Jaccard（复用 c18 逻辑）
const deduped = deduplicateResults(results.flat());
```

### 4. AnalyzeResults（移植 graph.py:608）

```ts
const { object: analysis } = await generateObject({
  model,
  schema: analysisSchema,
  prompt: buildAnalysisPrompt(state),
});
// analysis.coverage_estimate: 0-1
// analysis.need_more: boolean
```

### 5. GenerateReport（移植 graph.py:745）

```ts
// 流式报告：AI SDK streamText
const result = streamText({
  model,
  system: REPORT_SYSTEM_PROMPT,
  prompt: buildReportPrompt(state),
});
```

---

## SSE 流（移植 api.py:944）

AI SDK 原生流 vs DB 轮询方案对比：

| 维度     | DB 轮询（原设计）       | AI SDK 原生流（新方案）                                        |
| :------- | :---------------------- | :------------------------------------------------------------- |
| 实现     | 定时查 researchSteps 表 | `for await (const chunk of result.fullStream)`                 |
| 延迟     | ~1s（轮询间隔）         | 实时（事件驱动）                                               |
| 事件类型 | 7 种自定义事件          | `text-delta`/`tool-call`/`tool-result`/`tool-approval-request` |
| 复杂度   | 需要维护 lastStepId     | AI SDK 自动管理                                                |
| 恢复     | 需 resumeStream         | `chatbot-resume-streams` 原生支持                              |

```ts
// sse.ts — GET /research/:id/stream
async function* sseGenerator(sessionId: string) {
  // relay AI SDK fullStream 事件到 SSE
  for await (const chunk of result.fullStream) {
    if (chunk.type === 'text-delta') {
      yield `data: ${JSON.stringify({ type: 'report_delta', text: chunk.textDelta })}\n\n`;
    } else if (chunk.type === 'tool-call') {
      yield `data: ${JSON.stringify({ type: 'search_progress', query: chunk.args.query })}\n\n`;
    } else if (chunk.type === 'tool-approval-request') {
      yield `data: ${JSON.stringify({ type: 'approval_request', toolCall: chunk.toolCall })}\n\n`;
    }
  }
}
```

---

## HITL + 锁（移植 api.py:77）

### 旧方案：DB 轮询 + DB 锁

```
approve/modify/skip/finish/cancel  →  写 researchStep(USER_INPUT)
                                     →  后台 worker 每 0.5s 查表
                                     →  locked_at/lock_expires_at
                                     →  _extend_lock_periodically 每 300s
```

### 新方案：toolApproval + AbortSignal

```
toolApproval: 'user-approval'  →  AI SDK 发出事件
                                →  前端收到，UI 审批
                                →  用户点击 → 继续

cancel: AbortController.abort()
      → ToolLoopAgent 收到 signal.aborted
      → for 循环 condition 不满足 → 自然终止
      → status = CANCELLED

不需要 DB 锁：
- toolApproval 是进程内的（同一 session 只有一个人操作）
- 单用户桌面应用不需要分布式锁
```

**锁彻底移除的理由：** Crystalith v2 是单用户桌面应用（Tauri sidecar），不需要分布式锁。v1 的锁机制是为多 worker 并发设计的（FastAPI + ChromaDB 场景），v2 中不会出现两个 worker 同时操作同一 research session 的情况。

---

## 路由（移植 router.ts:58）

仍保留 `/cancel` 路由（不需要改），但实现变为 `AbortController`：

```ts
// 路由层不直接调 runGraph，而是管理 AbortControllers
const activeResearch = new Map<number, AbortController>();

app.post('/research/:id/cancel', ({ params }) => {
  const ac = activeResearch.get(Number(params.id));
  ac?.abort();
  // status = CANCELLED
});
```

---

## 文件结构

```
apps/server/src/features/research/
├── agent.ts          # 主循环：runResearch()（for + ToolLoopAgent + generateObject）
├── agent.test.ts     # 状态机测试（多轮迭代、终止条件）
├── sse.ts            # SSE 事件流（relay AI SDK fullStream → SSE）
├── sse.test.ts       # SSE 测试（事件派生、heartbeat、terminal）
├── hitl.ts           # HITL：toolApproval 审批流程
├── hitl.test.ts      # HITL 测试（各 action 状态转移）
├── execute.ts        # ExecuteSearches：并发 + 去重
├── execute.test.ts   # 执行测试（去重、并发）
├── router.ts         # 路由（现有，仅修改 cancel 为 AbortController）
└── tools.ts          # 现有 tool 定义（webSearch）
```

**相比旧方案减少的文件：**

- 移除 `lock.ts`（不需要 DB 锁）
- 移除 `state-machine.ts`（逻辑分散到 `agent.ts` 和 `hitl.ts`）

---

## 验证

| 测试            | 内容                                | 工具                     |
| :-------------- | :---------------------------------- | :----------------------- |
| agent.test.ts   | 多轮迭代、终止条件、flow 正确       | `generateObject` mocked  |
| hitl.test.ts    | approve/skip/finish/cancel 状态转移 | `toolApproval` mocked    |
| execute.test.ts | 去重逻辑、并发控制                  | `fetch` mocked           |
| sse.test.ts     | 事件派发、heartbeat、terminal       | `fullStream` mock stream |
| 集成            | BDD 场景                            | LLM mock                 |
