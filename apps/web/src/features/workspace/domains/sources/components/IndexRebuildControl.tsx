// c131 T6 — toolbar control for notebook-level embedding-index rebuild:
// progress text while rebuilding, otherwise a confirm-popover button whose
// message differs for the global (dim-mismatch) mode.
import { RestartAlt as RestartAltIcon } from '@mui/icons-material';

import ConfirmPopover from '../../../../../shared/ConfirmPopover';
import { TestIds, tid } from '../../../../../shared/testids';
import { IconButton, Typography } from '../../../../../shared/ui';

export interface IndexControlProps {
  state: 'ready' | 'rebuilding' | 'dim_mismatch' | 'interrupted';
  progress?: { total: number; done: number; failed: number };
  starting?: boolean;
  onStart: () => void | Promise<void>;
}

export default function IndexRebuildControl({
  state,
  progress = { total: 0, done: 0, failed: 0 },
  starting,
  onStart,
}: IndexControlProps) {
  if (state === 'rebuilding') {
    return (
      <Typography
        variant="small"
        className="text-[11px] text-amber-600 dark:text-amber-400 whitespace-nowrap"
        {...tid(TestIds.sourcesIndexRebuildProgress)}
      >
        索引重建 {progress.done}/{progress.total}
      </Typography>
    );
  }

  const warning = state !== 'ready';
  return (
    <ConfirmPopover
      message={
        state === 'dim_mismatch'
          ? '嵌入模型维度已变化：将重建整库索引（清空并重嵌所有笔记本的向量）。确定继续吗？'
          : '将清空并重新嵌入该笔记本全部来源的向量。确定继续吗？'
      }
      onConfirm={() => {
        void onStart();
      }}
      placement="bottom"
    >
      <IconButton
        size="sm"
        variant="text"
        aria-label="重建索引"
        disabled={starting}
        className={
          warning
            ? 'w-6 h-6 min-w-[24px] rounded-full text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
            : 'w-6 h-6 min-w-[24px] rounded-full text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800'
        }
        {...tid(TestIds.sourcesIndexRebuildButton)}
      >
        <RestartAltIcon style={{ fontSize: 16 }} />
      </IconButton>
    </ConfirmPopover>
  );
}
