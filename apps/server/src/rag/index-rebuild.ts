// c131 r480/r481: async embedding-index rebuild + index status.
//
// Two modes, chosen by dimension state:
//  - notebook: declared dims match the existing table → per-source
//    deleteSourceVectors + indexSource for this notebook's ready sources only.
//  - global: dims changed (vec_chunks is ONE shared vec0 table) → drop and
//    recreate the table at the declared width, then re-embed every notebook's
//    ready sources. Greenfield policy: no in-place vector migration.
//
// Jobs are async by design (user decision 2026-10-13): the endpoint returns a
// handle immediately; retrieval-dependent callers degrade per r482 while
// rebuilding. Jobs left `running` by a restart are marked `interrupted` at
// boot (no auto-resume — self-hosted semantics: re-click).
import { and, desc, eq, or, sql } from 'drizzle-orm';

import { client, db } from '../db/index.ts';
import { indexJobs, sources } from '../db/schema.ts';
import {
  DEFAULT_EMBEDDING_DIM,
  deleteSourceVectors,
  readVecTableDim,
  recreateVecChunks,
} from '../db/vectors.ts';
import { getDefaultEmbeddingModel } from '../shared/config.ts';
import { AppHttpError, ErrorCode } from '../shared/errors.ts';
import { logger } from '../shared/logger.ts';
import { EmbedStrategy } from './embed-strategy.ts';

export type IndexJobMode = 'notebook' | 'global';

/** Declared dims of the default embedding model (fallback 1024, c130 r478). */
function declaredEmbeddingDims(): number {
  return getDefaultEmbeddingModel()?.embedding?.dims ?? DEFAULT_EMBEDDING_DIM;
}

interface ActiveJob {
  jobId: number;
  mode: IndexJobMode;
}

/** In-process active jobs keyed by the requesting notebook id. */
const activeJobs = new Map<number, ActiveJob>();

/**
 * Prune history: keep only the newest job per notebook (r481's lastJob context);
 * `running` rows are never pruned — boot recovery owns those. Bounds the table
 * at roughly one row per notebook plus active jobs.
 */
async function pruneIndexJobs(): Promise<void> {
  await client().rawRun(sql`
    DELETE FROM index_jobs
     WHERE state != 'running'
       AND id NOT IN (SELECT max(id) FROM index_jobs GROUP BY notebook_id)
  `);
}

/** Boot recovery: a `running` row without a live worker means a crash/restart. */
export async function recoverInterruptedJobs(): Promise<void> {
  await client().run(
    db()
      .update(indexJobs)
      .set({ state: 'interrupted', finishedAt: new Date() })
      .where(eq(indexJobs.state, 'running')),
  );
}

export interface IndexState {
  state: 'ready' | 'rebuilding' | 'dim_mismatch' | 'interrupted';
  declaredDims?: number;
  tableDims?: number;
  progress?: { total: number; done: number; failed: number };
  jobId?: number;
  lastJob?: {
    id: number;
    mode: IndexJobMode;
    state: string;
    total: number;
    done: number;
    failed: number;
  };
}

/**
 * Compute the notebook-visible index state (r481). Rebuilding wins over
 * everything; then dim mismatch; then a latest-job interrupted marker; else
 * ready. The latest job row is always attached for UI context.
 */
export async function getIndexState(notebookId: number): Promise<IndexState> {
  const active =
    activeJobs.get(notebookId) ?? [...activeJobs.values()].find((j) => j.mode === 'global');
  if (active) {
    const row = await client().get(
      db().select().from(indexJobs).where(eq(indexJobs.id, active.jobId)),
    );
    return {
      state: 'rebuilding',
      jobId: active.jobId,
      progress: { total: row?.total ?? 0, done: row?.done ?? 0, failed: row?.failed ?? 0 },
    };
  }

  const tableDims = await readVecTableDim(db());
  const declared = declaredEmbeddingDims();
  if (tableDims !== null && tableDims !== declared) {
    return { state: 'dim_mismatch', declaredDims: declared, tableDims };
  }

  const lastJob = await client().get(
    db()
      .select()
      .from(indexJobs)
      .where(or(eq(indexJobs.notebookId, notebookId), eq(indexJobs.mode, 'global')))
      .orderBy(desc(indexJobs.id)),
  );
  const toLast = (row: typeof lastJob) =>
    row
      ? {
          id: row.id,
          mode: row.mode as IndexJobMode,
          state: row.state,
          total: row.total,
          done: row.done,
          failed: row.failed,
        }
      : undefined;
  if (lastJob?.state === 'interrupted') {
    return { state: 'interrupted', jobId: lastJob.id, lastJob: toLast(lastJob) };
  }
  return { state: 'ready', lastJob: toLast(lastJob) };
}

/**
 * Start an async rebuild for a notebook (r480). Reentry-guarded: a second
 * start while a job covers this notebook (its own, or any global) is a 409.
 */
export async function startIndexRebuild(
  notebookId: number,
): Promise<{ jobId: number; mode: IndexJobMode }> {
  if (activeJobs.has(notebookId) || [...activeJobs.values()].some((j) => j.mode === 'global')) {
    throw new AppHttpError(
      ErrorCode.CONFLICT,
      `笔记本 ${notebookId} 的索引重建任务正在进行，请等待完成后再试`,
    );
  }
  // Reserve the slot SYNCHRONOUSLY, before the first await — otherwise the
  // guard is check-then-act and two concurrent POSTs (double-tab / double
  // click) would both pass it and run overlapping rebuilds. Reserving as
  // 'global' is the conservative choice: until the real mode is determined,
  // every notebook reports rebuilding. jobId -1 means the row insert is still
  // in flight (progress reads as 0/0/0).
  activeJobs.set(notebookId, { jobId: -1, mode: 'global' });
  try {
    await pruneIndexJobs();

    const tableDims = await readVecTableDim(db());
    const declared = declaredEmbeddingDims();
    const mode: IndexJobMode = tableDims !== null && tableDims === declared ? 'notebook' : 'global';

    const job = (await client().get(
      db().insert(indexJobs).values({ notebookId, mode, state: 'running' }).returning(),
    ))!;
    activeJobs.set(notebookId, { jobId: job.id, mode });

    void runRebuild(job.id, mode, notebookId).catch(async (error) => {
      try {
        await client().run(
          db()
            .update(indexJobs)
            .set({ state: 'failed', error: String(error), finishedAt: new Date() })
            .where(eq(indexJobs.id, job.id)),
        );
      } catch (dbError) {
        logger.error('[index-rebuild] failed to persist job failure:', dbError, error);
      }
    });
    return { jobId: job.id, mode };
  } catch (error) {
    activeJobs.delete(notebookId);
    throw error;
  }
}

async function runRebuild(
  jobId: number,
  mode: IndexJobMode,
  requestedNotebookId: number,
): Promise<void> {
  try {
    if (mode === 'global') {
      // Destructive by policy (greenfield rebuild): all vectors go away, the
      // table comes back at the declared width, every ready source re-embeds.
      await recreateVecChunks(db(), declaredEmbeddingDims());
    }

    const targets =
      mode === 'notebook'
        ? await client().all(
            db()
              .select({ id: sources.id, notebookId: sources.notebookId })
              .from(sources)
              .where(and(eq(sources.notebookId, requestedNotebookId), eq(sources.status, 'ready'))),
          )
        : await client().all(
            db()
              .select({ id: sources.id, notebookId: sources.notebookId })
              .from(sources)
              .where(eq(sources.status, 'ready')),
          );

    await client().run(
      db().update(indexJobs).set({ total: targets.length }).where(eq(indexJobs.id, jobId)),
    );

    const strategy = new EmbedStrategy();
    let done = 0;
    let failed = 0;
    for (const s of targets) {
      try {
        await deleteSourceVectors(db(), s.id);
        // indexSource bumps vector_epoch per source (r480 completion bump is
        // covered by the last per-source bump for every touched notebook).
        await strategy.indexSource(s.id, s.notebookId);
        done++;
      } catch (error) {
        failed++;
        // Per-source failures keep the job running (partial progress beats
        // all-or-nothing), but each one must be attributable afterwards —
        // e.g. embedding model not configured fails EVERY source the same way.
        logger.warn(`[index-rebuild] source ${s.id} (notebook ${s.notebookId}) failed:`, error);
      }
      await client().run(
        db().update(indexJobs).set({ done, failed }).where(eq(indexJobs.id, jobId)),
      );
    }

    // Every source failing is a failed rebuild (typical root cause: embedding
    // gateway/model unavailable) — reporting 'succeeded' there would hide it.
    const allFailed = targets.length > 0 && done === 0;
    await client().run(
      db()
        .update(indexJobs)
        .set({
          done,
          failed,
          state: allFailed ? 'failed' : 'succeeded',
          ...(allFailed ? { error: `所有 ${failed} 个来源重嵌均失败（详见服务端日志）` } : {}),
          finishedAt: new Date(),
        })
        .where(eq(indexJobs.id, jobId)),
    );
  } finally {
    activeJobs.delete(requestedNotebookId);
    // Post-completion pass: the job just finished is now the newest for its
    // notebook, so the previous latest can go. Failed jobs keep their row
    // (state is still 'running' here until the outer catch marks it).
    await pruneIndexJobs();
  }
}

/**
 * r482 caller guards. `rebuilding` covers a live job for this notebook or any
 * global job; `interrupted` means the index is stale/untrustworthy the same
 * way. `dim_mismatch` is deliberately NOT included — the deeper
 * EMBEDDING_DIM_MISMATCH path already errors precisely there.
 */
export async function isIndexRebuilding(notebookId: number): Promise<boolean> {
  const state = await getIndexState(notebookId);
  return state.state === 'rebuilding' || state.state === 'interrupted';
}

/** Hard-prerequisite callers (outputs / studio generation) fail fast (409). */
export async function assertIndexNotRebuilding(notebookId: number): Promise<void> {
  if (await isIndexRebuilding(notebookId)) {
    throw new AppHttpError(
      ErrorCode.INDEX_REBUILDING,
      `笔记本 ${notebookId} 的索引正在重建（或上次重建被中断），请等待完成后再生成`,
    );
  }
}
