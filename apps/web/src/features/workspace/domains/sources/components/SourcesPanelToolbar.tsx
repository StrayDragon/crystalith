import type { SourceTag as SourceTagRead } from '@crystalith/shared';
import {
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  MoreHoriz as MoreHorizIcon,
  Replay as ReplayIcon,
} from '@mui/icons-material';

import ConfirmPopover from '../../../../../shared/ConfirmPopover';
import { TestIds, tid } from '../../../../../shared/testids';
import type { AsyncStatus } from '../../../../../shared/types';
import {
  IconButton,
  Typography,
  Menu,
  MenuHandler,
  MenuItem,
  MenuList,
  Checkbox,
} from '../../../../../shared/ui';
import type { SourceSortBy, SourceSortOrder } from '../useSources';

export interface SourcesPanelToolbarProps {
  allSelected: boolean;
  onToggleAll: () => void;
  selectedIds: number[];
  sourcesCount: number;
  sortBy: SourceSortBy;
  sortOrder: SourceSortOrder;
  tagFilter: string;
  sourceTags: SourceTagRead[];
  onSortByChange?: (value: SourceSortBy) => void;
  onSortOrderChange?: (value: SourceSortOrder) => void;
  onTagFilterChange?: (value: string) => void;
  removeDisabled: boolean;
  batchReembedDisabled: boolean;
  onBatchDelete: () => Promise<void>;
  onBatchReembed: () => Promise<void>;
  onBatchCreateAndAssignTag: () => Promise<void>;
  onAssignExistingTag: (tagId: number) => Promise<void>;
  onRemoveExistingTag: (tagId: number) => Promise<void>;
  selectedTagNames: string[];
  onBatchReembedSources?: (sourceIds: number[]) => Promise<boolean>;
  onCreateSourceTag?: (name: string) => Promise<SourceTagRead | null>;
  onAssignTagToSources?: (tagId: number, sourceIds: number[]) => Promise<boolean>;
  onRemoveTagFromSources?: (tagId: number, sourceIds: number[]) => Promise<boolean>;
  tagMutationState: AsyncStatus;
}

export default function SourcesPanelToolbar({
  allSelected,
  onToggleAll,
  selectedIds,
  sourcesCount,
  sortBy,
  sortOrder,
  tagFilter,
  sourceTags,
  onSortByChange,
  onSortOrderChange,
  onTagFilterChange,
  removeDisabled,
  batchReembedDisabled,
  onBatchDelete,
  onBatchReembed,
  onBatchCreateAndAssignTag,
  onAssignExistingTag,
  onRemoveExistingTag,
  selectedTagNames,
  onBatchReembedSources,
  onCreateSourceTag,
  onAssignTagToSources,
  onRemoveTagFromSources,
  tagMutationState,
}: SourcesPanelToolbarProps) {
  return (
    <div className="flex-shrink-0 px-3 sm:px-4 py-1.5 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700">
      <div className="flex items-center gap-1">
        <Checkbox
          checked={allSelected}
          onChange={onToggleAll}
          containerProps={{ className: 'p-0.5' }}
          className="h-4 w-4 rounded border-gray-300 bg-white dark:bg-slate-900 checked:bg-gray-900 checked:border-gray-900"
          iconProps={{ className: 'text-white' }}
        />
        <Typography
          variant="small"
          className="text-[11px] text-gray-500 dark:text-slate-400 whitespace-nowrap"
          {...tid(TestIds.sourcesCount)}
        >
          {selectedIds.length > 0
            ? `已选 ${selectedIds.length}/${sourcesCount}`
            : `${sourcesCount} 个来源`}
        </Typography>

        <span className="flex-1" />

        <Menu placement="bottom-end" dismiss={{ itemPress: false }}>
          <MenuHandler>
            <IconButton
              size="sm"
              variant="text"
              aria-label="来源排序与筛选"
              className="w-6 h-6 min-w-[24px] rounded-full text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800"
              {...tid(TestIds.sourcesSortMenu)}
            >
              <ExpandMoreIcon style={{ fontSize: 16 }} />
            </IconButton>
          </MenuHandler>
          <MenuList
            className="p-1 min-w-[160px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg"
            {...tid(TestIds.sourcesSortMenuList)}
          >
            <div className="px-3 py-1 text-[9px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              排序字段
            </div>
            {(
              [
                ['date', '日期'],
                ['name', '名称'],
                ['size', '大小'],
                ['type', '类型'],
              ] as const
            ).map(([val, label]) => (
              <MenuItem
                key={val}
                onClick={() => onSortByChange?.(val)}
                className={`py-1.5 px-3 text-xs ${sortBy === val ? 'bg-gray-100 dark:bg-slate-800 font-medium' : ''}`}
              >
                {sortBy === val ? '✓ ' : '   '}
                {label}
              </MenuItem>
            ))}
            <div className="my-1 border-t border-gray-100 dark:border-slate-700" />
            <div className="px-3 py-1 text-[9px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              排序方向
            </div>
            {(
              [
                ['desc', '降序'],
                ['asc', '升序'],
              ] as const
            ).map(([val, label]) => (
              <MenuItem
                key={val}
                onClick={() => onSortOrderChange?.(val)}
                className={`py-1.5 px-3 text-xs ${sortOrder === val ? 'bg-gray-100 dark:bg-slate-800 font-medium' : ''}`}
              >
                {sortOrder === val ? '✓ ' : '   '}
                {label}
              </MenuItem>
            ))}
            {sourceTags.length > 0
              ? [
                  <div
                    key="tag-filter-divider"
                    className="my-1 border-t border-gray-100 dark:border-slate-700"
                  />,
                  <div
                    key="tag-filter-title"
                    className="px-3 py-1 text-[9px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider"
                  >
                    标签筛选
                  </div>,
                  <MenuItem
                    key="tag-filter-all"
                    onClick={() => onTagFilterChange?.('')}
                    className={`py-1.5 px-3 text-xs ${!tagFilter ? 'bg-gray-100 dark:bg-slate-800 font-medium' : ''}`}
                  >
                    {!tagFilter ? '✓ ' : '   '}全部
                  </MenuItem>,
                  ...sourceTags.map((tag) => (
                    <MenuItem
                      key={tag.id}
                      onClick={() => onTagFilterChange?.(tag.name)}
                      className={`py-1.5 px-3 text-xs ${tagFilter === tag.name ? 'bg-gray-100 dark:bg-slate-800 font-medium' : ''}`}
                    >
                      {tagFilter === tag.name ? '✓ ' : '   '}
                      {tag.name}
                    </MenuItem>
                  )),
                ]
              : []}
          </MenuList>
        </Menu>

        {selectedIds.length > 0 && (
          <Menu placement="bottom-end">
            <MenuHandler>
              <IconButton
                size="sm"
                variant="text"
                aria-label="已选来源操作"
                className="w-6 h-6 min-w-[24px] rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                {...tid(TestIds.sourcesSelectedMenu)}
              >
                <MoreHorizIcon style={{ fontSize: 16 }} />
              </IconButton>
            </MenuHandler>
            <MenuList className="p-1 min-w-[180px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg">
              <ConfirmPopover
                message={
                  selectedIds.length === 1
                    ? '确定要移除已选的 1 个来源吗？'
                    : `确定要移除已选的 ${selectedIds.length} 个来源吗？`
                }
                onConfirm={() => {
                  void onBatchDelete();
                }}
                placement="left"
                disabled={removeDisabled}
              >
                <MenuItem
                  disabled={removeDisabled}
                  className="flex items-center gap-2 py-1.5 px-3 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  {...tid(TestIds.sourcesBatchDelete)}
                >
                  <DeleteIcon style={{ fontSize: 14 }} />
                  删除已选 ({selectedIds.length})
                </MenuItem>
              </ConfirmPopover>

              {onBatchReembedSources && (
                <MenuItem
                  disabled={batchReembedDisabled}
                  onClick={() => {
                    void onBatchReembed();
                  }}
                  className="flex items-center gap-2 py-1.5 px-3 text-xs"
                >
                  <ReplayIcon style={{ fontSize: 14 }} />
                  重新嵌入 ({selectedIds.length})
                </MenuItem>
              )}

              {onAssignTagToSources || onRemoveTagFromSources
                ? [
                    <div
                      key="tag-actions-divider"
                      className="my-1 border-t border-gray-100 dark:border-slate-700"
                    />,
                    <MenuItem
                      key="tag-actions-create"
                      onClick={() => {
                        void onBatchCreateAndAssignTag();
                      }}
                      disabled={
                        !onCreateSourceTag ||
                        !onAssignTagToSources ||
                        tagMutationState === 'loading'
                      }
                      className="flex items-center gap-2 py-1.5 px-3 text-xs"
                    >
                      新建并分配标签
                    </MenuItem>,
                    ...sourceTags.map((tag) => (
                      <MenuItem
                        key={`assign-${tag.id}`}
                        onClick={() => {
                          void onAssignExistingTag(tag.id);
                        }}
                        disabled={!onAssignTagToSources || tagMutationState === 'loading'}
                        className="py-1.5 px-3 text-xs"
                      >
                        添加标签：{tag.name}
                      </MenuItem>
                    )),
                    ...(selectedTagNames.length > 0
                      ? [
                          <div
                            key="tag-actions-divider-remove"
                            className="my-1 border-t border-gray-100 dark:border-slate-700"
                          />,
                        ]
                      : []),
                    ...selectedTagNames.flatMap((tagName) => {
                      const tag = sourceTags.find((item) => item.name === tagName);
                      if (!tag) return [];
                      return [
                        <MenuItem
                          key={`remove-${tag.id}`}
                          onClick={() => {
                            void onRemoveExistingTag(tag.id);
                          }}
                          disabled={!onRemoveTagFromSources || tagMutationState === 'loading'}
                          className="py-1.5 px-3 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                        >
                          移除标签：{tag.name}
                        </MenuItem>,
                      ];
                    }),
                  ]
                : []}
            </MenuList>
          </Menu>
        )}
      </div>
    </div>
  );
}
