import { Button, Checkbox, Spinner } from '@material-tailwind/react';
import { Close as CloseIcon } from '@mui/icons-material';
import { type Dispatch, type SetStateAction } from 'react';

import { copyToClipboard } from '../../../../../shared/clipboard';
import { useLayer } from '../../../../../shared/layer';
import { toast } from '../../../../../shared/toast';
import type { ResearchSessionDetail } from '../useResearch';

export interface ResultsDialogContentProps {
  session: ResearchSessionDetail;
  selectedResults: Set<number>;
  setSelectedResults: Dispatch<SetStateAction<Set<number>>>;
  onClose: () => void;
  onAddSourceFromUrl?: (url: string) => Promise<void>;
  isAddingSources: boolean;
  setIsAddingSources: Dispatch<SetStateAction<boolean>>;
}

export function ResultsDialogContent({
  session,
  selectedResults,
  setSelectedResults,
  onClose,
  onAddSourceFromUrl,
  isAddingSources,
  setIsAddingSources,
}: ResultsDialogContentProps) {
  const { style: modalStyle } = useLayer('modal');
  const aggregatedResults = session.aggregatedResults ?? [];

  const handleCopyLinks = () => {
    const selectedUrls = Array.from(selectedResults)
      .map((i) => aggregatedResults[i]?.url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0);
    void copyToClipboard(selectedUrls.join('\n')).then((success) => {
      if (success) {
        toast.success(`已复制 ${selectedUrls.length} 个链接`);
      } else {
        toast.error('复制失败，请稍后重试');
      }
    });
  };

  const handleAddSources = async () => {
    if (!onAddSourceFromUrl) return;
    setIsAddingSources(true);
    try {
      const selectedUrls = Array.from(selectedResults)
        .map((i) => aggregatedResults[i]?.url)
        .filter((url): url is string => typeof url === 'string' && url.length > 0);
      const results = await Promise.allSettled(selectedUrls.map((url) => onAddSourceFromUrl(url)));
      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error('Failed to add source:', selectedUrls[index], result.reason);
        }
      });
      if (successCount > 0) {
        toast.success(`已添加 ${successCount} 个来源`);
      }
      if (successCount < selectedUrls.length) {
        toast.error(`${selectedUrls.length - successCount} 个来源添加失败`);
      }
      onClose();
    } finally {
      setIsAddingSources(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 relative"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label="搜索结果"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        onClick={onClose}
        aria-label="关闭对话框"
      />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col relative z-10">
        {/* Dialog Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">搜索结果</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              共 {aggregatedResults.length} 条结果，已选 {selectedResults.size} 条
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedResults.size === aggregatedResults.length) {
                  setSelectedResults(new Set());
                } else {
                  setSelectedResults(new Set(aggregatedResults.map((_, i) => i)));
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1"
            >
              {selectedResults.size === aggregatedResults.length ? '取消全选' : '全选'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <CloseIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {(() => {
            const keyCounts = new Map<string, number>();
            return aggregatedResults.map((result, index) => {
              const url = typeof result.url === 'string' ? result.url : '';
              const title = typeof result.title === 'string' ? result.title : null;
              const snippet = typeof result.snippet === 'string' ? result.snippet : null;
              const source = typeof result.source === 'string' ? result.source : null;
              const iteration = typeof result.iteration === 'number' ? result.iteration : null;
              const baseKey = `${url}:${title ?? ''}:${source ?? ''}:${iteration ?? ''}`;
              const ordinal = keyCounts.get(baseKey) ?? 0;
              keyCounts.set(baseKey, ordinal + 1);
              const resultKey = `${baseKey}:${ordinal}`;
              const checkboxId = `research-result-${index}`;
              return (
                <label
                  key={resultKey}
                  htmlFor={checkboxId}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedResults.has(index)
                      ? 'border-blue-300 bg-blue-50/50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={selectedResults.has(index)}
                    onChange={() => {
                      setSelectedResults((prev) => {
                        const next = new Set(prev);
                        if (next.has(index)) {
                          next.delete(index);
                        } else {
                          next.add(index);
                        }
                        return next;
                      });
                    }}
                    crossOrigin={undefined}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline line-clamp-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {title || '未知标题'}
                    </a>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {snippet || '无摘要'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{source || 'web'}</span>
                      {iteration != null && (
                        <span className="text-xs text-gray-400">· 第 {iteration} 轮</span>
                      )}
                    </div>
                  </div>
                </label>
              );
            });
          })()}
        </div>

        {/* Dialog Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <span className="text-sm text-gray-500">选中的链接可以添加为来源</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outlined" color="gray" onClick={onClose}>
              取消
            </Button>
            <Button
              size="sm"
              variant="outlined"
              color="blue"
              disabled={selectedResults.size === 0}
              onClick={handleCopyLinks}
            >
              复制链接
            </Button>
            {onAddSourceFromUrl && (
              <Button
                size="sm"
                color="blue"
                disabled={selectedResults.size === 0 || isAddingSources}
                onClick={() => {
                  void handleAddSources();
                }}
              >
                {isAddingSources ? (
                  <>
                    <Spinner className="h-4 w-4 mr-1" />
                    添加中...
                  </>
                ) : (
                  `添加 ${selectedResults.size} 个来源`
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
