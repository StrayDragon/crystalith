import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button, Typography, Progress } from "@material-tailwind/react";
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Link as LinkIcon,
  CloudDownload as CloudDownloadIcon,
  RadioButtonUnchecked as PendingIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";

import type { SearchResultItem } from "./SearchResultCard";
import { useLayer } from "../../../../shared/layer";
import { useFocusTrap } from "../../shared/hooks/useFocusTrap";

interface AddSearchResultDialogProps {
  open: boolean;
  onClose: () => void;
  results: SearchResultItem[];
  mode: "fetch" | "link";
  onAddSource: (result: SearchResultItem, mode: "fetch" | "link") => Promise<void>;
  onComplete: () => void;
}

interface ResultStatus {
  url: string;
  status: "pending" | "loading" | "success" | "error" | "cancelled";
  error?: string;
}

type ProcessingState = "idle" | "running" | "done";

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
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [isCancelled, setIsCancelled] = useState(false);
  const cancelledRef = useRef(false);
  // Track which results batch we're processing to prevent re-runs
  const processedResultsRef = useRef<string | null>(null);

  // Compute a stable key for the current results batch
  const resultsKey = results.map((r) => r.url).join("|");

  // Initialize statuses when dialog opens with new results
  useEffect(() => {
    if (open && results.length > 0 && processedResultsRef.current !== resultsKey) {
      setStatuses(results.map((r) => ({ url: r.url, status: "pending" })));
      setProcessingState("idle");
      setIsCancelled(false);
      cancelledRef.current = false;
    }
  }, [open, results, resultsKey]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      processedResultsRef.current = null;
      setProcessingState("idle");
    }
  }, [open]);

  // Start processing when dialog opens - only runs once per results batch
  useEffect(() => {
    if (!open || processingState !== "idle" || statuses.length === 0) return;
    // Prevent re-processing the same batch
    if (processedResultsRef.current === resultsKey) return;

    const processResults = async () => {
      processedResultsRef.current = resultsKey;
      setProcessingState("running");

      for (let i = 0; i < results.length; i++) {
        // 检查是否已取消
        if (cancelledRef.current) {
          // 将剩余的 pending 状态标记为 cancelled
          setStatuses((prev) =>
            prev.map((s) => (s.status === "pending" ? { ...s, status: "cancelled" } : s)),
          );
          break;
        }

        const result = results[i];

        // Update status to loading
        setStatuses((prev) =>
          prev.map((s) => (s.url === result.url ? { ...s, status: "loading" } : s)),
        );

        try {
          // eslint-disable-next-line no-await-in-loop -- Keep serial semantics for cancellation + per-item progress updates.
          await onAddSource(result, mode);
          // 再次检查是否在请求过程中被取消
          if (cancelledRef.current) {
            setStatuses((prev) =>
              prev.map((s) =>
                s.url === result.url && s.status === "loading" ? { ...s, status: "cancelled" } : s,
              ),
            );
            break;
          }
          setStatuses((prev) =>
            prev.map((s) => (s.url === result.url ? { ...s, status: "success" } : s)),
          );
        } catch (err) {
          setStatuses((prev) =>
            prev.map((s) =>
              s.url === result.url
                ? { ...s, status: "error", error: err instanceof Error ? err.message : "添加失败" }
                : s,
            ),
          );
        }
      }

      setProcessingState("done");
    };

    processResults();
  }, [open, processingState, results, resultsKey, mode, onAddSource, statuses.length]);

  const isProcessing = processingState === "running";

  const completedCount = statuses.filter((s) => s.status === "success").length;
  const errorCount = statuses.filter((s) => s.status === "error").length;
  const cancelledCount = statuses.filter((s) => s.status === "cancelled").length;
  const processedCount = completedCount + errorCount + cancelledCount;
  const progress = statuses.length > 0 ? (processedCount / statuses.length) * 100 : 0;
  const allDone = processedCount === statuses.length && statuses.length > 0;
  const loadingIndex = statuses.findIndex((item) => item.status === "loading");
  const activeProgressCount = isProcessing
    ? loadingIndex >= 0
      ? loadingIndex + 1
      : Math.max(processedCount, 1)
    : processedCount;

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setIsCancelled(true);
  }, []);

  const handleRetryResult = useCallback(
    async (result: SearchResultItem) => {
      if (processingState === "running") return;

      setStatuses((prev) =>
        prev.map((item) =>
          item.url === result.url ? { ...item, status: "loading", error: undefined } : item,
        ),
      );

      try {
        await onAddSource(result, mode);
        setStatuses((prev) =>
          prev.map((item) =>
            item.url === result.url ? { ...item, status: "success", error: undefined } : item,
          ),
        );
      } catch (error) {
        setStatuses((prev) =>
          prev.map((item) =>
            item.url === result.url
              ? {
                  ...item,
                  status: "error",
                  error: error instanceof Error ? error.message : "添加失败",
                }
              : item,
          ),
        );
      }
    },
    [mode, onAddSource, processingState],
  );

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

  const modeLabel = mode === "fetch" ? "获取内容" : "保存链接";
  const ModeIcon = mode === "fetch" ? CloudDownloadIcon : LinkIcon;
  const { style: modalStyle } = useLayer("modal");
  const modalRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap({
    active: open,
    containerRef: modalRef,
    onEscape: handleClose,
  });

  // 不渲染如果不是打开状态
  if (!open) return null;

  // 使用 createPortal 直接渲染到 body，完全控制 z-index
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={allDone ? handleClose : undefined}
        disabled={!allDone}
        aria-label="关闭"
        tabIndex={-1}
      />

      {/* Dialog Content */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md mx-4 ux-modal-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ModeIcon style={{ fontSize: 20 }} className="text-gray-700 dark:text-slate-200" />
            <span className="text-base font-semibold text-gray-900 dark:text-slate-100">
              {isCancelled
                ? "已取消"
                : isProcessing
                  ? `正在添加 ${activeProgressCount}/${statuses.length} 个来源`
                  : allDone
                    ? "添加完成"
                    : `${modeLabel} - ${results.length} 项`}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            title="关闭"
          >
            <CloseIcon style={{ fontSize: 18 }} className="text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[300px] overflow-y-auto">
          {/* Progress bar */}
          {(isProcessing || allDone) && (
            <div className="mb-4">
              <Progress
                value={progress}
                color={errorCount > 0 ? "amber" : "gray"}
                className="h-2"
              />
              <Typography
                variant="small"
                className="text-[11px] text-gray-500 dark:text-slate-400 mt-1"
              >
                {isProcessing
                  ? `正在添加 ${activeProgressCount}/${statuses.length} 个来源`
                  : `${completedCount} / ${statuses.length} 完成`}
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
                  className={`flex items-center gap-2 p-2 rounded-lg ux-slide-in ${
                    status?.status === "error"
                      ? "bg-red-50"
                      : status?.status === "success"
                        ? "bg-green-50"
                        : status?.status === "cancelled"
                          ? "bg-gray-100 dark:bg-slate-800"
                          : "bg-gray-50 dark:bg-slate-800"
                  }`}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    {status?.status === "loading" && (
                      <div className="w-4 h-4 border-2 border-gray-300 dark:border-slate-600 border-t-gray-900 rounded-full animate-spin" />
                    )}
                    {status?.status === "success" && (
                      <CheckCircleIcon style={{ fontSize: 20 }} className="text-green-600" />
                    )}
                    {status?.status === "error" && (
                      <ErrorIcon style={{ fontSize: 20 }} className="text-red-500" />
                    )}
                    {status?.status === "cancelled" && (
                      <CancelIcon
                        style={{ fontSize: 20 }}
                        className="text-gray-400 dark:text-slate-500"
                      />
                    )}
                    {status?.status === "pending" && (
                      <PendingIcon style={{ fontSize: 18 }} className="text-gray-300" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <Typography
                      variant="small"
                      className="font-semibold text-xs text-gray-900 dark:text-slate-100 line-clamp-1"
                    >
                      {result.title}
                    </Typography>
                    <Typography
                      variant="small"
                      className="text-[10px] text-gray-500 dark:text-slate-400 truncate"
                    >
                      {new URL(result.url).hostname}
                    </Typography>
                    {status?.error && (
                      <>
                        <Typography variant="small" className="text-[10px] text-red-600 mt-0.5">
                          {status.error}
                        </Typography>
                        <button
                          type="button"
                          className="mt-1 text-[10px] font-semibold text-red-700 hover:underline"
                          onClick={() => handleRetryResult(result)}
                          disabled={status.status === "loading"}
                        >
                          重试
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-slate-700">
          {isProcessing && !isCancelled && (
            <Button variant="text" onClick={handleCancel} className="text-red-600 hover:bg-red-50">
              取消导入
            </Button>
          )}
          <Button
            variant={allDone || isCancelled ? "filled" : "text"}
            onClick={handleClose}
            className={allDone || isCancelled ? "bg-gray-900" : "text-gray-600 dark:text-slate-300"}
          >
            {allDone ? "完成" : isCancelled ? "关闭" : "取消"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
