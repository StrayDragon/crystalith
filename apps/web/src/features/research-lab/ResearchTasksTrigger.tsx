import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';

import { TestIds, tid } from '../../shared/testids';
import { useResearchTasks } from './useResearchTasks';

export interface ResearchTasksTriggerProps {
  notebookId: number | null;
  onOpen: () => void;
}

/** Avatar-adjacent / Lab top-right task inbox trigger with active badge. */
export default function ResearchTasksTrigger({ notebookId, onOpen }: ResearchTasksTriggerProps) {
  const { activeCount } = useResearchTasks(notebookId);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={activeCount > 0 ? `深度研究任务（${activeCount} 进行中）` : '深度研究任务'}
      title="深度研究任务"
      className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800"
      {...tid(TestIds.researchTasksTrigger)}
    >
      <AssignmentOutlinedIcon sx={{ fontSize: 18 }} />
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
