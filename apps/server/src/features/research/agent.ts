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
import { renewLock } from './lock.ts';

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
  /**
   * c49: restored search plan (from persisted steps on resume) + resume status.
   * When resumeStatus is waiting_user/searching AND searchPlan is present,
   * runResearchCore skips re-planning and jumps to HITL/search (v1
   * _start_node_for_status, graph.py:1013-1028).
   */
  searchPlan?: SearchPlan | null;
  resumeStatus?: 'planning' | 'searching' | 'analyzing' | 'waiting_user' | null;
  /**
   * c58: last analysis result (suggestedQueries feeds next plan prompt).
   * v1 graph.py:170-171 passes prior analysis.suggested_queries into plan.
   */
  lastAnalysis?: AnalysisResult | null;
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

/**
 * c58: build the plan prompt, including prior analysis suggested_queries as
 * "Suggested focus areas" (v1 graph.py:170-171). On iteration 1 there is no
 * prior analysis, so the focus-areas section is omitted.
 */
function buildPlanPrompt(state: ResearchState): string {
  const parts = [
    `Research topic: ${state.topic}.`,
    `Iteration ${state.iteration}/${state.maxIterations}.`,
    `Current results count: ${state.results.length}.`,
  ];
  const suggested = state.lastAnalysis?.suggestedQueries?.filter((q) => q.trim());
  if (suggested && suggested.length > 0) {
    parts.push(
      `Suggested focus areas (from previous analysis): ${suggested.map((q) => q.trim()).join(', ')}.`,
    );
  }
  return parts.join(' ');
}

async function planSearches(state: ResearchState, signal: AbortSignal): Promise<SearchPlan> {
  const modelConfig = getDefaultChatModel();
  const model = withRetry(await resolveModel(modelConfig!));

  const { object } = await generateObject({
    model,
    schema: PlanSearchSchema,
    system: `You are a research assistant planning search queries. Generate 2-4 search queries covering different aspects of the topic.`,
    prompt: buildPlanPrompt(state),
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
  // c49: seed dedup from state.results (accumulated across iterations) so
  // duplicates don't reappear in later iterations (v1 graph.py:518,551).
  const deduped = deduplicateResults(allResults, state.results);

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

  // P0-2: emit one `search_result` step per result so the SSE poller can relay
  // them as individual `search_result` events (v1 graph.py:497-498 fires
  // on_search_result per result; shared schema ResearchProgressEventSchema
  // already defines the `search_result` variant). Mirrors v1's per-result
  // streaming UX (live "found N results") that the aggregate `search` step
  // cannot provide.
  if (deduped.length > 0) {
    db()
      .insert(researchSteps)
      .values(
        deduped.map((r) => ({
          sessionId: state.sessionId,
          iteration: state.iteration,
          type: 'search_result' as const,
          outputData: {
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            source: r.engine,
            iteration: state.iteration,
            relevance_score: 0,
            query: r.query,
          } as Record<string, unknown>,
          status: 'completed' as const,
        })),
      )
      .run();
  }

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

/**
 * c49: deduplicate results, seeding the seen-set from accumulated results so
 * duplicates are dropped across iterations (v1 graph.py:517-562 seeds from
 * state.all_results). Before c49 the seen-set was empty — duplicates from
 * iteration 1 reappeared in iteration 2.
 */
function deduplicateResults(
  results: ResearchResult[],
  accumulated: ResearchResult[] = [],
): ResearchResult[] {
  const seenUrls = new Set<string>();
  const seenTitles: string[] = [];
  // Seed from accumulated results (v1 graph.py:518,551)
  for (const r of accumulated) {
    seenUrls.add(normalizeUrl(r.url));
    if (r.title) seenTitles.push(r.title);
  }
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

/**
 * c49: REPORT_SYSTEM_PROMPT — v1 6-section structured template (graph.py:94-128).
 * Shared by both generateReport (normal completion) and generateFinalReport
 * (finish path) so both produce the same 6-section structure.
 */
const REPORT_SYSTEM_PROMPT = `You are an expert research analyst writing a comprehensive research report.

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
- Write in the same language as the research topic`;

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
    // c49: use the shared 6-section REPORT_SYSTEM_PROMPT (was a 1-line minimal prompt;
    // only generateFinalReport had the rich prompt before — now both paths align to v1).
    system: REPORT_SYSTEM_PROMPT,
    prompt: `Topic: ${state.topic}\n\nResults:\n${context}\n\nWrite a detailed report following the structure above.`,
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
  // c58: periodic lock renewal heartbeat (v1 _extend_lock_periodically,
  // api.py:885-899 runs every 300s). Per-iteration renewal (c46) is insufficient
  // when a single iteration (plan+search+analyze) exceeds the 10min TTL.
  const lockHeartbeat = setInterval(() => renewLock(sessionId), 300_000);

  try {
    // c49: resume start-node selection (v1 _start_node_for_status, graph.py:1013-1028).
    // On the first loop iteration, if resuming at waiting_user/searching with a
    // restored plan, skip re-planning and jump straight to HITL/search.
    let resumeSkipPlan = state.resumeStatus === 'waiting_user' && !!state.searchPlan;
    let resumeSkipHitl = state.resumeStatus === 'searching' && !!state.searchPlan;

    for (let iter = state.iteration; iter <= state.maxIterations && !signal.aborted; iter++) {
      state.iteration = iter;
      // c46: renew lock each iteration to prevent expiry on long runs (v1 _extend_lock_periodically)
      renewLock(sessionId);

      // c49: decide the start node for this iteration (resume-aware).
      // - resumeSkipPlan (first iter only): jump to HITL with restored plan
      // - resumeSkipHitl (first iter only): jump straight to search with restored plan
      // - default: re-plan from scratch
      let plan: SearchPlan;
      if (resumeSkipPlan || resumeSkipHitl) {
        plan = state.searchPlan!;
      } else {
        db()
          .update(researchSessions)
          .set({ status: 'planning', currentIteration: iter })
          .where(eq(researchSessions.id, sessionId))
          .run();

        // 1. Plan
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
      }
      // Resume flags only apply to the first iteration — capture the skip-hitl
      // decision before resetting the flag.
      const skipHitlThisIter = resumeSkipHitl;
      resumeSkipPlan = false;
      resumeSkipHitl = false;

      // 2. HITL (skip on resume from searching — user already approved)
      let decision: HitlDecision;
      if (skipHitlThisIter) {
        // Already approved before resume — jump straight to search execution
        decision = { action: 'approve', plan };
      } else {
        db()
          .update(researchSessions)
          .set({ status: 'waiting_user' })
          .where(eq(researchSessions.id, sessionId))
          .run();

        decision = await waitForApproval(state, plan, signal);
      }

      if (signal.aborted || decision.action === 'cancel') break;
      if (decision.action === 'finish') {
        // finish endpoint already generated+persisted the report — do not overwrite
        return null;
      }
      if (decision.action === 'skip') {
        // c58: v1 graph.py:364 skip → AnalyzeResults (not straight to next plan).
        // Run analyze on accumulated results so the report has analysis signal
        // and the next plan can read suggestedQueries (D5 + D1 feedback loop).
        try {
          state.lastAnalysis = await analyzeResults(state, signal);
        } catch {
          state.lastAnalysis = {
            summary: 'Analysis failed — using fallback',
            coverageEstimate: 0.5,
            needMore: false,
            suggestedQueries: [],
          };
        }
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
      // c58: store analysis so the next plan can read suggestedQueries (D1)
      state.lastAnalysis = analysis;

      // 5. Loop condition
      if (!analysis.needMore || iter >= state.maxIterations) break;
    }

    // If the signal was aborted, the terminating handler (/finish or /cancel)
    // has already set the terminal status (completed/cancelled) and owns the
    // finalReport write. Do not overwrite status here — the handler knows which
    // terminal state applies, the loop does not.
    if (signal.aborted) {
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
  } finally {
    // c58: clear the periodic lock-renewal heartbeat on all exit paths
    clearInterval(lockHeartbeat);
  }
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
 * Reads `currentIteration`, `aggregatedResults`, status, AND restores the
 * in-flight search plan (c49: v1 `_extract_plan_from_steps`,
 * graph.py:945-972, 1009) so the agent continues where it left off —
 * including presenting the existing plan at waiting_user instead of
 * regenerating it (v1 `_start_node_for_status`, graph.py:1013-1028).
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
  const iteration = session.currentIteration ?? 1;

  // c49: restore the in-flight plan + resume status so runResearchCore can
  // skip re-planning when resuming at waiting_user/searching (v1 parity).
  const searchPlan = extractPlanFromSteps(sessionId, iteration);
  const resumeStatus =
    session.status === 'waiting_user' || session.status === 'searching' ? session.status : null;

  return runResearchCore(
    {
      sessionId,
      notebookId: session.notebookId,
      topic: session.topic,
      iteration,
      maxIterations: session.maxIterations,
      results: aggregatedResults,
      searchPlan,
      resumeStatus,
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
    // c49: shared REPORT_SYSTEM_PROMPT (was inline duplicate; now both paths use one constant)
    system: REPORT_SYSTEM_PROMPT,
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

/**
 * c58: synthesize a meaningful fallback report when LLM generation fails
 * (v1 graph.py:811-823 GenerateReport fallback). MUST NOT persist a technical
 * sentinel string like '(report generation failed)' — that passes the export
 * guard (`if (!finalReport)`) and produces a garbage source. Instead, build a
 * minimal Chinese report from accumulated results (or a clear empty-state msg).
 */
export function synthesizeFallbackReport(topic: string, results: ResearchResult[]): string {
  if (results.length === 0) {
    return `# ${topic}\n\n（研究未收集到结果，请尝试调整搜索关键词或检查网络连接后重试。）`;
  }
  const lines = [`# ${topic}`, '', '## 研究结果摘要', ''];
  const top = results.slice(0, 20);
  for (let i = 0; i < top.length; i++) {
    const r = top[i]!;
    const snippet = r.snippet ? r.snippet.slice(0, 200) : '';
    lines.push(`${i + 1}. **${r.title || '(无标题)'}**`);
    lines.push(`   - URL: ${r.url}`);
    if (snippet) lines.push(`   - 摘要: ${snippet}`);
    lines.push('');
  }
  lines.push(
    `> ⚠️ 此报告为系统自动生成的结果摘要（LLM 报告生成失败时的兜底）。共 ${results.length} 条结果，展示前 ${top.length} 条。`,
  );
  return lines.join('\n');
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
 * c49: restore the in-flight search plan from persisted steps (v1
 * `_extract_plan_from_steps`, graph.py:945-972). Prefers a user-modified plan
 * for the target iteration, falls back to the latest generated PLAN step.
 */
function extractPlanFromSteps(sessionId: number, iteration: number): SearchPlan | null {
  const steps = db()
    .select()
    .from(researchSteps)
    .where(eq(researchSteps.sessionId, sessionId))
    .orderBy(researchSteps.id)
    .all()
    .filter((s) => s.iteration === iteration);

  // Prefer user-modified plan (reversed = latest first)
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if (s.type === 'user_input' && s.inputData && typeof s.inputData === 'object') {
      const data = s.inputData as Record<string, unknown>;
      if (data.action === 'modify' && typeof data.plan === 'object') {
        const plan = parseSearchPlan(data.plan as Record<string, unknown>);
        if (plan) return plan;
      }
    }
  }
  // Fall back to latest PLAN step output
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if (s.type === 'plan' && s.outputData && typeof s.outputData === 'object') {
      const plan = parseSearchPlan(s.outputData as Record<string, unknown>);
      if (plan) return plan;
    }
  }
  return null;
}

/** Parse a persisted plan payload into a SearchPlan (defensive). */
function parseSearchPlan(payload: Record<string, unknown>): SearchPlan | null {
  const queries = Array.isArray(payload.queries) ? payload.queries : [];
  const parsed = queries
    .filter((q): q is Record<string, unknown> => typeof q === 'object' && q !== null)
    .map((q) => ({
      query: typeof q.query === 'string' ? q.query : '',
      engine: typeof q.engine === 'string' ? q.engine : 'Web',
      priority: typeof q.priority === 'number' ? q.priority : 1,
      reason: typeof q.reason === 'string' ? q.reason : '',
    }))
    .filter((q) => q.query.length > 0);
  if (parsed.length === 0) return null;
  return {
    queries: parsed,
    reasoning: typeof payload.reasoning === 'string' ? payload.reasoning : '',
  };
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
