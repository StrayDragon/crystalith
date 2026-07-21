import { IconButton, Button, Typography, Chip } from '@material-tailwind/react';
import {
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

import { hasGeneratedBrief, type SourceBrief } from './sourceDetailTypes';

interface SourceDetailSummaryPanelProps {
  brief: SourceBrief | null;
  isBriefLoading: boolean;
  briefError: string;
  summaryCollapsed: boolean;
  onToggleCollapsed: () => void;
  onGenerateOrRefresh: () => void;
  canGenerate: boolean;
}

export function SourceDetailSummaryPanel({
  brief,
  isBriefLoading,
  briefError,
  summaryCollapsed,
  onToggleCollapsed,
  onGenerateOrRefresh,
  canGenerate,
}: SourceDetailSummaryPanelProps) {
  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
      <div className="w-full px-4 py-3 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-800/50 transition-colors">
        <button
          type="button"
          aria-expanded={!summaryCollapsed}
          aria-controls="source-detail-auto-summary"
          className="flex flex-1 items-center gap-2 text-blue-500 text-left"
          onClick={onToggleCollapsed}
        >
          <AutoAwesomeIcon style={{ fontSize: 16 }} />
          <Typography variant="small" className="font-semibold text-xs">
            自动摘要
          </Typography>
          {summaryCollapsed && hasGeneratedBrief(brief) && (
            <Typography
              variant="small"
              className="text-xs text-gray-400 dark:text-slate-500 font-normal ml-2 truncate max-w-[300px]"
            >
              {brief.summary.slice(0, 50)}...
            </Typography>
          )}
          {summaryCollapsed ? (
            <ExpandMoreIcon className="h-4 w-4 text-gray-400 dark:text-slate-500 ml-auto" />
          ) : (
            <ExpandLessIcon className="h-4 w-4 text-gray-400 dark:text-slate-500 ml-auto" />
          )}
        </button>
        {!summaryCollapsed && hasGeneratedBrief(brief) && (
          <IconButton
            variant="text"
            size="sm"
            onClick={onGenerateOrRefresh}
            disabled={isBriefLoading}
            className={`rounded-full w-6 h-6 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:text-slate-200 ${isBriefLoading ? 'animate-spin' : ''}`}
            aria-label="刷新摘要"
          >
            <RefreshIcon style={{ fontSize: 16 }} />
          </IconButton>
        )}
      </div>

      {!summaryCollapsed && (
        <div id="source-detail-auto-summary" className="px-4 pb-4">
          {isBriefLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-4/6 animate-pulse" />
            </div>
          ) : briefError ? (
            <div className="space-y-2">
              <Typography variant="small" color="red" className="text-xs">
                {briefError}
              </Typography>
              <Button
                size="sm"
                variant="outlined"
                className="normal-case text-xs"
                onClick={onGenerateOrRefresh}
                disabled={!canGenerate}
              >
                生成摘要
              </Button>
            </div>
          ) : hasGeneratedBrief(brief) ? (
            <div className="space-y-3">
              <Typography
                variant="small"
                className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed"
              >
                {brief.summary}
              </Typography>
              <div className="h-px bg-gray-200" />
              <div>
                <Typography
                  variant="small"
                  className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5"
                >
                  关键要点
                </Typography>
                <div className="space-y-1">
                  {(() => {
                    const keyCounts = new Map<string, number>();
                    return brief.keyPoints.map((point) => {
                      const ordinal = keyCounts.get(point) ?? 0;
                      keyCounts.set(point, ordinal + 1);
                      const pointKey = `${point}:${ordinal}`;
                      return (
                        <div key={pointKey} className="flex items-start gap-1.5">
                          <span className="text-gray-400 dark:text-slate-500 text-xs">•</span>
                          <Typography
                            variant="small"
                            className="text-[11px] text-gray-600 dark:text-slate-300 font-medium leading-tight"
                          >
                            {point}
                          </Typography>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex gap-1">
                  {brief.topics.map((topic) => (
                    <Chip
                      key={topic}
                      value={topic}
                      size="sm"
                      variant="ghost"
                      className="h-5 px-2 py-0 text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 normal-case font-normal"
                    />
                  ))}
                </div>
                <Typography
                  variant="small"
                  className="text-[10px] text-gray-500 dark:text-slate-400 font-medium"
                >
                  约 {brief.wordCount.toLocaleString()} 字
                </Typography>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Typography variant="small" className="text-xs text-gray-500 dark:text-slate-400">
                尚未生成自动摘要
              </Typography>
              <Button
                size="sm"
                variant="outlined"
                className="normal-case text-xs"
                onClick={onGenerateOrRefresh}
                disabled={!canGenerate || isBriefLoading}
              >
                生成摘要
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
