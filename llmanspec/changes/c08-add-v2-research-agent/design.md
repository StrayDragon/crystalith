## Approach

### Agent Loop (async generator, not graph library)

pydantic-graph 的显式状态机 → async generator + while loop。v1 的 567 行 graph 完全可以表达为 ~150 行 async function：

```
PlanSearches → WaitForApproval (HITL) → ExecuteSearches → AnalyzeResults →
  (needMore? → PlanSearches : GenerateReport) → End
```

```ts
async function* researchLoop(state: ResearchState, deps: ResearchDeps) {
  let iteration = 1;
  while (iteration <= state.maxIterations && !cancelled) {
    // 1. Plan
    const plan = await generatePlan(state, iteration);
    yield { type: 'plan_generated', plan };

    // 2. HITL: poll DB for user action
    const action = await waitForApproval(state, 600_000); // 10 min timeout
    if (action === 'cancel') break;
    if (action === 'finish') break;
    if (action === 'skip') { iteration++; continue; }

    // 3. Execute
    yield { type: 'searching' };
    const results = await executeSearches(plan, deps.searcher, 3); // max 3 concurrent
    state.allResults.push(...dedup(results));

    // 4. Analyze
    yield { type: 'analyzing' };
    const analysis = await analyzeResults(state, iteration);
    yield { type: 'analysis', analysis };

    if (!analysis.needMore) break;
    iteration++;
  }

  // 5. Report
  yield { type: 'generating_report' };
  const report = await generateReport(state);
  yield { type: 'done', report };
}
```

### SearXNG Integration

```ts
async function searxngSearch(query: string): Promise<SearchResult[]> {
  const url = `${searxngHost}/search?q=${encodeURIComponent(query)}&format=json`;
  const res = await fetch(url);
  const data = await res.json() as SearXNGResponse;
  return data.results.map(r => ({ title: r.title, url: r.url, snippet: r.content, engine: r.engine }));
}
```

### HITL (Human-in-the-Loop)

WaitForApproval polls DB every 500ms:
```ts
async function waitForApproval(state: ResearchState, timeoutMs: number): Promise<UserAction> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(500);
    const session = await db.getResearchSession(state.sessionId);
    if (session.status === 'cancelled') return 'cancel';
    if (session.userAction) return session.userAction; // approve | modify | skip | finish | cancel
  }
  return 'approve'; // timeout → auto-continue
}
```

### Session Resume

Research sessions persist `aggregated_results` (JSON) + `steps` (JSON) to DB.
On restart, rebuild ResearchState from persisted data and resume from the correct node.

### SQL

All in-process: SearXNG HTTP API → JSON parse → no external npm deps needed.
