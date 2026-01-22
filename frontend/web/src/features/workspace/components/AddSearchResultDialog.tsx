import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
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
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
}

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

  // Initialize statuses when dialog opens
  useEffect(() => {
    if (open && results.length > 0) {
      setStatuses(results.map((r) => ({ url: r.url, status: 'pending' })));
      setIsProcessing(false);
    }
  }, [open, results]);

  // Start processing when dialog opens
  useEffect(() => {
    if (!open || isProcessing || statuses.length === 0) return;

    const processResults = async () => {
      setIsProcessing(true);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];

        // Update status to loading
        setStatuses((prev) =>
          prev.map((s) => (s.url === result.url ? { ...s, status: 'loading' } : s)),
        );

        try {
          await onAddSource(result, mode);
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
  const progress = statuses.length > 0 ? (completedCount + errorCount) / statuses.length * 100 : 0;
  const allDone = completedCount + errorCount === statuses.length && statuses.length > 0;

  const handleClose = () => {
    if (allDone) {
      onComplete();
    }
    onClose();
  };

  const modeLabel = mode === 'fetch' ? '获取内容' : '保存链接';
  const ModeIcon = mode === 'fetch' ? CloudDownloadIcon : LinkIcon;

  return (
    <Dialog open={open} handler={handleClose} size="sm">
      <DialogHeader className="flex items-center gap-2">
        <ModeIcon style={{ fontSize: 20 }} className="text-gray-700" />
        <span className="text-base font-semibold">
          {isProcessing ? '正在添加来源…' : allDone ? '添加完成' : `${modeLabel} - ${results.length} 项`}
        </span>
      </DialogHeader>

      <DialogBody divider className="max-h-[300px] overflow-y-auto">
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
              {errorCount > 0 && ` (${errorCount} 失败)`}
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
      </DialogBody>

      <DialogFooter>
        <Button
          variant={allDone ? 'filled' : 'text'}
          onClick={handleClose}
          disabled={isProcessing && !allDone}
          className={allDone ? 'bg-gray-900' : 'text-gray-600'}
        >
          {allDone ? '完成' : '取消'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
