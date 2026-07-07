## Approach

### Dataset Model

```ts
// DB: eval_datasets
interface EvalDataset {
  id: number;
  name: string;
  items: EvalItem[];         // relations
}

// DB: eval_items
interface EvalItem {
  id: number;
  datasetId: number;
  question: string;
  expectedAnswer: string;     // Golden answer
  expectedSources?: number[]; // Ground truth source IDs
  notebookId: number;         // Which notebook to run against
}
```

### Metrics: LLM-as-Judge

```ts
// server/src/features/eval/metrics.ts
interface EvalMetrics {
  faithfulness: number;    // 0-1: is the answer faithful to retrieved context?
  relevance: number;       // 0-1: does the answer address the question?
  recall: number;          // 0-1: were expected sources retrieved? (if expectedSources provided)
  latencyMs: number;       // total pipeline time
}

// LLM-as-Judge via generateObject
const JudgeSchema = z.object({
  faithfulness: z.number().min(0).max(1).describe('Answer grounded in context?'),
  relevance: z.number().min(0).max(1).describe('Answer addresses the question?'),
  explanation: z.string(),
});
```

### Runner

```ts
// server/src/features/eval/runner.ts
async function runEval(datasetId: number, strategyIds: string[]): Promise<EvalRun> {
  const run = createRun(datasetId, strategyIds);
  for (const item of dataset.items) {
    for (const strategyId of strategyIds) {
      const started = Date.now();
      const context = await ragRegistry.get(strategyId).retrieve(item.question, item.notebookId);
      const answer = await generateAnswer(item.question, context);
      const metrics = await judge(item.question, answer, item.expectedAnswer, context);
      metrics.latencyMs = Date.now() - started;
      saveRunItem(run.id, item.id, strategyId, metrics);
    }
  }
  return finalizeRun(run);
}
```

### CLI + Frontend

- CLI: `bun run eval --strategies embed,bm25 --dataset golden-v1` → JSON report
- Frontend: strategy comparison radar chart, per-QA detail, regression flagging
