import {
  Checkbox,
  Chip,
  IconButton,
  Menu,
  MenuHandler,
  MenuItem,
  MenuList,
  Tooltip,
  Typography,
} from '@material-tailwind/react';
import {
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  MoreHoriz as MoreHorizIcon,
  OpenInFull as OpenInFullIcon,
  Replay as ReplayIcon,
} from '@mui/icons-material';
import { memo } from 'react';

import { copyToClipboard } from '../../../../../shared/clipboard';
import ConfirmPopover from '../../../../../shared/ConfirmPopover';
import { TestIds, tid } from '../../../../../shared/testids';
import { toast } from '../../../../../shared/toast';
import type { AsyncStatus } from '../../../../../shared/types';
import type { SourceItem } from '../../../shared/types';

export interface SourceListRowProps {
  source: SourceItem;
  isHighlighted: boolean;
  isSelected: boolean;
  isConnected: boolean;
  removeState: AsyncStatus;
  onToggleSource: (
    id: number,
    event?: Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>,
  ) => void;
  onOpenDetail: (source: SourceItem) => void;
  onOpenDetailFullscreen: (source: SourceItem) => void;
  onRemoveSource: (sourceId: number) => Promise<boolean>;
  onReembedSource?: (sourceId: number) => Promise<unknown>;
}

function SourceListRow({
  source,
  isHighlighted,
  isSelected,
  isConnected,
  removeState,
  onToggleSource,
  onOpenDetail,
  onOpenDetailFullscreen,
  onRemoveSource,
  onReembedSource,
}: SourceListRowProps) {
  const isSelectable = source.statusTone === 'READY';
  const statusProgress =
    source.statusTone === 'PROCESSING' && typeof source.indexProgress === 'number'
      ? Math.min(100, Math.max(0, Math.round(source.indexProgress)))
      : null;
  const statusLabel = statusProgress != null ? `索引中 (${statusProgress}%)` : source.status;
  const statusColor =
    source.statusTone === 'READY' ? 'green' : source.statusTone === 'PROCESSING' ? 'amber' : 'red';

  return (
    <div
      className={`group relative flex items-center rounded-xl border bg-white dark:bg-slate-900 shadow-sm transition-[border-color,box-shadow] hover:border-gray-300 hover:shadow mb-1.5 ${
        isHighlighted ? 'ux-source-locate-flash' : 'border-gray-200 dark:border-slate-700'
      }`}
    >
      <button
        className="flex flex-1 items-center gap-3 p-2 text-left min-w-0"
        {...tid(TestIds.sourceRow)}
        onClick={(event) => {
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            onToggleSource(source.id, event.nativeEvent);
            return;
          }
          onOpenDetail(source);
        }}
        aria-label={`打开来源 ${source.title}`}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-200 text-gray-600 flex-shrink-0">
          <DescriptionIcon style={{ fontSize: 18 }} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2 min-w-0">
            <Typography
              variant="small"
              className="font-semibold text-gray-900 dark:text-slate-100 text-xs truncate"
            >
              {source.title}
            </Typography>
            <Chip
              value={statusLabel}
              size="sm"
              variant="ghost"
              color={statusColor}
              className="h-5 px-2 py-0 text-[10px] font-medium flex-shrink-0"
            />
          </div>
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-[10px] text-gray-500 dark:text-slate-400 whitespace-nowrap">
              {source.type}
            </span>
            <span className="text-[10px] text-gray-400 whitespace-nowrap">{source.createdAt}</span>
            {source.tags.length > 0 ? (
              <span className="truncate text-[10px] text-blue-600">
                {source.tags.map((tag) => `#${tag}`).join(' ')}
              </span>
            ) : null}
          </div>
          {source.statusTone === 'FAILED' &&
          (source.errorMessage || source.recoveryHint || source.errorCode) ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-red-600 dark:text-red-400 truncate">
                {source.errorMessage || source.errorCode || '导入失败'}
              </span>
              {source.recoveryHint ? (
                <Tooltip content={source.recoveryHint}>
                  <span className="text-[10px] text-red-500 underline decoration-dotted cursor-help">
                    修复建议
                  </span>
                </Tooltip>
              ) : null}
            </div>
          ) : null}
        </div>
      </button>

      <div className="flex items-center gap-1 pr-2">
        <Menu placement="bottom-end">
          <MenuHandler>
            <IconButton
              size="sm"
              variant="text"
              aria-label={`来源操作 ${source.title}`}
              className="w-6 h-6 min-w-[24px] rounded-full text-gray-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-gray-200"
              onClick={(e) => {
                e.stopPropagation();
              }}
              {...tid(TestIds.sourceRowMenu)}
            >
              <MoreHorizIcon style={{ fontSize: 16 }} />
            </IconButton>
          </MenuHandler>
          <MenuList className="p-1 min-w-[140px]">
            <MenuItem
              onClick={() => {
                onOpenDetailFullscreen(source);
              }}
              className="flex items-center gap-2 py-2 px-3 text-xs"
            >
              <OpenInFullIcon style={{ fontSize: 16 }} />
              <span>放大查看</span>
            </MenuItem>
            {source.statusTone === 'FAILED' &&
            (source.recoveryHint || source.errorMessage || source.errorCode) ? (
              <MenuItem
                onClick={() => {
                  void (async () => {
                    const text =
                      source.recoveryHint || source.errorMessage || source.errorCode || '';
                    const ok = await copyToClipboard(text);
                    if (ok) {
                      toast.success('已复制修复建议');
                    } else {
                      toast.error('复制失败');
                    }
                  })();
                }}
                className="flex items-center gap-2 py-2 px-3 text-xs"
              >
                <ContentCopyIcon style={{ fontSize: 16 }} />
                <span>复制修复建议</span>
              </MenuItem>
            ) : null}
            <ConfirmPopover
              message={`确定要删除「${source.title}」吗？此操作不可撤销。`}
              onConfirm={() => {
                void (async () => {
                  if (!isConnected || removeState === 'loading') return;
                  await onRemoveSource(source.id);
                })();
              }}
              placement="left"
              disabled={!isConnected || removeState === 'loading'}
            >
              <MenuItem
                disabled={!isConnected || removeState === 'loading'}
                className="flex items-center gap-2 py-2 px-3 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                {...tid(TestIds.sourceRowDelete)}
              >
                <DeleteIcon style={{ fontSize: 16 }} />
                <span>{removeState === 'loading' ? '删除中…' : '删除来源'}</span>
              </MenuItem>
            </ConfirmPopover>
            {source.statusTone === 'FAILED' && onReembedSource && (
              <MenuItem
                onClick={() => {
                  void (async () => {
                    if (!isConnected) return;
                    await onReembedSource(source.id);
                  })();
                }}
                className="flex items-center gap-2 py-2 px-3 text-xs"
              >
                <ReplayIcon style={{ fontSize: 16 }} />
                <span>重新嵌入</span>
              </MenuItem>
            )}
          </MenuList>
        </Menu>

        {!isSelectable ? (
          <Tooltip content="未完成索引，暂不可用">
            <span>
              <Checkbox
                checked={false}
                onChange={(event) => onToggleSource(source.id, event.nativeEvent as MouseEvent)}
                containerProps={{ className: 'p-1' }}
                className="h-4 w-4 rounded border-gray-300 bg-white dark:bg-slate-900 checked:bg-gray-900 checked:border-gray-900"
                iconProps={{ className: 'text-white' }}
                disabled
                {...tid(TestIds.sourceRowCheckbox)}
              />
            </span>
          </Tooltip>
        ) : (
          <Checkbox
            checked={isSelected}
            onChange={(event) => onToggleSource(source.id, event.nativeEvent as MouseEvent)}
            containerProps={{ className: 'p-1' }}
            className="h-4 w-4 rounded border-gray-300 bg-white dark:bg-slate-900 checked:bg-gray-900 checked:border-gray-900"
            iconProps={{ className: 'text-white' }}
            {...tid(TestIds.sourceRowCheckbox)}
          />
        )}
      </div>
    </div>
  );
}

export default memo(SourceListRow);
