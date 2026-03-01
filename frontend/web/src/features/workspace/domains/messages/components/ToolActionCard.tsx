import { useEffect } from 'react';

type ToolActionCardProps = {
  title: string;
  description?: string | null;
  status: 'pending' | 'running' | 'success' | 'error';
  outputText?: string | null;
  errorMessage?: string | null;
  canExecute: boolean;
  requiresConfirm: boolean;
  autoExecute: boolean;
  onExecute: () => void;
};

export default function ToolActionCard({
  title,
  description = null,
  status,
  outputText = null,
  errorMessage = null,
  canExecute,
  requiresConfirm,
  autoExecute,
  onExecute,
}: ToolActionCardProps) {
  useEffect(() => {
    if (!autoExecute) return;
    if (!canExecute) return;
    if (requiresConfirm) return;
    if (status !== 'pending') return;
    onExecute();
  }, [autoExecute, canExecute, requiresConfirm, onExecute, status]);

  const isBusy = status === 'running';
  const canClick = canExecute && !isBusy && (status === 'pending' || status === 'error');

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
            {title}
          </div>
          {description ? (
            <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
              {description}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={onExecute}
          disabled={!canClick}
        >
          {isBusy ? '运行中…' : status === 'success' ? '已完成' : requiresConfirm ? '确认执行' : '执行'}
        </button>
      </div>
      {status === 'error' && errorMessage ? (
        <div className="mt-2 text-[11px] text-rose-700 dark:text-rose-300 whitespace-pre-wrap">
          {errorMessage}
        </div>
      ) : null}
      {status === 'success' && outputText ? (
        <pre className="mt-2 text-[11px] leading-snug text-slate-800 dark:text-slate-100 overflow-x-auto whitespace-pre-wrap">
          {outputText}
        </pre>
      ) : null}
    </div>
  );
}

