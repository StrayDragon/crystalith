import { AutoAwesome as AutoAwesomeIcon, Psychology as PsychologyIcon } from '@mui/icons-material';

import type { ResearchThinkingWindow } from '../useResearchThinkingWindow';
import { ThinkingBlock } from './ThinkingBlock';

type ResearchThinkingPanelProps = ResearchThinkingWindow & {
  timelineLength: number;
  isSearching: boolean;
  isAnalyzing: boolean;
  isPlanning: boolean;
};

export function ResearchThinkingPanel({
  timelineLength,
  isSearching,
  isAnalyzing,
  isPlanning,
  showThinking,
  setShowThinking,
  showAllThinking,
  visibleThinkingCount,
  setVisibleThinkingCount,
  collapsedBlocks,
  thinkingScrollRef,
  thinkingWindow,
  visibleThinking,
  hiddenThinkingCount,
  isExpandingThinking,
  loadMoreCap,
  maxVisibleThinking,
  renderBatchSize,
  handleToggleShowAll,
  shiftThinkingWindow,
  jumpToLatestThinking,
  toggleBlockCollapse,
  handleTypewriterComplete,
}: ResearchThinkingPanelProps) {
  return (
    <div className="w-80 border-r border-gray-100 flex flex-col flex-shrink-0 bg-gray-50/30">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <PsychologyIcon className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-gray-700">思考过程</span>
          {timelineLength > 0 && (
            <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">
              {timelineLength}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {timelineLength > maxVisibleThinking && showThinking && (
            <button
              onClick={handleToggleShowAll}
              className="text-[11px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
            >
              {showAllThinking ? '仅显示最新' : '显示全部'}
            </button>
          )}
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          >
            {showThinking ? '收起' : '展开'}
          </button>
        </div>
      </div>
      {showThinking && (
        <div ref={thinkingScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 scroll-smooth">
          {showAllThinking && thinkingWindow.total > 0 && (
            <div className="flex items-center justify-between text-[11px] text-gray-500 bg-gray-100 rounded px-2 py-1">
              <span>
                已展示 {thinkingWindow.start + 1}-{thinkingWindow.end} / {thinkingWindow.total} 条
              </span>
              <div className="flex items-center gap-1">
                {thinkingWindow.start > thinkingWindow.minStart && (
                  <button
                    onClick={() => shiftThinkingWindow(-renderBatchSize)}
                    className="text-[11px] text-purple-600 hover:text-purple-700"
                  >
                    更早
                  </button>
                )}
                {thinkingWindow.start < thinkingWindow.maxStart && (
                  <button
                    onClick={jumpToLatestThinking}
                    className="text-[11px] text-purple-600 hover:text-purple-700"
                  >
                    最新
                  </button>
                )}
              </div>
            </div>
          )}
          {!showAllThinking && hiddenThinkingCount > 0 && (
            <div className="flex items-center justify-between text-[11px] text-gray-500 bg-gray-100 rounded px-2 py-1">
              <span>已隐藏 {hiddenThinkingCount} 条较早记录</span>
              <button
                onClick={() =>
                  setVisibleThinkingCount((prev) =>
                    Math.min(prev + maxVisibleThinking, loadMoreCap),
                  )
                }
                className="text-[11px] text-purple-600 hover:text-purple-700"
              >
                加载更多
              </button>
            </div>
          )}
          {showAllThinking && isExpandingThinking && (
            <div className="flex items-center justify-between text-[11px] text-gray-500 bg-gray-100 rounded px-2 py-1">
              <span>
                正在展开 {Math.min(visibleThinkingCount, thinkingWindow.expandedCap)}/
                {thinkingWindow.expandedCap} 条记录
              </span>
              <span className="text-purple-600">...</span>
            </div>
          )}
          {timelineLength === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <AutoAwesomeIcon className="w-8 h-8 mb-2 animate-pulse opacity-50" />
              <span className="text-sm">等待思考内容...</span>
            </div>
          ) : (
            <>
              {visibleThinking.items.map((item, index) => {
                const globalIndex = index + visibleThinking.offset;
                const isLatest = globalIndex === timelineLength - 1;
                const isCollapsed = collapsedBlocks.has(globalIndex);

                return (
                  <ThinkingBlock
                    key={globalIndex}
                    item={item}
                    isLatest={isLatest}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleBlockCollapse(globalIndex)}
                    onTypewriterComplete={handleTypewriterComplete}
                  />
                );
              })}
            </>
          )}
          {/* Auto-scroll indicator when processing and typewriter not yet showing */}
          {(isSearching || isAnalyzing || isPlanning) && timelineLength === 0 && (
            <div className="flex items-center gap-2 text-sm text-purple-500 bg-purple-50 p-3 rounded-lg border border-purple-100 animate-pulse">
              <AutoAwesomeIcon className="w-4 h-4 animate-spin" />
              <span>正在思考中...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
