import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Button,
  Typography,
  Progress,
} from '@material-tailwind/react';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Link as LinkIcon,
  CloudDownload as CloudDownloadIcon,
  RadioButtonUnchecked as PendingIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';

import type { SearchResultItem } from './SearchResultCard';

interface AddSearchResultDialogProps {
  open: boolean;
  onClose: () => void;
  results: SearchResultItem[];
  mode: 'fetch' | 'link';
  onAddSource: (result: SearchResultItem, mode: 'fetch' | 'link') => Promise<void>;
  onComplete: () => void;
}

interface ResultStatus {
  url: string;
  status: 'pending' | 'loading' | 'success' | 'error' | 'cancelled';
  error?: string;
}

/**
 * 自定义 Portal Modal 组件
 * 不使用 Material Tailwind Dialog 以完全控制 z-index 堆叠
 */
export default function AddSearchResultDialog({
  open,
  onClose,
  results,
  mode,
  onAddSource,
  onComplete,
}: AddSearchResultDialogProps) {
  const [statuses, setStatuses] = useState<ResultStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const cancelledRef = useRef(false);

  // Initialize statuses when dialog opens
  useEffect(() => {
    if (open && results.length > 0) {
      setStatuses(results.map((r) => ({ url: r.url, status: 'pending' })));
      setIsProcessing(false);
      setIsCancelled(false);
      cancelledRef.current = false;
    }
  }, [open, results]);

  // Start processing when dialog opens
  useEffect(() => {
    if (!open || isProcessing || statuses.length === 0) return;

    const processResults = async () => {
      setIsProcessing(true);

      for (let i = 0; i < results.length; i++) {
        // 检查是否已取消
        if (cancelledRef.current) {
          // 将剩余的 pending 状态标记为 cancelled
          setStatuses((prev) =>
            prev.map((s) => (s.status === 'pending' ? { ...s, status: 'cancelled' } : s)),
          );
          break;
        }

        const result = results[i];

        // Update status to loading
        setStatuses((prev) =>
          prev.map((s) => (s.url === result.url ? { ...s, status: 'loading' } : s)),
        );

        try {
          await onAddSource(result, mode);
          // 再次检查是否在请求过程中被取消
          if (cancelledRef.current) {
            setStatuses((prev) =>
              prev.map((s) => (s.url === result.url && s.status === 'loading' ? { ...s, status: 'cancelled' } : s)),
            );
            break;
          }
          setStatuses((prev) =>
            prev.map((s) => (s.url === result.url ? { ...s, status: 'success' } : s)),
          );
        } catch (err) {
          setStatuses((prev) =>
            prev.map((s) =>
              s.url === result.url
                ? { ...s, status: 'error', error: err instanceof Error ? err.message : '添加失败' }
                : s,
            ),
          );
        }
      }

      setIsProcessing(false);
    };

    processResults();
  }, [open, isProcessing, results, mode, onAddSource, statuses.length]);

  const completedCount = statuses.filter((s) => s.status === 'success').length;
  const errorCount = statuses.filter((s) => s.status === 'error').length;
  const cancelledCount = statuses.filter((s) => s.status === 'cancelled').length;
  const processedCount = completedCount + errorCount + cancelledCount;
  const progress = statuses.length > 0 ? processedCount / statuses.length * 100 : 0;
  const allDone = processedCount === statuses.length && statuses.length > 0;

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setIsCancelled(true);
  }, []);

  const handleClose = useCallback(() => {
    // 如果正在处理，先取消
    if (isProcessing && !isCancelled) {
      handleCancel();
    }
    if (completedCount > 0) {
      onComplete();
    }
    onClose();
  }, [isProcessing, isCancelled, completedCount, onComplete, onClose, handleCancel]);

  const modeLabel = mode === 'fetch' ? '获取内容' : '保存链接';
  const ModeIcon = mode === 'fetch' ? CloudDownloadIcon : LinkIcon;

  // 不渲染如果不是打开状态
  if (!open) return null;

  // 使用 createPortal 直接渲染到 body，完全控制 z-index
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={allDone ? handleClose : undefined}
      />

      {/* Dialog Content */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ModeIcon style={{ fontSize: 20 }} className="text-gray-700" />
            <span className="text-base font-semibold text-gray-900">
              {isCancelled
                ? '已取消'
                : isProcessing
                  ? '正在添加来源…'
                  : allDone
                    ? '添加完成'
                    : `${modeLabel} - ${results.length} 项`}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            title="关闭"
          >
            <CloseIcon style={{ fontSize: 18 }} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[300px] overflow-y-auto">
          {/* Progress bar */}
          {(isProcessing || allDone) && (
            <div className="mb-4">
              <Progress
                value={progress}
                color={errorCount > 0 ? 'amber' : 'gray'}
                className="h-2"
              />
              <Typography variant="small" className="text-[11px] text-gray-500 mt-1">
                {completedCount} / {statuses.length} 完成
                {errorCount > 0 && ` · ${errorCount} 失败`}
                {cancelledCount > 0 && ` · ${cancelledCount} 已取消`}
              </Typography>
            </div>
          )}

          {/* Results list */}
          <div className="flex flex-col gap-2">
            {results.map((result) => {
              const status = statuses.find((s) => s.url === result.url);
              return (
                <div
                  key={result.url}
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    status?.status === 'error'
                      ? 'bg-red-50'
                      : status?.status === 'success'
                        ? 'bg-green-50'
                        : status?.status === 'cancelled'
                          ? 'bg-gray-100'
                          : 'bg-gray-50'
                  }`}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    {status?.status === 'loading' && (
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                    )}
                    {status?.status === 'success' && (
                      <CheckCircleIcon style={{ fontSize: 20 }} className="text-green-600" />
                    )}
                    {status?.status === 'error' && (
                      <ErrorIcon style={{ fontSize: 20 }} className="text-red-500" />
                    )}
                    {status?.status === 'cancelled' && (
                      <CancelIcon style={{ fontSize: 20 }} className="text-gray-400" />
                    )}
                    {status?.status === 'pending' && (
                      <PendingIcon style={{ fontSize: 18 }} className="text-gray-300" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <Typography
                      variant="small"
                      className="font-semibold text-xs text-gray-900 line-clamp-1"
                    >
                      {result.title}
                    </Typography>
                    <Typography
                      variant="small"
                      className="text-[10px] text-gray-500 truncate"
                    >
                      {new URL(result.url).hostname}
                    </Typography>
                    {status?.error && (
                      <Typography
                        variant="small"
                        className="text-[10px] text-red-600 mt-0.5"
                      >
                        {status.error}
                      </Typography>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          {isProcessing && !isCancelled && (
            <Button
              variant="text"
              onClick={handleCancel}
              className="text-red-600 hover:bg-red-50"
            >
              取消导入
            </Button>
          )}
          <Button
            variant={allDone || isCancelled ? 'filled' : 'text'}
            onClick={handleClose}
            className={allDone || isCancelled ? 'bg-gray-900' : 'text-gray-600'}
          >
            {allDone ? '完成' : isCancelled ? '关闭' : '取消'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
