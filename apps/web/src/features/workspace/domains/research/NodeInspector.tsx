import type { ResearchNode } from '@crystalith/shared';
import { Typography } from '@material-tailwind/react';
import { useState } from 'react';

import ConfirmPopover from '../../../../shared/ConfirmPopover';
import { t } from '../../../../shared/i18n';
import { TestIds, tid } from '../../../../shared/testids';

export interface NodeInspectorProps {
  node: ResearchNode | null;
  readOnly: boolean;
  busy?: boolean;
  onPrune: (nodeId: string) => void;
  onFork: (nodeId: string, hint?: string) => void;
  onConvertNote: (nodeId: string) => void;
  onConvertSource: (nodeId: string) => void;
  onClose: () => void;
}

export default function NodeInspector({
  node,
  readOnly,
  busy,
  onPrune,
  onFork,
  onConvertNote,
  onConvertSource,
  onClose,
}: NodeInspectorProps) {
  const [hint, setHint] = useState('');

  if (!node) return null;

  return (
    <aside
      className="w-64 shrink-0 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 flex flex-col gap-3 overflow-y-auto"
      {...tid(TestIds.researchNodeInspector)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <Typography variant="small" className="font-semibold text-gray-900 dark:text-slate-100">
            {node.title}
          </Typography>
          <div className="text-[11px] text-gray-500 mt-0.5">{node.conclusionStatus}</div>
        </div>
        <button
          type="button"
          className="text-xs text-gray-400 hover:text-gray-600"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ×
        </button>
      </div>
      {node.summary ? (
        <p className="text-xs text-gray-600 dark:text-slate-300 whitespace-pre-wrap">
          {node.summary}
        </p>
      ) : null}
      {node.query ? (
        <p className="text-[11px] text-gray-500 font-mono break-all">{node.query}</p>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-col gap-2 mt-auto">
          <label className="text-[11px] text-gray-500">
            {t('research.inspector.fork_hint')}
            <input
              className="mt-1 w-full h-8 px-2 rounded border border-gray-200 dark:border-slate-600 text-xs bg-transparent"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder={t('research.inspector.fork_hint_placeholder')}
              disabled={busy}
            />
          </label>
          <ConfirmPopover
            message={t('research.inspector.fork_confirm')}
            onConfirm={() => onFork(node.id, hint.trim() || undefined)}
            disabled={busy}
          >
            <button
              type="button"
              className="w-full h-8 rounded-lg text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              disabled={busy}
            >
              {t('research.inspector.fork')}
            </button>
          </ConfirmPopover>
          <ConfirmPopover
            message={t('research.inspector.prune_confirm')}
            onConfirm={() => onPrune(node.id)}
            disabled={busy}
          >
            <button
              type="button"
              className="w-full h-8 rounded-lg text-xs bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
              disabled={busy}
            >
              {t('research.inspector.prune')}
            </button>
          </ConfirmPopover>
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-1.5 opacity-60">
            <span className="text-[10px] text-gray-400">
              {t('research.inspector.convert_faded')}
            </span>
            <button
              type="button"
              className="w-full h-7 rounded text-[11px] text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              disabled={busy}
              onClick={() => onConvertNote(node.id)}
            >
              {t('research.convert.to_note')}
            </button>
            <button
              type="button"
              className="w-full h-7 rounded text-[11px] text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              disabled={busy}
              onClick={() => onConvertSource(node.id)}
            >
              {t('research.convert.to_source')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-auto pt-2 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-1.5 opacity-60">
          <span className="text-[10px] text-gray-400">{t('research.inspector.convert_faded')}</span>
          <button
            type="button"
            className="w-full h-7 rounded text-[11px] text-gray-500 hover:bg-gray-50"
            onClick={() => onConvertNote(node.id)}
          >
            {t('research.convert.to_note')}
          </button>
          <button
            type="button"
            className="w-full h-7 rounded text-[11px] text-gray-500 hover:bg-gray-50"
            onClick={() => onConvertSource(node.id)}
          >
            {t('research.convert.to_source')}
          </button>
        </div>
      )}
    </aside>
  );
}
