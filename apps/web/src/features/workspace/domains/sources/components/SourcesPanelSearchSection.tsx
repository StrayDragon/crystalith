import { IconButton, Tooltip, Typography } from '@material-tailwind/react';
import {
  ArrowForward as ArrowForwardIcon,
  Psychology as PsychologyIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import type { Ref, RefObject } from 'react';

import { t } from '../../../../../shared/i18n';
import { TestIds, tid } from '../../../../../shared/testids';

export interface SourcesPanelSearchSectionProps {
  isDeepResearchMode: boolean;
  searchModeToggleLabel: string;
  searchPlaceholder: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onToggleSearchMode: () => void;
  onSearch: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
}

export default function SourcesPanelSearchSection({
  isDeepResearchMode,
  searchModeToggleLabel,
  searchPlaceholder,
  searchQuery,
  onSearchQueryChange,
  onToggleSearchMode,
  onSearch,
  searchInputRef,
}: SourcesPanelSearchSectionProps) {
  return (
    <div
      className={
        isDeepResearchMode
          ? 'rounded-xl p-[1px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-sm ux-animated-gradient focus-within:ring-2 focus-within:ring-indigo-500/25'
          : 'rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 transition-colors duration-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-300'
      }
    >
      <div className="rounded-[11px] bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-2">
          <div className="flex w-full items-center gap-2">
            <div
              role="group"
              aria-label="搜索模式"
              {...tid(TestIds.sourcesModeToggle)}
              className="flex h-9 items-center rounded-lg bg-gray-100 p-0.5 dark:bg-slate-800"
            >
              <Tooltip
                content={
                  isDeepResearchMode
                    ? t('sources.search.toggle.to_fast')
                    : t('sources.search.mode.fast')
                }
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isDeepResearchMode) onToggleSearchMode();
                  }}
                  aria-pressed={!isDeepResearchMode}
                  aria-label={
                    isDeepResearchMode
                      ? t('sources.search.toggle.to_fast')
                      : t('sources.search.mode.fast')
                  }
                  className={
                    isDeepResearchMode
                      ? 'flex h-8 w-8 items-center justify-center rounded-md text-gray-400 opacity-50 transition-all duration-200 hover:bg-white/80 hover:opacity-90 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300'
                      : 'flex h-8 w-8 items-center justify-center rounded-md bg-white text-blue-600 shadow-sm ring-1 ring-black/5 transition-all duration-200 dark:bg-slate-700 dark:text-blue-300 dark:ring-white/10'
                  }
                >
                  <SearchIcon style={{ fontSize: 18 }} />
                </button>
              </Tooltip>
              <Tooltip
                content={
                  !isDeepResearchMode ? searchModeToggleLabel : t('sources.search.mode.deep')
                }
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!isDeepResearchMode) onToggleSearchMode();
                  }}
                  aria-pressed={isDeepResearchMode}
                  aria-label={
                    !isDeepResearchMode ? searchModeToggleLabel : t('sources.search.mode.deep')
                  }
                  className={
                    !isDeepResearchMode
                      ? 'flex h-8 w-8 items-center justify-center rounded-md text-gray-400 opacity-50 transition-all duration-200 hover:bg-white/80 hover:opacity-90 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300'
                      : 'flex h-8 w-8 items-center justify-center rounded-md bg-white text-indigo-600 shadow-sm ring-1 ring-black/5 transition-all duration-200 dark:bg-slate-700 dark:text-indigo-300 dark:ring-white/10'
                  }
                >
                  <PsychologyIcon style={{ fontSize: 18 }} />
                </button>
              </Tooltip>
            </div>

            <input
              ref={searchInputRef as Ref<HTMLInputElement>}
              className="min-w-0 flex-1 h-9 px-3 rounded-lg bg-transparent border border-transparent outline-none text-sm text-gray-800 placeholder-gray-500 focus:ring-0 transition-colors duration-200"
              placeholder={searchPlaceholder}
              value={searchQuery}
              {...tid(TestIds.sourcesSearchInput)}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onSearch();
                }
              }}
              id="source-search-input"
              name="sourceSearch"
              aria-label={
                isDeepResearchMode
                  ? t('sources.search.aria_label.deep')
                  : t('sources.search.aria_label')
              }
            />

            <IconButton
              size="sm"
              aria-label={
                isDeepResearchMode
                  ? t('sources.search.action.deep')
                  : t('sources.search.action.fast')
              }
              className="rounded-lg w-9 h-9 transition-all duration-200 active:scale-[0.98] bg-blue-500 hover:bg-blue-600"
              {...tid(TestIds.sourcesSearchSubmit)}
              onClick={() => {
                void onSearch();
              }}
            >
              <ArrowForwardIcon style={{ fontSize: 16 }} />
            </IconButton>
          </div>
        </div>

        {isDeepResearchMode ? (
          <div className="px-3 pb-2 -mt-1">
            <Typography
              variant="small"
              className="text-[11px] text-gray-600 dark:text-slate-400 ux-slide-in"
            >
              {t('sources.search.hint.deep')}
            </Typography>
          </div>
        ) : null}
      </div>
    </div>
  );
}
