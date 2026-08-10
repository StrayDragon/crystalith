import {
  Checkbox,
  Typography,
  IconButton,
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
} from '@material-tailwind/react';
import {
  MoreHoriz as MoreHorizIcon,
  OpenInNew as OpenInNewIcon,
  CloudDownload as FetchIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { forwardRef } from 'react';

import { LAYER_LEVELS } from '../../../../shared/layer';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet?: string | null;
  source?: string | null;
}

interface SearchResultCardProps {
  result: SearchResultItem;
  isSelected: boolean;
  onToggle: (result: SearchResultItem) => void;
  onExpand?: (result: SearchResultItem) => void;
  onAddAsLink?: (result: SearchResultItem) => void;
  onAddWithFetch?: (result: SearchResultItem) => void;
  compact?: boolean;
}

const SearchResultCard = forwardRef<HTMLDivElement, SearchResultCardProps>(
  (
    { result, isSelected, onToggle, onExpand, onAddAsLink, onAddWithFetch, compact = false },
    ref,
  ) => {
    const hostname = (() => {
      try {
        return new URL(result.url).hostname;
      } catch {
        return result.url;
      }
    })();

    if (compact) {
      // Compact mode - ultra minimal, just title + checkbox
      return (
        <div
          ref={ref}
          className="group relative flex items-center gap-1 py-1 px-1.5 rounded border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all"
        >
          {/* Checkbox */}
          <div className="flex-shrink-0">
            <Checkbox
              checked={isSelected}
              onChange={() => {
                onToggle(result);
              }}
              containerProps={{ className: 'p-0' }}
              className="h-3.5 w-3.5 rounded border-gray-300 bg-white checked:bg-blue-600 checked:border-blue-600"
              iconProps={{ className: 'text-white' }}
            />
          </div>

          {/* Title only - clickable */}
          <button
            type="button"
            className="flex-1 text-left min-w-0 truncate"
            onClick={() => onExpand?.(result)}
            title={`${result.title}\n${hostname}${result.source ? ` · ${result.source}` : ''}`}
          >
            <Typography
              variant="small"
              className="font-medium text-gray-800 truncate text-[10px] leading-tight"
            >
              {result.title}
            </Typography>
          </button>

          {/* Menu - only visible on hover */}
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Menu placement="bottom-end">
              <MenuHandler>
                <IconButton
                  variant="text"
                  size="sm"
                  className="w-5 h-5 min-w-[20px] rounded hover:bg-gray-200 text-gray-400"
                >
                  <MoreHorizIcon style={{ fontSize: 14 }} />
                </IconButton>
              </MenuHandler>
              <MenuList className="p-1 min-w-[140px]" style={{ zIndex: LAYER_LEVELS.dropdown }}>
                <MenuItem
                  onClick={() => onAddAsLink?.(result)}
                  className="flex items-center gap-2 py-2 px-3 text-xs"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span>作为链接导入</span>
                </MenuItem>
                <MenuItem
                  onClick={() => onAddWithFetch?.(result)}
                  className="flex items-center gap-2 py-2 px-3 text-xs"
                >
                  <FetchIcon className="h-3.5 w-3.5" />
                  <span>作为全文导入</span>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    window.open(result.url, '_blank');
                  }}
                  className="flex items-center gap-2 py-2 px-3 text-xs"
                >
                  <OpenInNewIcon className="h-3.5 w-3.5" />
                  <span>预览</span>
                </MenuItem>
              </MenuList>
            </Menu>
          </div>
        </div>
      );
    }

    // Expanded mode - full details
    return (
      <div
        ref={ref}
        onClick={() => {
          onToggle(result);
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onToggle(result);
          }
        }}
        role="group"
        aria-label={`${isSelected ? '取消选择' : '选择'}：${result.title}`}
        tabIndex={0}
        className={`
          flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition-all duration-200
          ${
            isSelected
              ? 'bg-gray-100 border-gray-400 shadow-sm'
              : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }
        `}
      >
        <Checkbox
          checked={isSelected}
          onChange={() => {
            onToggle(result);
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          containerProps={{ className: 'p-0 mt-0.5' }}
          className="h-4 w-4 rounded border-gray-300 bg-white checked:bg-gray-900 checked:border-gray-900"
          iconProps={{ className: 'text-white' }}
        />

        <div className="flex-1 min-w-0">
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="text-gray-900 hover:text-blue-600 transition-colors"
          >
            <Typography variant="small" className="font-semibold text-xs leading-snug line-clamp-1">
              {result.title}
            </Typography>
          </a>

          {result.snippet && (
            <Typography
              variant="small"
              className="text-[10px] text-gray-600 font-medium leading-snug mt-0.5 line-clamp-2"
            >
              {result.snippet}
            </Typography>
          )}

          <div className="flex items-center gap-2 mt-1">
            <Typography
              variant="small"
              className="text-[9px] text-gray-400 font-medium truncate max-w-[180px]"
            >
              {hostname}
            </Typography>
            {result.source && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-200 text-[8px] text-gray-600 font-medium">
                {result.source}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },
);

SearchResultCard.displayName = 'SearchResultCard';

export default SearchResultCard;
