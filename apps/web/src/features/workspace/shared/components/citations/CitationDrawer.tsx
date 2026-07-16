import {
  Close as CloseIcon,
  MyLocation as LocateIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../../../../../api/eden';
import type { CitationContextResponse } from '../../../../../api/shared-types';
import { useLayer } from '../../../../../shared/layer';
import { useWorkspaceStore } from '../../state/workspaceStore';
import type { Citation } from '../../types';

interface CitationDrawerProps {
  open: boolean;
  citation: Citation | null;
  onClose: () => void;
  onLocateSource?: (citation: Citation) => void;
  onOpenSource?: (citation: Citation) => void;
  elevated?: boolean;
}

function formatChunkMeta(
  chunkIndex: number,
  pageNumber?: number | null,
  paragraphIndex?: number | null,
) {
  const parts: string[] = [`Chunk #${chunkIndex}`];
  if (typeof pageNumber === 'number') parts.push(`第 ${pageNumber} 页`);
  if (typeof paragraphIndex === 'number') parts.push(`段落 ${paragraphIndex}`);
  return parts.join(' · ');
}

function ContextChunkBlock({
  title,
  text,
  muted = false,
}: {
  title: string;
  text: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border ${muted ? 'border-gray-200 bg-gray-50/60 dark:border-slate-700 dark:bg-slate-800/40' : 'border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20'}`}
    >
      <div className="px-3 py-2 border-b border-gray-200/70 dark:border-slate-700/60">
        <div
          className={`text-xs font-semibold ${muted ? 'text-gray-700 dark:text-slate-200' : 'text-blue-700 dark:text-blue-200'}`}
        >
          {title}
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div
          className={`text-xs leading-relaxed whitespace-pre-wrap ${muted ? 'text-gray-600 dark:text-slate-300' : 'text-gray-800 dark:text-slate-100'}`}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

export default function CitationDrawer({
  open,
  citation,
  onClose,
  onLocateSource,
  onOpenSource,
  elevated = false,
}: CitationDrawerProps) {
  const notebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const isConnected = connectionState === 'live';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [context, setContext] = useState<CitationContextResponse | null>(null);

  const { style: modalStyle } = useLayer('modal', elevated ? 12 : 0);

  const title = citation?.sourceTitle ?? '引用详情';

  const handleLocate = useCallback(() => {
    if (!citation) return;
    onLocateSource?.(citation);
  }, [citation, onLocateSource]);

  const handleOpenSource = useCallback(() => {
    if (!citation) return;
    onOpenSource?.(citation);
  }, [citation, onOpenSource]);

  useEffect(() => {
    if (!open) {
      setContext(null);
      setError('');
      setLoading(false);
      return;
    }

    if (!citation) {
      setContext(null);
      setError('');
      setLoading(false);
      return;
    }

    if (!citation.chunkId) {
      setContext(null);
      setError('该引用缺少 chunkId，无法拉取上下文。');
      setLoading(false);
      return;
    }

    if (!notebookId || !isConnected) {
      setContext(null);
      setError('未连接到后端服务，无法拉取引用上下文。');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setContext(null);

    const fetchContext = async () => {
      try {
        const { data, error: fetchErr } = await api.v2
          .notebooks({ nid: notebookId })
          .citations.context.get({
            query: { chunk_id: String(citation.chunkId), before: '1', after: '1' },
          });
        if (fetchErr) throw new Error(String(fetchErr));
        setContext(data as unknown as CitationContextResponse);
      } catch (error) {
        setError((error as Error)?.message || '加载引用上下文失败');
      } finally {
        setLoading(false);
      }
    };
    void fetchContext();
  }, [open, citation, notebookId, isConnected]);

  const headerMeta = useMemo(() => {
    if (context) {
      const chunk = context.citation;
      return formatChunkMeta(chunk.chunk_index, chunk.page_number, chunk.paragraph_index);
    }
    if (citation) {
      return formatChunkMeta(citation.chunkIndex, citation.pageNumber, citation.paragraphIndex);
    }
    return '';
  }, [context, citation]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm relative"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label="引用上下文"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        onClick={onClose}
        aria-label="关闭引用上下文"
      />
      <div className="absolute right-0 top-0 z-10 h-full w-full max-w-[520px] bg-white shadow-2xl dark:bg-slate-900 border-l border-gray-200 dark:border-slate-700">
        <div className="flex items-start justify-between gap-3 px-4 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate dark:text-slate-100">
              {title}
            </div>
            {headerMeta ? (
              <div className="mt-1 text-[11px] font-medium text-gray-500 dark:text-slate-300 truncate">
                {headerMeta}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            onClick={onClose}
            aria-label="关闭"
          >
            <CloseIcon style={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800">
          <div className="text-xs font-medium text-gray-500 dark:text-slate-300 truncate">
            {citation?.snippet ? `"${citation.snippet}"` : '—'}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onLocateSource && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={handleLocate}
                aria-label="定位到来源"
              >
                <LocateIcon style={{ fontSize: 14 }} />
                定位来源
              </button>
            )}
            {onOpenSource && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={handleOpenSource}
                aria-label="打开来源详情"
              >
                <OpenInNewIcon style={{ fontSize: 14 }} />
                打开来源
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-4 overflow-y-auto h-[calc(100%-122px)]">
          {loading ? (
            <div className="text-sm text-gray-500 dark:text-slate-300">正在加载引用上下文…</div>
          ) : null}
          {error ? <div className="text-sm text-red-600 dark:text-red-300">{error}</div> : null}

          {!loading && !error && context ? (
            <div className="flex flex-col gap-3">
              {context.before.map((chunk: Record<string, unknown>) => (
                <ContextChunkBlock
                  key={chunk.chunk_id as string}
                  title={`上文 · ${formatChunkMeta(chunk.chunk_index as number, chunk.page_number as number | null, chunk.paragraph_index as number | null)}`}
                  text={chunk.text as string}
                  muted
                />
              ))}

              <ContextChunkBlock
                title={`当前引用 · ${formatChunkMeta(context.chunk.chunk_index, context.chunk.page_number, context.chunk.paragraph_index)}`}
                text={context.chunk.text}
              />

              {context.after.map((chunk: Record<string, unknown>) => (
                <ContextChunkBlock
                  key={chunk.chunk_id as string}
                  title={`下文 · ${formatChunkMeta(chunk.chunk_index as number, chunk.page_number as number | null, chunk.paragraph_index as number | null)}`}
                  text={chunk.text as string}
                  muted
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
