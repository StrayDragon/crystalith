# c22 design — Research 完整复刻

## v1 状态机（移植 graph.py:877）

5 节点 over `ResearchGraphState{topic, status, currentIteration, maxIterations(4), aggregatedResults, ...}`：

```
PlanSearches → WaitForApproval → ExecuteSearches → AnalyzeResults → GenerateReport
                    ↑                                    │
                    └──── need_more AND iter<max ────────┘
                                                         │ else
                                                         ↓
                                                    GenerateReport → End
```

v2 用 async function chain 替代 pydantic-graph（遵循架构决策"禁用 Graph Library"）：

```ts
// state-machine.ts
async function runGraph(sessionId, signal: AbortSignal) {
  let iter = 0;
  while (signal.aborted === false) {
    const plan = await planSearches(sessionId, signal); // AI 生成 2-4 查询
    await waitForApproval(sessionId, signal); // DB 轮询 HITL
    const results = await executeSearches(sessionId, plan, signal); // 并发 3 webSearch
    const analysis = await analyzeResults(sessionId, results, signal); // AI coverage+need_more
    iter++;
    if (!analysis.need_more || iter >= maxIterations) break;
  }
  await generateReport(sessionId, signal); // AI 生成 markdown 报告
}
```

## PlanSearches（移植 graph.py:136）

AI 生成 2-4 查询（截断 max 5），engine="Web"，status=WAITING_USER，写 researchStep(type=PLAN)。

## WaitForApproval（移植 graph.py:277）

DB 轮询每 0.5s，最长 10 分钟（max_wait_time=600）。超时自动 approve。读 researchStep(type=USER_INPUT) 分派 action。

## ExecuteSearches（移植 graph.py:428）

并发 cap 3（c19 Semaphore）。去重：URL 规范化（复用 c18 canonicalizeUrlForDedup）+ 标题 Jaccard ≥0.85。结果写 researchSession.aggregatedResults。

## AnalyzeResults（移植 graph.py:608）

AI 返回 `{coverage_estimate 0-1, need_more_search}`。循环条件：`need_more AND iter < max`。fallback coverage = min(1, results.length/30)。

## GenerateReport（移植 graph.py:745）

status==CANCELLED → 不写报告直接 End。否则 AI 从 top 50 结果生成 markdown。失败用中文 fallback。

## DB-polling SSE（移植 api.py:944）

```ts
// sse.ts — GET /research/:id/stream
async function* sseGenerator(sessionId) {
  let lastStepId = 0;
  for (let i = 0; i < 3600; i++) {
    // 1h max
    const steps = db().select().from(researchSteps).where(gt(researchSteps.id, lastStepId)).all();
    for (const step of steps) yield deriveEvent(step); // plan_ready/thinking/search_progress/analysis/report
    if (terminalStatus) {
      yield doneEvent;
      return;
    }
    if (i % 30 === 0) yield heartbeatEvent; // 30s heartbeat
    lastStepId = max(steps.map((s) => s.id));
    await sleep(1000);
  }
}
```

关键：每轮 `await rollback`/重新查（SQLite 读事务隔离），让后台 worker 能 commit。

## HITL + 锁（移植 api.py）

- approve/modify/skip/finish/cancel/resume：写 researchStep(type=USER_INPUT)，若 session 活跃且无锁则 resume background
- 锁：locked_at/lock_expires_at，LOCK_TIMEOUT=600s，_extend_lock_periodically 每 300s 续期
- check_and_cleanup_expired_locks：锁过期则 cancel session

## cancel 真中断

runGraph 接收 AbortSignal，cancel 时 abort()，各节点 try/catch 捕获 AbortError 设 status=CANCELLED。

## /stop vs /cancel 修复

统一为 `/cancel`（实际路由），更新 OpenAPI doc（router.ts:58 改 /stop→/cancel，或注册两个别名）。

## 验证

- research BDD（需 LLM mock 返回结构化 analysis）
- SSE 单元测试（事件派生、heartbeat、terminal 检测）
- 锁单元测试（并发、过期清理）
