import {
  Close as CloseIcon,
  Link as LinkIcon,
  CloudDownload as CloudDownloadIcon,
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLayer } from '../../../../shared/layer';
import { useFocusTrap } from '../../shared/hooks/useFocusTrap';

type SourceFromUrlMode = 'link' | 'fetch';

interface AddSourceFromUrlDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (url: string, mode: SourceFromUrlMode) => Promise<void>;
  defaultMode?: SourceFromUrlMode;
}

function normalizeUrl(value: string): string {
  return value.trim();
}

function isLikelyHttpUrl(value: string): boolean {
  const url = value.trim().toLowerCase();
  return url.startsWith('http://') || url.startsWith('https://');
}

export default function AddSourceFromUrlDialog({
  open,
  onClose,
  onAdd,
  defaultMode = 'link',
}: AddSourceFromUrlDialogProps) {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<SourceFromUrlMode>(defaultMode);
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { style: modalStyle } = useLayer('modal');
  const modalRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = useMemo(() => {
    const normalized = normalizeUrl(url);
    return normalized.length > 0 && isLikelyHttpUrl(normalized) && !isAdding;
  }, [isAdding, url]);

  const handleClose = useCallback(() => {
    if (isAdding) return;
    setUrl('');
    setError('');
    setMode(defaultMode);
    onClose();
  }, [defaultMode, isAdding, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const normalized = normalizeUrl(url);
    setIsAdding(true);
    setError('');
    try {
      await onAdd(normalized, mode);
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '添加失败';
      setError(message);
    } finally {
      setIsAdding(false);
    }
  }, [canSubmit, handleClose, mode, onAdd, url]);

  useFocusTrap({
    active: open,
    containerRef: modalRef,
    onEscape: handleClose,
  });

  useEffect(() => {
    if (!open) return;
    urlInputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label="从 URL 导入来源"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-label="关闭对话框"
      />

      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg mx-4 ux-modal-in"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
          <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">从 URL 导入</div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="关闭"
            className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center text-gray-600 dark:text-slate-300"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setMode('link')}
              className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 ${
                mode === 'link'
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              <LinkIcon sx={{ fontSize: 16 }} />
              保存链接
            </button>
            <button
              type="button"
              onClick={() => setMode('fetch')}
              className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 ${
                mode === 'fetch'
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              <CloudDownloadIcon sx={{ fontSize: 16 }} />
              获取内容
            </button>
          </div>

          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">
            URL
            <input
              ref={urlInputRef}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/article"
              className="mt-1 w-full h-9 px-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-gray-500"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              inputMode="url"
            />
          </label>

          {url.trim().length > 0 && !isLikelyHttpUrl(url) ? (
            <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
              请输入以 http:// 或 https:// 开头的 URL。
            </div>
          ) : null}

          {mode === 'fetch' ? (
            <div className="mt-2 text-[11px] text-gray-500 dark:text-slate-400">
              获取内容会拉取并解析网页，通常需要数秒至约 2 分钟；网络不稳定时会自动超时并提示重试。
            </div>
          ) : null}

          {error ? (
            <div className="mt-2 text-[11px] text-red-700 dark:text-red-300">{error}</div>
          ) : null}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800"
              disabled={isAdding}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`px-3 py-1.5 rounded-lg text-xs ${
                canSubmit
                  ? 'bg-gray-900 text-white hover:bg-gray-800'
                  : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 cursor-not-allowed'
              }`}
            >
              {isAdding ? '添加中…' : '添加'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
