// Research agent — cyclic orchestration using AI SDK v7.
//
// Architecture:
//   for loop (Plan → HITL → Execute → Analyze → continue/break) → Report
//
// - Plan/Analyze: generateObject with Zod schema (structured output)
// - HITL: DB polling (wait for approve/skip/modify/finish)
// - Execute: searxngFetch via Semaphore(3)
// - Report: streamText → eagerly drain → persist completed immediately
// - Cancel: AbortSignal on the while loop
//
// Three entry points:
//   runResearch(sessionId, signal)        — fresh start (iteration 1)
//   runResearchFromState(sessionId, sig)  — resume (reads iteration + results)
//   runResearchCore(state, signal)        — shared core (used by both above)
import { generateObject, streamText } from 'ai';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { withRetry } from '../../ai/middleware.ts';
import { resolveModel } from '../../ai/providers.ts';
import { db } from '../../db/index.ts';
import { researchSessions, researchSteps } from '../../db/schema.ts';
import { getDefaultChatModel } from '../../shared/config.ts';
import { Semaphore } from '../../shared/semaphore.ts';
import { renewLock } from './router.ts';

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

async function executeSearches(
  state: ResearchState,
  plan: SearchPlan,
  signal: AbortSignal,
): Promise<ResearchResult[]> {
  const semaphore = new Semaphore(3);
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
  const deduped = deduplicateResults(allResults);

  // Record search step (c37 gap fix: v1 graph.py:573-587 records search results)
  db()
    .insert(researchSteps)
    .values({
      sessionId: state.sessionId,
      iteration: state.iteration,
      type: 'search',
      outputData: {
        result_count: deduped.length,
        queries_executed: plan.queries.length,
      } as Record<string, unknown>,
      status: 'completed',
    })
    .run();

  return deduped;
}

async function searxngFetch(
  query: string,
  signal: AbortSignal,
): Promise<Omit<ResearchResult, 'query'>[]> {
  const { getSearxngHost, getSearchSettings } = await import('../../shared/config.ts');
  const host = getSearxngHost() || 'http://localhost:8080';
  const { max_results } = getSearchSettings().searxng;
  const timeout = 10_000;

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
    return (data.results ?? []).slice(0, max_results).map((r) => ({
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

/** c46: Enhanced dedup — URL normalization + title similarity (v1 graph.py:517-562). */
function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/[?#].*$/, '') // strip query/fragment
    .replace(/\/+$/, '') // strip trailing slashes
    .replace(/^https?:\/\/www\./, 'https://'); // strip www. prefix
}

function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let common = 0;
  for (const w of wordsA) if (wordsB.has(w)) common++;
  return common / Math.max(wordsA.size, wordsB.size);
}

function deduplicateResults(results: ResearchResult[]): ResearchResult[] {
  const seenUrls = new Set<string>();
  const seenTitles: string[] = [];
  return results.filter((r) => {
    const urlKey = normalizeUrl(r.url);
    if (seenUrls.has(urlKey)) return false;
    // c46: title similarity check (v1 word-overlap ≥ 0.85)
    if (r.title && seenTitles.some((t) => titleSimilarity(t, r.title) >= 0.85)) {
      return false;
    }
    seenUrls.add(urlKey);
    if (r.title) seenTitles.push(r.title);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Report generation (streamText → eagerly drain → persist + replay)
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

  return result.textStream;
}

// ---------------------------------------------------------------------------
// Main entry: runResearchCore — shared by fresh-start and resume
// ---------------------------------------------------------------------------

/**
 * Run the full research agent cycle from a pre-built state.
 *
 * 1. Plan → 2. HITL (DB polling) → 3. Execute → 4. Analyze → loop/break → 5. Report
 *
 * Returns the text stream of the final report for SSE relay.
 * The caller is responsible for AbortController management.
 */
export async function runResearchCore(
  state: ResearchState,
  signal: AbortSignal,
): Promise<{ reportStream: AsyncIterable<string> } | null> {
  const sessionId = state.sessionId;

  for (let iter = state.iteration; iter <= state.maxIterations && !signal.aborted; iter++) {
    state.iteration = iter;
    // c46: renew lock each iteration to prevent expiry on long runs (v1 _extend_lock_periodically)
    renewLock(sessionId);
    db()
      .update(researchSessions)
      .set({ status: 'planning', currentIteration: iter })
      .where(eq(researchSessions.id, sessionId))
      .run();

    // 1. Plan
    let plan: SearchPlan;
    try {
      plan = await planSearches(state, signal);
    } catch {
      // c46: fallback 2-query plan (v1 graph.py:225-236) — don't abort the run
      plan = {
        queries: [
          { query: state.topic, engine: 'Web', priority: 1, reason: 'fallback' },
          { query: `${state.topic} overview`, engine: 'Web', priority: 2, reason: 'fallback' },
        ],
        reasoning: 'Fallback plan (AI planning failed)',
      };
    }

    // 2. HITL
    db()
      .update(researchSessions)
      .set({ status: 'waiting_user' })
      .where(eq(researchSessions.id, sessionId))
      .run();

    const decision = await waitForApproval(state, plan, signal);
    if (signal.aborted || decision.action === 'cancel') break;
    if (decision.action === 'finish') {
      // finish endpoint already generated+persisted the report — do not overwrite
      return null;
    }
    if (decision.action === 'skip') {
      // Jump to next iteration (re-plan); for-loop will ++ so set iter = next-1
      iter = decision.nextIteration - 1;
      state.iteration = decision.nextIteration;
      continue;
    }

    // approve / modify / timeout — use decision.plan (modify replaces local plan)
    plan = decision.plan;

    // 3. Execute searches
    db()
      .update(researchSessions)
      .set({ status: 'searching' })
      .where(eq(researchSessions.id, sessionId))
      .run();

    const newResults = await executeSearches(state, plan, signal);
    state.results.push(...newResults);

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
      // c46: fallback coverage analysis (v1 graph.py:675-686) — don't abort the run
      analysis = {
        summary: 'Analysis failed — using fallback',
        coverageEstimate: 0.5,
        needMore: false,
        suggestedQueries: [],
      };
    }

    // 5. Loop condition
    if (!analysis.needMore || iter >= state.maxIterations) break;
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

  // finish/skip-at-max may have already completed the session
  const afterLoop = db()
    .select()
    .from(researchSessions)
    .where(eq(researchSessions.id, sessionId))
    .get();
  if (afterLoop?.status === 'completed') {
    const report = afterLoop.finalReport ?? '';
    return {
      reportStream: (async function* () {
        if (report) yield report;
      })(),
    };
  }
  if (afterLoop?.status === 'cancelled') return null;

  // Generate report — eagerly drain so status persists regardless of SSE consumer
  db()
    .update(researchSessions)
    .set({ status: 'analyzing' })
    .where(eq(researchSessions.id, sessionId))
    .run();

  const rawStream = await generateReport(state, signal);
  const chunks: string[] = [];
  for await (const chunk of rawStream) {
    chunks.push(chunk);
  }

  const fullReport = chunks.join('');
  db()
    .update(researchSessions)
    .set({
      status: 'completed',
      finalReport: fullReport || '(no report generated)',
    })
    .where(eq(researchSessions.id, sessionId))
    .run();

  return {
    reportStream: (async function* () {
      for (const c of chunks) yield c;
    })(),
  };
}

// ---------------------------------------------------------------------------
// runResearch — fresh start (iteration 1, empty results)
// ---------------------------------------------------------------------------

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

  return runResearchCore(
    {
      sessionId,
      notebookId: session.notebookId,
      topic: session.topic,
      iteration: 1,
      maxIterations: session.maxIterations,
      results: [],
    },
    signal,
  );
}

// ---------------------------------------------------------------------------
// runResearchFromState — resume from persisted iteration + results
// ---------------------------------------------------------------------------

/**
 * Resume a previously-started research session from its persisted state.
 *
 * Reads `currentIteration` and `aggregatedResults` from the DB so the
 * agent continues where it left off instead of restarting from iteration 1.
 *
 * Corresponds to v1 `_build_state_from_session` → `run_research_graph_from_session`.
 */
export async function runResearchFromState(
  sessionId: number,
  signal: AbortSignal,
): Promise<{ reportStream: AsyncIterable<string> } | null> {
  const session = db()
    .select()
    .from(researchSessions)
    .where(eq(researchSessions.id, sessionId))
    .get();
  if (!session) return null;

  const aggregatedResults = (session.aggregatedResults ?? []) as ResearchResult[];

  return runResearchCore(
    {
      sessionId,
      notebookId: session.notebookId,
      topic: session.topic,
      iteration: session.currentIteration ?? 1,
      maxIterations: session.maxIterations,
      results: aggregatedResults,
    },
    signal,
  );
}

// ---------------------------------------------------------------------------
// Standalone report generation (c37: called by finish endpoint)
// ---------------------------------------------------------------------------

/**
 * Generate a final report from accumulated results without running the full
 * agent cycle. Used by the finish endpoint (v1 api.py:650-687 → GenerateReport).
 *
 * Eagerly drains the streamText and returns the full report text.
 */
export async function generateFinalReport(state: ResearchState): Promise<string> {
  const modelConfig = getDefaultChatModel();
  const model = withRetry(await resolveModel(modelConfig!));

  const context = state.results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}\n`)
    .join('\n');

  const result = streamText({
    model,
    // c46: v1 REPORT_SYSTEM_PROMPT (graph.py:94-128) — 6-section structured template
    system: `You are an expert research analyst writing a comprehensive research report.

Your report should be well-structured, insightful, and actionable. Follow this template:

## Report Structure:

1. **Executive Summary** (2-3 sentences)
   - Key findings and main takeaway

2. **Background & Context**
   - Why this topic matters
   - Current landscape

3. **Key Findings** (3-5 main points)
   - Each finding with supporting evidence
   - Include source references [1], [2], etc.

4. **Analysis & Insights**
   - Patterns and trends observed
   - Implications and significance

5. **Recommendations** (if applicable)
   - Actionable next steps
   - Areas for further research

6. **References**
   - Numbered list of sources cited

## Guidelines:
- Write in clear, professional language
- Use Markdown formatting (headers, lists, bold, links)
- Be objective and evidence-based
- Cite sources using [n] notation
- Keep the report focused and concise (500-1500 words)
- Write in the same language as the research topic`,
    prompt: `Topic: ${state.topic}\n\nResults:\n${context}\n\nWrite a detailed report following the structure above.`,
  });

  const chunks: string[] = [];
  for await (const chunk of result.textStream) {
    chunks.push(chunk);
  }

  const fullReport = chunks.join('');

  // Record a summary step
  db()
    .insert(researchSteps)
    .values({
      sessionId: state.sessionId,
      iteration: state.iteration,
      type: 'summary',
      outputData: { report_length: fullReport.length } as Record<string, unknown>,
      status: 'completed',
    })
    .run();

  return fullReport || '(no report generated)';
}

// ---------------------------------------------------------------------------
// HITL: wait for user approval via DB polling
// ---------------------------------------------------------------------------

type HitlDecision =
  | { action: 'approve' | 'modify' | 'timeout'; plan: SearchPlan }
  | { action: 'skip'; nextIteration: number }
  | { action: 'finish' }
  | { action: 'cancel' };

function loadLatestUserInput(sessionId: number): { action: string; plan?: SearchPlan } | null {
  const step = db()
    .select()
    .from(researchSteps)
    .where(eq(researchSteps.sessionId, sessionId))
    .orderBy(researchSteps.id)
    .all()
    .filter((s) => s.type === 'user_input')
    .pop();
  if (!step?.inputData || typeof step.inputData !== 'object') return null;
  const data = step.inputData as Record<string, unknown>;
  const action = typeof data.action === 'string' ? data.action : '';
  if (!action) return null;
  const plan = data.plan as SearchPlan | undefined;
  return { action, plan };
}

/**
 * Poll DB until the user acts (approve/modify/skip/finish/cancel) or timeout.
 * Mirrors v1 graph HITL branch (graph.py:354-409).
 */
async function waitForApproval(
  state: ResearchState,
  plan: SearchPlan,
  signal: AbortSignal,
): Promise<HitlDecision> {
  // Do NOT insert a user_input step here — control endpoints record it.

  db()
    .update(researchSessions)
    .set({ status: 'waiting_user' })
    .where(eq(researchSessions.id, state.sessionId))
    .run();

  const maxWait = 600_000;
  const pollInterval = 500;
  const maxPolls = maxWait / pollInterval;

  for (let i = 0; i < maxPolls && !signal.aborted; i++) {
    await sleep(pollInterval);
    if (signal.aborted) return { action: 'cancel' };

    const session = db()
      .select()
      .from(researchSessions)
      .where(eq(researchSessions.id, state.sessionId))
      .get();
    if (!session) return { action: 'cancel' };

    // finish endpoint: analyzing → completed (report already written)
    if (session.status === 'analyzing' || session.status === 'completed') {
      return { action: 'finish' };
    }
    if (session.status === 'cancelled') {
      return { action: 'cancel' };
    }

    // skip endpoint: advances iteration and sets planning (or completed at max)
    if (session.status === 'planning' && session.currentIteration > state.iteration) {
      return { action: 'skip', nextIteration: session.currentIteration };
    }

    // approve / modify: both set searching
    if (session.status === 'searching') {
      const userInput = loadLatestUserInput(state.sessionId);
      if (userInput?.action === 'modify' && userInput.plan?.queries?.length) {
        return {
          action: 'modify',
          plan: {
            queries: userInput.plan.queries,
            reasoning: userInput.plan.reasoning || '用户修改的计划',
          },
        };
      }
      return { action: 'approve', plan };
    }
  }

  // Timeout — auto-approve original plan (v1 graph.py:411-419)
  return { action: 'timeout', plan };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
