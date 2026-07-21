import type { ResearchDepth } from '@crystalith/shared';
import { Typography } from '@material-tailwind/react';
import { Psychology as PsychologyIcon } from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import { t } from '../../../../shared/i18n';
import { TestIds, tid } from '../../../../shared/testids';
import { formatRelativeTime } from '../../shared/utils';
import DeepResearchRunDetail from './DeepResearchRunDetail';
import {
  DEFAULT_RESEARCH_CREATE_FORM,
  researchStartBlockedReason,
  type ResearchCreateFormState,
} from './researchCreateGate';
import { useResearchRuns } from './useResearchRuns';

const DEPTHS: ResearchDepth[] = ['shallow', 'medium', 'deep'];

interface SourceOption {
  id: number;
  filename: string;
  status: string;
}

export interface DeepResearchDeskProps {
  notebookId: number | undefined;
  isConnected: boolean;
  onDetailOpenChange?: (open: boolean) => void;
}

export default function DeepResearchDesk({
  notebookId,
  isConnected,
  onDetailOpenChange,
}: DeepResearchDeskProps) {
  const [form, setForm] = useState<ResearchCreateFormState>(DEFAULT_RESEARCH_CREATE_FORM);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [detailRunId, setDetailRunId] = useState<number | null>(null);

  const { runs, isLoading, error, creating, createRun, refresh, setError } = useResearchRuns({
    notebookId,
    enabled: true,
    isConnected,
  });

  const readySources = useMemo(() => sources.filter((s) => s.status === 'ready'), [sources]);

  useEffect(() => {
    onDetailOpenChange?.(detailRunId != null);
  }, [detailRunId, onDetailOpenChange]);

  useEffect(() => {
    if (!notebookId || !isConnected) {
      setSources([]);
      setSourcesLoaded(false);
      return;
    }
    let cancelled = false;
    setSourcesLoaded(false);
    void api.v2
      .notebooks({ nid: notebookId })
      .sources.get({ query: { offset: 0, limit: 200 } })
      .then((r) => {
        if (cancelled) return;
        if (r.error) {
          setError(parseServerError(r.error).message);
          setSourcesLoaded(true);
          return;
        }
        const items = (r.data?.items ?? []) as Array<{
          id: number;
          filename?: string;
          name?: string;
          status?: string;
        }>;
        setSources(
          items.map((s) => ({
            id: Number(s.id),
            filename: s.filename || s.name || `#${s.id}`,
            status: s.status ?? 'ready',
          })),
        );
        setSourcesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [notebookId, isConnected, setError]);

  // When notebook has no ready sources, default off "use notebook sources" so Start can enable with web.
  useEffect(() => {
    if (!sourcesLoaded) return;
    if (readySources.length > 0) return;
    setForm((prev) => {
      if (!prev.useNotebookSources) return prev;
      return { ...prev, useNotebookSources: false, sourceIds: [] };
    });
  }, [sourcesLoaded, readySources.length]);

  // Drop selected ids that are no longer ready.
  useEffect(() => {
    const readyIds = new Set(readySources.map((s) => s.id));
    setForm((prev) => {
      const nextIds = prev.sourceIds.filter((id) => readyIds.has(id));
      if (nextIds.length === prev.sourceIds.length) return prev;
      return { ...prev, sourceIds: nextIds };
    });
  }, [readySources]);

  const blockReason = researchStartBlockedReason(form);
  const startDisabled = !notebookId || !isConnected || creating || blockReason !== null;

  const handleStart = useCallback(async () => {
    if (startDisabled) return;
    const run = await createRun({
      topic: form.topic.trim(),
      useNotebookSources: form.useNotebookSources,
      allowWeb: form.allowWeb,
      sourceIds: form.useNotebookSources ? form.sourceIds : undefined,
      depth: form.depth,
    });
    if (run) {
      setForm((prev) => ({ ...prev, topic: '' }));
      setDetailRunId(run.id);
    }
  }, [startDisabled, createRun, form]);

  const toggleSource = (id: number) => {
    setForm((prev) => {
      const has = prev.sourceIds.includes(id);
      return {
        ...prev,
        sourceIds: has ? prev.sourceIds.filter((x) => x !== id) : [...prev.sourceIds, id],
      };
    });
  };

  return (
    <div className="flex flex-col gap-4" {...tid(TestIds.deepResearchDesk)}>
      <div className="flex items-center gap-2">
        <PsychologyIcon className="text-indigo-500" style={{ fontSize: 20 }} />
        <Typography variant="small" className="font-semibold text-gray-800 dark:text-slate-100">
          {t('research.desk.title')}
        </Typography>
      </div>

      {!notebookId ? (
        <Typography variant="small" className="text-amber-600 text-xs">
          {t('research.desk.require_notebook')}
        </Typography>
      ) : null}
      {!isConnected ? (
        <Typography variant="small" className="text-amber-600 text-xs">
          {t('research.desk.disconnected')}
        </Typography>
      ) : null}

      <div className="flex flex-col gap-2">
        <textarea
          className="w-full min-h-[72px] px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500/25 resize-y"
          placeholder={t('research.desk.topic_placeholder')}
          value={form.topic}
          {...tid(TestIds.researchTopicInput)}
          disabled={!notebookId || !isConnected}
          onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
        />

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.useNotebookSources}
              onChange={(e) => setForm((p) => ({ ...p, useNotebookSources: e.target.checked }))}
              disabled={!notebookId || !isConnected}
            />
            {t('research.desk.use_sources')}
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.allowWeb}
              onChange={(e) => setForm((p) => ({ ...p, allowWeb: e.target.checked }))}
              disabled={!notebookId || !isConnected}
            />
            {t('research.desk.allow_web')}
          </label>
          <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-slate-800 p-0.5">
            {DEPTHS.map((d) => (
              <button
                key={d}
                type="button"
                className={
                  form.depth === d
                    ? 'px-2.5 py-1 rounded-md text-[11px] font-medium bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                    : 'px-2.5 py-1 rounded-md text-[11px] text-gray-500'
                }
                onClick={() => setForm((p) => ({ ...p, depth: d }))}
                disabled={!notebookId || !isConnected}
              >
                {t(`research.depth.${d}` as 'research.depth.medium')}
              </button>
            ))}
          </div>
        </div>

        {form.useNotebookSources ? (
          <div
            className="max-h-28 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700 p-2 flex flex-col gap-1"
            {...tid(TestIds.researchSourceMultiSelect)}
          >
            {readySources.length === 0 ? (
              <span className="text-[11px] text-amber-700 dark:text-amber-400">
                {t('research.desk.no_ready_sources')}
              </span>
            ) : (
              readySources.map((s) => (
                <label key={s.id} className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.sourceIds.includes(s.id)}
                    onChange={() => toggleSource(s.id)}
                    disabled={!notebookId || !isConnected}
                  />
                  <span className="truncate">{s.filename}</span>
                </label>
              ))
            )}
          </div>
        ) : null}

        <button
          type="button"
          className={
            startDisabled
              ? 'self-start px-4 py-2 rounded-lg text-sm bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed'
              : 'self-start px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-700 text-white'
          }
          disabled={startDisabled}
          {...tid(TestIds.researchStartButton)}
          onClick={() => void handleStart()}
        >
          {creating ? t('research.desk.starting') : t('research.desk.start')}
        </button>
        {blockReason && notebookId && isConnected && !creating ? (
          <Typography
            variant="small"
            className="text-[11px] text-amber-700 dark:text-amber-400"
            {...tid(TestIds.researchStartHint)}
          >
            {t(`research.desk.blocked.${blockReason}` as 'research.desk.blocked.topic')}
          </Typography>
        ) : null}
      </div>

      {error ? (
        <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2" {...tid(TestIds.researchRunQueue)}>
        <div className="text-xs font-medium text-gray-600 dark:text-slate-300">
          {t('research.desk.queue')}
          {isLoading ? ` · ${t('common.loading')}` : null}
        </div>
        {runs.length === 0 && !isLoading ? (
          <Typography variant="small" className="text-[11px] text-gray-400">
            {t('research.desk.queue_empty')}
          </Typography>
        ) : (
          runs.map((run) => (
            <button
              key={run.id}
              type="button"
              className="text-left rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 hover:border-indigo-300 transition-colors"
              {...tid(TestIds.researchRunCard)}
              onClick={() => setDetailRunId(run.id)}
            >
              <div className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">
                {run.topic}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
                <span>{t(`research.status.${run.status}` as 'research.status.queued')}</span>
                <span>{t(`research.depth.${run.depth}` as 'research.depth.medium')}</span>
                <span>{formatRelativeTime(run.updatedAt)}</span>
                <span>
                  {run.searchesUsed}/{run.maxSearches}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      <DeepResearchRunDetail
        open={detailRunId != null}
        notebookId={notebookId}
        runId={detailRunId}
        onClose={() => {
          setDetailRunId(null);
          void refresh();
        }}
        onRunUpdated={() => void refresh()}
      />
    </div>
  );
}

/** Exported for Vitest — create disable conditions. */
export { canStartResearch } from './researchCreateGate';
