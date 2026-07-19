import { Chip } from '@material-tailwind/react';
import { Close as CloseIcon, History as HistoryIcon } from '@mui/icons-material';

import { LAYER_LEVELS } from '../../../../../shared/layer';
import { TestIds, tid } from '../../../../../shared/testids';
import type { Research } from './sources-panel-types';

export interface ResearchHistoryDialogProps {
  open: boolean;
  research: Research;
  onClose: () => void;
  onSelectSession: (sessionId: number) => Promise<void>;
}

export default function ResearchHistoryDialog({
  open,
  research,
  onClose,
  onSelectSession,
}: ResearchHistoryDialogProps) {
  if (!open) {
    return null;
  }

  const historySessions = research.sessions.filter((s) =>
    ['completed', 'cancelled'].includes(s.status),
  );

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: LAYER_LEVELS.modal }}
      role="dialog"
      aria-modal="true"
      aria-label="研究历史"
      {...tid(TestIds.researchHistoryDialog)}
    >
      <button
        type="button"
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="关闭研究历史"
        tabIndex={-1}
      />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden ux-modal-in w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-gray-500 dark:text-slate-400" />
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">研究历史</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="关闭研究历史"
          >
            <CloseIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {historySessions.map((session) => (
            <button
              key={session.id}
              onClick={() => {
                void onSelectSession(session.id);
                onClose();
              }}
              className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate">
                    {session.topic}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {session.maxIterations} 轮研究 ·{' '}
                    {(session as { resultCount?: number }).resultCount ?? 0} 条结果
                  </p>
                </div>
                <Chip
                  value={session.status === 'completed' ? '已完成' : '已取消'}
                  color={session.status === 'completed' ? 'green' : 'gray'}
                  size="sm"
                  className="text-xs"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(session.createdAt).toLocaleString('zh-CN')}
              </p>
            </button>
          ))}
          {historySessions.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <HistoryIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无已完成的研究</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
