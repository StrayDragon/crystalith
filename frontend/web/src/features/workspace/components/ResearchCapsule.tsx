import { memo, useCallback } from 'react';
import { Chip, Progress, Tooltip, IconButton } from '@material-tailwind/react';
import {
  Science as ScienceIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import type { ResearchSessionListItem, ResearchStatus } from '../../../api/client';

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

function ResearchCapsule({ session, onClick, onStart, onDelete, isExpanded }: ResearchCapsuleProps) {
  const config = STATUS_CONFIG[session.status] || { label: session.status, color: 'gray' };
  const progress = Math.round((session.current_iteration / session.max_iterations) * 100);
  const isActive = ['planning', 'searching', 'analyzing', 'waiting_user'].includes(session.status);

  const handleStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onStart?.();
    },
    [onStart]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.();
    },
    [onDelete]
  );

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      tabIndex={0}
      role="button"
      className={`
        group relative p-3 rounded-lg border transition-all duration-200
        cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500
        ${isExpanded ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 bg-white hover:border-blue-300'}
        ${config.animate ? 'animate-pulse' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <ScienceIcon className="text-blue-600" style={{ fontSize: 20 }} />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">深度研究</span>
        <Chip
          value={config.label}
          color={config.color}
          size="sm"
          className="ml-auto text-xs"
        />
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

      {/* Actions - visible on hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        {session.status === 'planning' && onStart && (
          <Tooltip content="开始研究">
            <IconButton size="sm" variant="text" color="blue" onClick={handleStart}>
              <PlayIcon style={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
        {!isActive && onDelete && (
          <Tooltip content="删除">
            <IconButton size="sm" variant="text" color="red" onClick={handleDelete}>
              <DeleteIcon style={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip content="更多选项">
          <IconButton
            size="sm"
            variant="text"
            color="gray"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Show menu
            }}
          >
            <MoreIcon style={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}

export default memo(ResearchCapsule);
