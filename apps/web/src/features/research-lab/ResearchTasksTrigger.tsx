import { Science as ScienceIcon } from '@mui/icons-material';

import { TestIds, tid } from '../../shared/testids';
import { useResearchTasks } from './useResearchTasks';

export interface ResearchTasksTriggerProps {
  notebookId: number | null;
  onOpen: () => void;
}

/**
 * Deep-research hub trigger (flask) — workspace avatar-adjacent / Lab top-right.
 * Opens the task inbox; Compose via「新建研究」. Badge = active ResearchRuns.
 */
export default function ResearchTasksTrigger({ notebookId, onOpen }: ResearchTasksTriggerProps) {
  const { activeCount } = useResearchTasks(notebookId);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={activeCount > 0 ? `深度研究任务（${activeCount} 进行中）` : '深度研究'}
      title="深度研究"
      className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        activeCount > 0
          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
      }`}
      {...tid(TestIds.researchTasksTrigger)}
    >
      <ScienceIcon sx={{ fontSize: 18 }} />
      {activeCount > 0 ? (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white"
          {...tid(TestIds.researchTasksBadge)}
        >
          {activeCount > 9 ? '9+' : activeCount}
        </span>
      ) : null}
    </button>
  );
}
