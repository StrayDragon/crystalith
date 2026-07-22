import type {
  ResearchArtifactRef,
  ResearchConfirmBody,
  ResearchGraphPatch,
  ResearchNodeActionProposal,
  ResearchNodePatchBody,
  ResearchProgressEvent,
  ResearchReport,
  ResearchReportView,
  ResearchRevision,
  ResearchRun,
  ResearchStreamEvent,
} from '@crystalith/shared';
import { ResearchStreamEventSchema } from '@crystalith/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import { streamRequest } from '../../../../api/stream';
import { t } from '../../../../shared/i18n';
import { toast } from '../../../../shared/toast';
import { applyGraphPatch } from './applyGraphPatch';
import { isTerminalResearchStatus } from './researchCreateGate';
import { surfaceResearchError } from './researchErrors';

export function useResearchRunDetail({
  notebookId,
  runId,
  open,
  onRunUpdated,
}: {
  notebookId: number | undefined;
  runId: number | null;
  open: boolean;
  onRunUpdated?: () => void;
}) {
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const onRunUpdatedRef = useRef(onRunUpdated);
  onRunUpdatedRef.current = onRunUpdated;

  const applyRun = useCallback((next: ResearchRun) => {
    setRun(next);
  }, []);

  const fetchRun = useCallback(async () => {
    if (!notebookId || runId == null) return null;
    setIsLoading(true);
    try {
      const { data, error: getErr } = await api.v2
        .notebooks({ nid: notebookId })
        .research({ rid: runId })
        .get();
      if (getErr) {
        setError(surfaceResearchError(getErr));
        return null;
      }
      const next = data as ResearchRun | null;
      if (next) applyRun(next);
      setError('');
      return next;
    } catch (error) {
      setError(surfaceResearchError(error));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [notebookId, runId, applyRun]);

  useEffect(() => {
    if (!open || !notebookId || runId == null) {
      setRun(null);
      setError('');
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }
    void fetchRun();
  }, [open, notebookId, runId, fetchRun]);

  useEffect(() => {
    if (!open || !notebookId || runId == null) return;
    if (run && isTerminalResearchStatus(run.status)) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    void (async () => {
      try {
        for await (const evt of streamRequest(
          `/v2/notebooks/${notebookId}/research/${runId}/stream`,
          { signal: ac.signal },
        )) {
          if (ac.signal.aborted) break;
          const parsed = ResearchStreamEventSchema.safeParse({
            event: evt.event,
            data: evt.data,
          });
          if (!parsed.success) continue;
          const streamEvt: ResearchStreamEvent = parsed.data;
          setRun((prev) => {
            if (!prev) return prev;
            switch (streamEvt.event) {
              case 'status':
                return { ...prev, status: streamEvt.data.status };
              case 'graph_patch': {
                const next = applyGraphPatch(
                  { nodes: prev.nodes, edges: prev.edges },
                  streamEvt.data as ResearchGraphPatch,
                );
                return { ...prev, nodes: next.nodes, edges: next.edges };
              }
              case 'confirm':
                return {
                  ...prev,
                  status: 'awaiting_confirm',
                  confirmKind: streamEvt.data.kind,
                  confirmBranchNodeId: streamEvt.data.branchNodeId ?? null,
                };
              case 'report_ready':
                void fetchRun().then(() => onRunUpdatedRef.current?.());
                return prev;
              case 'error':
                setError(streamEvt.data.message);
                toast.error(streamEvt.data.message);
                return prev;
              default:
                return prev;
            }
          });
          if (streamEvt.event === 'status' && isTerminalResearchStatus(streamEvt.data.status)) {
            onRunUpdatedRef.current?.();
            void fetchRun();
            break;
          }
          if (streamEvt.event === 'confirm' || streamEvt.event === 'graph_patch') {
            onRunUpdatedRef.current?.();
          }
        }
      } catch (error) {
        if (ac.signal.aborted) return;
        const msg = parseServerError(error).message;
        if (msg && msg !== 'Unknown error') {
          setError(msg);
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [open, notebookId, runId, run?.status, fetchRun]);

  const withBusy = useCallback(
    async (fn: () => Promise<ResearchRun | null>): Promise<ResearchRun | null> => {
      setBusy(true);
      try {
        const next = await fn();
        if (next) {
          applyRun(next);
          onRunUpdatedRef.current?.();
        }
        return next;
      } finally {
        setBusy(false);
      }
    },
    [applyRun],
  );

  const withBusyOnly = async <T>(fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };

  const confirm = useCallback(
    async (body: ResearchConfirmBody) => {
      if (!notebookId || runId == null) return null;
      return withBusy(async () => {
        const { data, error: apiErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ rid: runId })
          .confirm.post(body);
        if (apiErr) {
          setError(surfaceResearchError(apiErr));
          return null;
        }
        return data as ResearchRun;
      });
    },
    [notebookId, runId, withBusy],
  );

  const cancel = useCallback(async () => {
    if (!notebookId || runId == null) return null;
    return withBusy(async () => {
      const { data, error: apiErr } = await api.v2
        .notebooks({ nid: notebookId })
        .research({ rid: runId })
        .cancel.post();
      if (apiErr) {
        setError(surfaceResearchError(apiErr));
        return null;
      }
      toast.info(t('research.toast.cancelled'));
      return data as ResearchRun;
    });
  }, [notebookId, runId, withBusy]);

  const prune = useCallback(
    async (nodeId: string) => {
      if (!notebookId || runId == null) return null;
      return withBusy(async () => {
        const { data, error: apiErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ rid: runId })
          .nodes({ nodeId })
          .prune.post();
        if (apiErr) {
          setError(surfaceResearchError(apiErr));
          return null;
        }
        return data as ResearchRun;
      });
    },
    [notebookId, runId, withBusy],
  );

  const fork = useCallback(
    async (nodeId: string, hint?: string) => {
      if (!notebookId || runId == null) return null;
      return withBusy(async () => {
        const { data, error: apiErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ rid: runId })
          .nodes({ nodeId })
          .fork.post({ hint });
        if (apiErr) {
          setError(surfaceResearchError(apiErr));
          return null;
        }
        return data as ResearchRun;
      });
    },
    [notebookId, runId, withBusy],
  );

  const patchNode = useCallback(
    async (nodeId: string, body: ResearchNodePatchBody) => {
      if (!notebookId || runId == null) return null;
      return withBusy(async () => {
        const { data, error: apiErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ rid: runId })
          .nodes({ nodeId })
          .patch(body);
        if (apiErr) {
          setError(surfaceResearchError(apiErr));
          return null;
        }
        return data as ResearchRun;
      });
    },
    [notebookId, runId, withBusy],
  );

  /** C1 — short-lived node chat SSE; proposals only (no auto graph mutate). */
  const chatNode = useCallback(
    async (
      nodeId: string,
      message: string,
      opts?: {
        signal?: AbortSignal;
        onChunk?: (text: string) => void;
        onProposal?: (proposal: ResearchNodeActionProposal) => void;
      },
    ): Promise<{ text: string; proposals: ResearchNodeActionProposal[] } | null> => {
      if (!notebookId || runId == null) return null;
      let text = '';
      const proposals: ResearchNodeActionProposal[] = [];
      try {
        for await (const ev of streamRequest(
          `/v2/notebooks/${notebookId}/research/${runId}/nodes/${encodeURIComponent(nodeId)}/chat`,
          { method: 'POST', body: { message }, signal: opts?.signal },
        )) {
          if (ev.event === 'chunk') {
            const chunk = (ev.data as { text?: string })?.text ?? '';
            text += chunk;
            opts?.onChunk?.(text);
          } else if (ev.event === 'proposal') {
            const proposal = ev.data as ResearchNodeActionProposal;
            proposals.push(proposal);
            opts?.onProposal?.(proposal);
          } else if (ev.event === 'done') {
            const done = ev.data as { proposals?: ResearchNodeActionProposal[] };
            if (done.proposals?.length) {
              proposals.length = 0;
              proposals.push(...done.proposals);
            }
          } else if (ev.event === 'error') {
            const err = ev.data as { message?: string };
            setError(err.message ?? 'chat error');
            return null;
          }
        }
        return { text, proposals };
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return null;
        setError(surfaceResearchError(error));
        return null;
      }
    },
    [notebookId, runId],
  );

  const listProgress = useCallback(
    async (afterSeq = 0, limit = 100) => {
      if (!notebookId || runId == null) return null;
      const { data, error: apiErr } = await api.v2
        .notebooks({ nid: notebookId })
        .research({ rid: runId })
        .progress.get({ query: { afterSeq, limit } });
      if (apiErr) {
        setError(surfaceResearchError(apiErr));
        return null;
      }
      return data as { items: ResearchProgressEvent[]; nextAfterSeq?: number };
    },
    [notebookId, runId],
  );

  const listRevisions = useCallback(async () => {
    if (!notebookId || runId == null) return null;
    const { data, error: apiErr } = await api.v2
      .notebooks({ nid: notebookId })
      .research({ rid: runId })
      .revisions.get();
    if (apiErr) {
      setError(surfaceResearchError(apiErr));
      return null;
    }
    return data as { items: ResearchRevision[] };
  }, [notebookId, runId]);

  const createRevision = useCallback(
    async (label?: string) => {
      if (!notebookId || runId == null) return null;
      return withBusyOnly(async () => {
        const { data, error: apiErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ rid: runId })
          .revisions.post({ label, from: 'canonical' });
        if (apiErr) {
          setError(surfaceResearchError(apiErr));
          return null;
        }
        onRunUpdatedRef.current?.();
        return data as ResearchRevision;
      });
    },
    [notebookId, runId],
  );

  const restoreRevision = useCallback(
    async (revId: string) => {
      if (!notebookId || runId == null) return null;
      return withBusy(async () => {
        const { data, error: apiErr } = await api.v2
          .notebooks({ nid: notebookId })
          .research({ rid: runId })
          .revisions({ revId })
          .restore.post();
        if (apiErr) {
          setError(surfaceResearchError(apiErr));
          return null;
        }
        return data as ResearchRun;
      });
    },
    [notebookId, runId, withBusy],
  );

  const getReportView = useCallback(async () => {
    if (!notebookId || runId == null) return null;
    const { data, error: apiErr } = await api.v2
      .notebooks({ nid: notebookId })
      .research({ rid: runId })
      .report.get();
    if (apiErr) {
      setError(surfaceResearchError(apiErr));
      return null;
    }
    return data as ResearchReportView;
  }, [notebookId, runId]);

  const putWorkingReport = useCallback(
    async (report: ResearchReport) => {
      if (!notebookId || runId == null) return null;
      return withBusyOnly(async () => {
        const runApi = api.v2.notebooks({ nid: notebookId }).research({ rid: runId });
        const { data, error: apiErr } = await runApi.report.working.put({ report });
        if (apiErr) {
          setError(surfaceResearchError(apiErr));
          return null as ResearchReportView | null;
        }
        return data as ResearchReportView;
      });
    },
    [notebookId, runId],
  );

  const discardWorkingReport = useCallback(async () => {
    if (!notebookId || runId == null) return null;
    return withBusyOnly(async () => {
      const runApi = api.v2.notebooks({ nid: notebookId }).research({ rid: runId });
      const { data, error: apiErr } = await runApi.report.working.delete();
      if (apiErr) {
        setError(surfaceResearchError(apiErr));
        return null as ResearchReportView | null;
      }
      return data as ResearchReportView;
    });
  }, [notebookId, runId]);

  const convertToNote = useCallback(
    async (artifact: ResearchArtifactRef) => {
      if (!notebookId || runId == null) return null;
      setBusy(true);
      try {
        const runApi = api.v2.notebooks({ nid: notebookId }).research({ rid: runId });
        const { data, error: apiErr } = await runApi['convert-to-note'].post({ artifact });
        if (apiErr) {
          toast.error(surfaceResearchError(apiErr));
          return null;
        }
        toast.success(t('research.toast.convert_note_success'));
        return data;
      } catch (error) {
        toast.error(surfaceResearchError(error));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [notebookId, runId],
  );

  const convertToSource = useCallback(
    async (artifact: ResearchArtifactRef) => {
      if (!notebookId || runId == null) return null;
      setBusy(true);
      try {
        const runApi = api.v2.notebooks({ nid: notebookId }).research({ rid: runId });
        const { data, error: apiErr } = await runApi['convert-to-source'].post({ artifact });
        if (apiErr) {
          toast.error(surfaceResearchError(apiErr));
          return null;
        }
        toast.success(t('research.toast.convert_source_success'));
        return data;
      } catch (error) {
        toast.error(surfaceResearchError(error));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [notebookId, runId],
  );

  return {
    run,
    isLoading,
    error,
    busy,
    setError,
    fetchRun,
    confirm,
    cancel,
    prune,
    fork,
    patchNode,
    chatNode,
    listProgress,
    listRevisions,
    createRevision,
    restoreRevision,
    getReportView,
    putWorkingReport,
    discardWorkingReport,
    convertToNote,
    convertToSource,
  };
}
