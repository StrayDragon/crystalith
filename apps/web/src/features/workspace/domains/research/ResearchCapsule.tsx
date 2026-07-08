import {
  Chip,
  Progress,
  IconButton,
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
} from '@material-tailwind/react';
import {
  Science as ScienceIcon,
  PlayArrow as PlayIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { memo, useCallback, useState } from 'react';

import type { ResearchSessionListItem, ResearchStatus } from '../../../../api/generated';
import ConfirmPopover from '../../../../shared/ConfirmPopover';

interface ResearchCapsuleProps {
  session: ResearchSessionListItem;
  onClick: () => void;
  onStart?: () => void;
  onDelete?: () => void;
  isExpanded?: boolean;
}

const STATUS_CONFIG: Record<
  ResearchStatus,
  { label: string; color: 'blue' | 'amber' | 'green' | 'red' | 'gray'; animate?: boolean }
> = {
  planning: { label: '规划中', color: 'blue' },
  searching: { label: '搜索中', color: 'blue', animate: true },
  analyzing: { label: '分析中', color: 'blue', animate: true },
  waiting_user: { label: '待确认', color: 'amber', animate: true },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'gray' },
};

function ResearchCapsule({
  session,
  onClick,
  onStart,
  onDelete,
  isExpanded,
}: ResearchCapsuleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const config = STATUS_CONFIG[session.status] || { label: session.status, color: 'gray' };
  const progress = Math.round((session.current_iteration / session.max_iterations) * 100);
  const isActive = ['planning', 'searching', 'analyzing', 'waiting_user'].includes(session.status);
  const shouldAnimate = config.animate;

  const handleStart = useCallback(() => {
    setMenuOpen(false);
    onStart?.();
  }, [onStart]);

  const handleDelete = useCallback(() => {
    setMenuOpen(false);
    onDelete?.();
  }, [onDelete]);

  return (
    <div
      className={`
        group relative p-3 rounded-lg border transition-all duration-200
        hover:shadow-md
        ${isExpanded ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 bg-white hover:border-blue-300'}
        ${shouldAnimate ? 'animate-pulse' : ''}
      `}
    >
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-lg"
        aria-label={`打开研究会话：${session.topic}`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <ScienceIcon className="text-blue-600" style={{ fontSize: 20 }} />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            深度研究
          </span>
          <Chip value={config.label} color={config.color} size="sm" className="ml-auto text-xs" />
        </div>

        {/* Topic */}
        <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{session.topic}</h3>

        {/* Progress */}
        <div className="mb-2">
          <Progress value={progress} color="blue" className="h-1.5" />
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            第 {session.current_iteration}/{session.max_iterations} 轮
          </span>
          {session.status === 'waiting_user' && (
            <span className="text-amber-600 font-medium animate-pulse">需要您的确认</span>
          )}
        </div>
      </button>

      {/* Three-dot menu - visible on hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Menu open={menuOpen} handler={setMenuOpen} placement="bottom-end">
          <MenuHandler>
            <IconButton size="sm" variant="text" color="gray">
              <MoreVertIcon style={{ fontSize: 18 }} />
            </IconButton>
          </MenuHandler>
          <MenuList className="min-w-[140px]">
            {session.status === 'planning' && onStart && (
              <MenuItem onClick={handleStart} className="flex items-center gap-2">
                <PlayIcon style={{ fontSize: 16 }} className="text-blue-500" />
                <span>开始研究</span>
              </MenuItem>
            )}
            {onDelete && (
              <ConfirmPopover
                message={`确定要${isActive ? '取消并删除' : '删除'}该研究会话吗？`}
                onConfirm={handleDelete}
                placement="left"
              >
                <MenuItem className="flex items-center gap-2 text-red-500">
                  <DeleteIcon style={{ fontSize: 16 }} />
                  <span>{isActive ? '取消并删除' : '删除'}</span>
                </MenuItem>
              </ConfirmPopover>
            )}
          </MenuList>
        </Menu>
      </div>
    </div>
  );
}

export default memo(ResearchCapsule);
