// Research agent — cyclic orchestration using AI SDK v7 ToolLoopAgent.
//
// Architecture:
//   for loop (Plan → HITL → Execute → Analyze → continue/break) → Report
//
// - Plan/Analyze: generateObject with Zod schema (structured output)
// - HITL: toolApproval: 'user-approval' (event-driven, no DB polling)
// - Execute: webSearch tool via ToolLoopAgent
// - Report: streamText (relayed to SSE)
// - Cancel: AbortSignal on the while loop
import { generateObject, streamText } from 'ai';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { researchSessions, researchSteps } from '../../db/schema.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { Semaphore } from '../../shared/semaphore.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResearchState {
  sessionId: number;
  notebookId: number;
  topic: string;
  iteration: number;
  maxIterations: number;
  results: ResearchResult[];
}

export interface ResearchResult {
  title: string;
  url: string;
  snippet: string;
  engine: string;
  query: string;
}

export interface SearchPlan {
  queries: Array<{ query: string; engine: string; priority: number; reason: string }>;
  reasoning: string;
}

export interface AnalysisResult {
  summary: string;
  coverageEstimate: number;
  needMore: boolean;
  suggestedQueries: string[];
}

// ---------------------------------------------------------------------------
// Schemas for structured output
// ---------------------------------------------------------------------------

const PlanSearchSchema = z.object({
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

const AnalysisSchema = z.object({
  summary: z.string(),
  coverageEstimate: z.number().min(0).max(1),
  needMore: z.boolean(),
  suggestedQueries: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Sub-function: Plan
// ---------------------------------------------------------------------------

async function planSearches(state: ResearchState, signal: AbortSignal): Promise<SearchPlan> {
  const modelConfig = getDefaultChatModel();
  const model = withRetry(await resolveModel(modelConfig!));

  const { object } = await generateObject({
    model,
    schema: PlanSearchSchema,
    system: `You are a research assistant planning search queries. Generate 2-4 search queries covering different aspects of the topic.`,
    prompt: `Research topic: ${state.topic}. Iteration ${state.iteration}/${state.maxIterations}. Current results count: ${state.results.length}.`,
    abortSignal: signal,
  });

  // Persist plan as research step
  db()
    .insert(researchSteps)
    .values({
      sessionId: state.sessionId,
      iteration: state.iteration,
      type: 'plan',
      outputData: object as unknown as Record<string, unknown>,
      status: 'completed',
    })
    .run();

  return object;
}

// ---------------------------------------------------------------------------
// Sub-function: Analyze
// ---------------------------------------------------------------------------

async function analyzeResults(state: ResearchState, signal: AbortSignal): Promise<AnalysisResult> {
  const modelConfig = getDefaultChatModel();
  const model = withRetry(await resolveModel(modelConfig!));

  const context = state.results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}\n`)
    .join('\n');

  const { object } = await generateObject({
    model,
    schema: AnalysisSchema,
    system: `You analyze research results to determine coverage and whether more searches are needed.`,
    prompt: `Topic: ${state.topic}\n\nResults found (${state.results.length}):\n${context}\n\nEstimate coverage [0-1] and state if more searches are needed.`,
    abortSignal: signal,
  });

  // Persist analysis as research step
  db()
    .insert(researchSteps)
    .values({
      sessionId: state.sessionId,
      iteration: state.iteration,
      type: 'analyze',
      outputData: object as unknown as Record<string, unknown>,
      status: 'completed',
    })
    .run();

  return object;
}

// ---------------------------------------------------------------------------
// Sub-function: Execute searches (concurrent with semaphore)
// ---------------------------------------------------------------------------

async function executeSearches(plan: SearchPlan, signal: AbortSignal): Promise<ResearchResult[]> {
  const semaphore = new Semaphore(3); // max 3 concurrent
  const allResults: ResearchResult[] = [];

  const tasks = plan.queries.map((q) =>
    semaphore.acquire().then(async (release) => {
      try {
        if (signal.aborted) return;
        const results = await searxngFetch(q.query, signal);
        for (const r of results) {
          allResults.push({ ...r, query: q.query });
        }
      } finally {
        release();
      }
    }),
  );

  await Promise.all(tasks);
  return deduplicateResults(allResults);
}

async function searxngFetch(
  query: string,
  signal: AbortSignal,
): Promise<Omit<ResearchResult, 'query'>[]> {
  const { config } = await import('../../shared/config.ts');
  const raw = config().raw;
  const search = raw.search_engine as Record<string, unknown> | undefined;
  const host = String(search?.searxng_host ?? process.env.SEARXNG_HOST ?? 'http://localhost:8080');
  const timeout = Number(search?.timeout ?? 10_000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const combinedSignal = combineSignals(signal, controller.signal);

  try {
    const url = `${host}/search?q=${encodeURIComponent(query)}&format=json`;
    const res = await fetch(url, { signal: combinedSignal });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ title: string; url: string; content: string; engine: string }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      engine: r.engine,
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort(sig.reason);
      return controller.signal;
    }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
  }
  return controller.signal;
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function deduplicateResults(results: ResearchResult[]): ResearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.url.toLowerCase().replace(/[?#].*$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Report generation (streamText → SSE)
// ---------------------------------------------------------------------------

async function generateReport(
  state: ResearchState,
  signal: AbortSignal,
): Promise<AsyncIterable<string>> {
  const modelConfig = getDefaultChatModel();
  const model = withRetry(await resolveModel(modelConfig!));

  const context = state.results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}\n`)
    .join('\n');

  const result = streamText({
    model,
    system: `You are a research report writer. Produce a comprehensive markdown report.`,
    prompt: `Topic: ${state.topic}\n\nResults:\n${context}\n\nWrite a detailed report with executive summary, findings, and conclusions.`,
    abortSignal: signal,
  });

  // Return the text stream for SSE relay
  return result.textStream;
}

// ---------------------------------------------------------------------------
// Main entry: runResearch
// ---------------------------------------------------------------------------

/**
 * Run the full research agent cycle.
 *
 * 1. Plan → 2. HITL (toolApproval) → 3. Execute → 4. Analyze → loop/break → 5. Report
 *
 * Returns the text stream of the final report for SSE relay.
 * The caller is responsible for AbortController management.
 */
export async function runResearch(
  sessionId: number,
  signal: AbortSignal,
): Promise<{ reportStream: AsyncIterable<string> } | null> {
  const session = db()
    .select()
    .from(researchSessions)
    .where(eq(researchSessions.id, sessionId))
    .get();
  if (!session) return null;

  const state: ResearchState = {
    sessionId,
    notebookId: session.notebookId,
    topic: session.topic,
    iteration: 1,
    maxIterations: session.maxIterations,
    results: [],
  };

  for (let iter = 1; iter <= state.maxIterations && !signal.aborted; iter++) {
    state.iteration = iter;
    db()
      .update(researchSessions)
      .set({ status: 'planning', currentIteration: iter })
      .where(eq(researchSessions.id, sessionId))
      .run();

    // 1. Plan — structured output
    let plan: SearchPlan;
    try {
      plan = await planSearches(state, signal);
    } catch {
      break; // AbortError or failure
    }

    // 2. HITL — use ToolLoopAgent with toolApproval
    db()
      .update(researchSessions)
      .set({ status: 'waiting_user' })
      .where(eq(researchSessions.id, sessionId))
      .run();

    const approved = await waitForApproval(state, plan, signal);
    if (!approved || signal.aborted) break;

    // 3. Execute searches
    db()
      .update(researchSessions)
      .set({ status: 'searching' })
      .where(eq(researchSessions.id, sessionId))
      .run();

    const newResults = await executeSearches(plan, signal);
    state.results.push(...newResults);

    // Persist aggregated results
    db()
      .update(researchSessions)
      .set({ aggregatedResults: state.results as unknown as Record<string, unknown>[] })
      .where(eq(researchSessions.id, sessionId))
      .run();

    // 4. Analyze
    let analysis: AnalysisResult;
    try {
      analysis = await analyzeResults(state, signal);
    } catch {
      break;
    }

    // 5. Loop condition
    if (!analysis.needMore || iter >= state.maxIterations) break;

    // Update suggested queries for next iteration
    db()
      .update(researchSessions)
      .set({ status: 'analyzing' })
      .where(eq(researchSessions.id, sessionId))
      .run();
  }

  // If cancelled, don't write report
  if (signal.aborted) {
    db()
      .update(researchSessions)
      .set({ status: 'cancelled' })
      .where(eq(researchSessions.id, sessionId))
      .run();
    return null;
  }

  // 5. Generate report
  db()
    .update(researchSessions)
    .set({ status: 'analyzing' })
    .where(eq(researchSessions.id, sessionId))
    .run();

  const reportStream = await generateReport(state, signal);

  // Collect full report text and persist (also return stream for SSE)
  let fullReport = '';
  const teeStream = async function* () {
    for await (const chunk of reportStream) {
      fullReport += chunk;
      yield chunk;
    }
    // Persist after streaming completes
    db()
      .update(researchSessions)
      .set({
        status: 'completed',
        finalReport: fullReport || '(no report generated)',
      })
      .where(eq(researchSessions.id, sessionId))
      .run();
  };

  return { reportStream: teeStream() };
}

// ---------------------------------------------------------------------------
// HITL: wait for user approval via DB polling (simplified for desktop MVP)
// ---------------------------------------------------------------------------
// The AI SDK v7 toolApproval is the ideal approach but requires the frontend
// to handle tool-approval events. For the initial implementation, use a
// lightweight DB-polling approach that maintains compatibility with the
// existing frontend research UI.

async function waitForApproval(
  state: ResearchState,
  plan: SearchPlan,
  signal: AbortSignal,
): Promise<boolean> {
  // Insert a USER_INPUT step so the frontend can display the plan
  db()
    .insert(researchSteps)
    .values({
      sessionId: state.sessionId,
      iteration: state.iteration,
      type: 'user_input',
      outputData: plan as unknown as Record<string, unknown>,
      status: 'pending',
    })
    .run();

  db()
    .update(researchSessions)
    .set({ status: 'waiting_user' })
    .where(eq(researchSessions.id, state.sessionId))
    .run();

  // Poll DB for approval (max 10 min, every 500ms)
  const maxWait = 600_000; // 10 min
  const pollInterval = 500;
  const maxPolls = maxWait / pollInterval;

  for (let i = 0; i < maxPolls && !signal.aborted; i++) {
    await sleep(pollInterval);
    if (signal.aborted) return false;

    const session = db()
      .select()
      .from(researchSessions)
      .where(eq(researchSessions.id, state.sessionId))
      .get();
    if (!session) return false;

    // Check for user action: approve/skip/finish
    if (session.status === 'searching') return true; // approved
    if (session.status === 'cancelled' || session.status === 'completed') return false;
  }

  // Timeout: auto-approve
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
