import { generateText } from 'ai';
// Eval runner — multi-strategy parallel evaluation of QA pipelines.
//
// For each (dataset item × strategy): retrieve context → generate answer →
// judge against golden expected answer → compute metrics. Results are
// persisted to eval_runs and eval_run_items tables.
import { eq } from 'drizzle-orm';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { evalDatasets, evalItems, evalRuns, evalRunItems } from '../../db/schema.ts';
import { ragRegistry } from '../../rag/registry.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { judgeAnswer, computeRecall, computePrecision } from './metrics.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvalRunResult {
  runId: number;
  datasetId: number;
  strategyIds: string[];
  status: string;
  items: {
    itemId: number;
    strategyId: string;
    question: string;
    answer: string;
    faithfulness: number;
    relevance: number;
    recall?: number;
    precision?: number;
    latencyMs: number;
  }[];
  summary: {
    avgFaithfulness: number;
    avgRelevance: number;
    avgRecall: number;
    avgLatencyMs: number;
    totalItems: number;
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run a full evaluation: for each dataset item × each strategy,
 * retrieve context, generate answer, judge against golden, compute recall.
 */
export async function runEval(datasetId: number, strategyIds: string[]): Promise<EvalRunResult> {
  const dataset = db().select().from(evalDatasets).where(eq(evalDatasets.id, datasetId)).get();
  if (!dataset) throw new Error(`Dataset ${datasetId} not found`);

  const items = db().select().from(evalItems).where(eq(evalItems.datasetId, datasetId)).all();

  // Create run record
  const run = db()
    .insert(evalRuns)
    .values({
      datasetId,
      strategyIds,
      status: 'running',
    })
    .returning()
    .get();

  // Resolve judge model
  const modelConfig = getDefaultChatModel();
  if (!modelConfig) throw new Error('No chat model configured');
  const judgeModel = withRetry(await resolveModel(modelConfig));

  const results: EvalRunResult['items'] = [];

  for (const item of items) {
    for (const strategyId of strategyIds) {
      const started = Date.now();

      try {
        // 1. Retrieve context
        const chunks = await ragRegistry.retrieveWith(strategyId, item.notebookId, item.question, {
          topK: 5,
        });
        const context = chunks.map((c) => `[${c.chunkIndex}] ${c.text}`).join('\n\n');

        // 2. Generate answer
        const genResult = await generateText({
          model: judgeModel,
          prompt: `Context:\n${context}\n\nQuestion: ${item.question}\n\nAnswer based on the context:`,
        });

        const answer = genResult.text;

        // 3. Judge
        const metrics = await judgeAnswer(
          judgeModel,
          item.question,
          answer,
          item.expectedAnswer,
          context,
        );
        metrics.latencyMs = Date.now() - started;

        // 4. Compute recall if expected sources provided
        if (
          item.expectedSources &&
          Array.isArray(item.expectedSources) &&
          item.expectedSources.length > 0
        ) {
          const sourceIds = chunks.map((c) => c.sourceId);
          metrics.recall = computeRecall(sourceIds, item.expectedSources as number[]);
          metrics.precision = computePrecision(sourceIds, item.expectedSources as number[]);
        }

        // 5. Persist run item
        db()
          .insert(evalRunItems)
          .values({
            runId: run.id,
            itemId: item.id,
            strategyId,
            question: item.question,
            answer,
            retrievedSourceIds: chunks.map((c) => c.sourceId),
            metrics: {
              faithfulness: metrics.faithfulness,
              relevance: metrics.relevance,
              recall: metrics.recall ?? 0,
              precision: metrics.precision ?? 0,
              latencyMs: metrics.latencyMs,
              explanation: metrics.explanation,
            },
          })
          .run();

        results.push({
          itemId: item.id,
          strategyId,
          question: item.question,
          answer,
          faithfulness: metrics.faithfulness,
          relevance: metrics.relevance,
          recall: metrics.recall,
          precision: metrics.precision,
          latencyMs: metrics.latencyMs,
        });
      } catch (error) {
        console.error(`[eval] failed item=${item.id} strategy=${strategyId}:`, error);
      }
    }
  }

  // Compute summary
  const summary = computeSummary(results);

  // Finalize run
  db()
    .update(evalRuns)
    .set({
      status: 'completed',
      summary,
      finishedAt: new Date(),
    })
    .where(eq(evalRuns.id, run.id))
    .run();

  return {
    runId: run.id,
    datasetId,
    strategyIds,
    status: 'completed',
    items: results,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Summary computation
// ---------------------------------------------------------------------------

function computeSummary(results: EvalRunResult['items']): EvalRunResult['summary'] {
  if (results.length === 0) {
    return { avgFaithfulness: 0, avgRelevance: 0, avgRecall: 0, avgLatencyMs: 0, totalItems: 0 };
  }

  let totalFaithfulness = 0;
  let totalRelevance = 0;
  let totalRecall = 0;
  let recallCount = 0;
  let totalLatency = 0;

  for (const r of results) {
    totalFaithfulness += r.faithfulness;
    totalRelevance += r.relevance;
    totalLatency += r.latencyMs;
    if (r.recall !== undefined) {
      totalRecall += r.recall;
      recallCount++;
    }
  }

  return {
    avgFaithfulness: totalFaithfulness / results.length,
    avgRelevance: totalRelevance / results.length,
    avgRecall: recallCount > 0 ? totalRecall / recallCount : 0,
    avgLatencyMs: totalLatency / results.length,
    totalItems: results.length,
  };
}
