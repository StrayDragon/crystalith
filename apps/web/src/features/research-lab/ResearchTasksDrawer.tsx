/**
 * Unified research task list drawer — Eden listRuns (default) or fixture demo.
 */
import { Close as CloseIcon, Assignment as AssignmentIcon } from '@mui/icons-material';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { useLayer } from '../../shared/layer';
import { TestIds, tid } from '../../shared/testids';
import { isLabFixtureMode } from './labFixtureMode';
import {
  isActiveResearchStatus,
  RESEARCH_TASK_STATUS_LABEL,
  type ResearchTaskListItem,
} from './researchTaskTypes';
import { useResearchTasks } from './useResearchTasks';

export interface ResearchTasksDrawerProps {
  open: boolean;
  onClose: () => void;
  notebookId: number | null;
  onSelectTask: (task: ResearchTaskListItem) => void;
  onCreateNew?: () => void;
  /** Eden: cancel active run from a list row. */
  onCancelTask?: (task: ResearchTaskListItem) => void;
}

function statusTone(status: string): string {
  switch (status) {
    case 'running':
    case 'queued':
      return 'bg-blue-50 text-blue-800 border-blue-100';
    case 'awaiting_confirm':
      return 'bg-amber-50 text-amber-900 border-amber-100';
    case 'completed':
      return 'bg-emerald-50 text-emerald-800 border-emerald-100';
    case 'failed':
    case 'cancelled':
      return 'bg-red-50 text-red-800 border-red-100';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-100';
  }
}

export default function ResearchTasksDrawer({
  open,
  onClose,
  notebookId,
  onSelectTask,
  onCreateNew,
  onCancelTask,
}: ResearchTasksDrawerProps) {
  const { style: layerStyle } = useLayer('modal');
  const { tasks, activeTaskId, loading, error, refresh } = useResearchTasks(notebookId);
  const fixture = isLabFixtureMode();

  useEffect(() => {
    if (open && !fixture) refresh();
  }, [open, fixture, refresh]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0" style={layerStyle} {...tid(TestIds.researchTasksDrawer)}>
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/25"
        aria-label="关闭任务列表"
        onClick={onClose}
      />
      <aside
        className="absolute right-0 top-0 flex h-full w-[min(380px,100%)] flex-col border-l border-gray-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="深度研究任务"
      >
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">深度研究任务</h2>
            <p className="text-[11px] text-gray-500">
              {fixture ? '进行中与历史（fixture 演示）' : '进行中与历史（ResearchRun）'}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
            aria-label="关闭"
            onClick={onClose}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-gray-50 px-4 py-2">
          {onCreateNew ? (
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              onClick={onCreateNew}
              {...tid(TestIds.researchTasksCreate)}
            >
              新建研究
            </button>
          ) : null}
          {!notebookId ? <span className="text-[11px] text-amber-700">请先选择笔记本</span> : null}
        </div>

        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <li className="px-3 py-6 text-center text-[12px] text-gray-500">加载中…</li>
          ) : error ? (
            <li className="rounded-lg border border-red-100 bg-red-50 px-3 py-4 text-[12px] text-red-800">
              {error}
            </li>
          ) : tasks.length === 0 ? (
            <li
              className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-[12px] text-gray-500"
              {...tid(TestIds.researchTasksEmpty)}
            >
              暂无研究任务。从实验室 Compose 创建后会出现在这里。
            </li>
          ) : (
            tasks.map((task) => {
              const active = task.id === activeTaskId;
              const canCancel =
                Boolean(onCancelTask) && !fixture && isActiveResearchStatus(task.status);
              return (
                <li key={task.id}>
                  <div
                    className={`rounded-xl border px-3 py-2.5 transition-colors ${
                      active
                        ? 'border-blue-300 bg-blue-50/80'
                        : 'border-gray-100 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => onSelectTask(task)}
                      {...tid(TestIds.researchTasksItem)}
                      data-task-id={task.id}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-[12px] font-medium text-gray-900">
                          {task.topic}
                        </p>
                        <span
                          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${statusTone(task.status)}`}
                        >
                          {RESEARCH_TASK_STATUS_LABEL[task.status] ?? task.status}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-gray-400">{task.id}</p>
                    </button>
                    {canCancel ? (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          className="rounded-md border border-red-100 bg-white px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancelTask?.(task);
                          }}
                        >
                          取消研究
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className="border-t border-gray-100 px-4 py-2 text-[10px] text-gray-400">
          <span className="inline-flex items-center gap-1">
            <AssignmentIcon sx={{ fontSize: 12 }} />
            {fixture ? 'VITE_LAB_FIXTURE=1 · demo 列表' : 'Eden GET …/research'}
          </span>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
