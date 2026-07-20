import { Button, IconButton, Spinner } from '@material-tailwind/react';
import {
  Close as CloseIcon,
  Description as DescriptionIcon,
  Note as NoteIcon,
  Source as SourceIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { memo, useCallback, useState } from 'react';

import { useLayer } from '../../../../shared/layer';
import { TestIds, tid } from '../../../../shared/testids';
import { toast } from '../../../../shared/toast';
import type { ResearchSessionDetail } from './useResearch';

interface ResearchExportDialogProps {
  session: ResearchSessionDetail;
  onClose: () => void;
}

type ExportTarget = 'source' | 'note';

/**
 * Export dialog shell — Deep Research export API removed (pending rewrite).
 * Submit only surfaces the stub "尚未实现" toast until the new runtime lands.
 */
function ResearchExportDialog({ session, onClose }: ResearchExportDialogProps) {
  const [exportTarget, setExportTarget] = useState<ExportTarget>('source');
  const [isExporting, setIsExporting] = useState(false);
  const { style: modalStyle } = useLayer('modal');

  const hasReport = Boolean(session.finalReport?.trim());
  const reportChars = session.finalReport?.length ?? 0;

  const handleExport = useCallback(async () => {
    if (!hasReport) {
      toast.error('当前研究没有可导出的最终报告');
      return;
    }

    setIsExporting(true);
    try {
      toast.error('深度研究尚未实现，等待重写');
      onClose();
    } finally {
      setIsExporting(false);
    }
  }, [hasReport, onClose]);

  return (
    <div
      className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label="导出研究成果"
      {...tid(TestIds.researchExportDialog)}
    >
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-lg animate-in zoom-in-95 fade-in duration-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <DownloadIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">导出研究成果</h2>
              <p className="text-sm text-gray-500">将完整研究报告导出到笔记本</p>
            </div>
          </div>
          <IconButton variant="text" size="sm" onClick={onClose}>
            <CloseIcon className="w-5 h-5" />
          </IconButton>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">导出目标</h3>
            <div className="flex gap-3">
              <label
                className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  exportTarget === 'source'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="export-target"
                  checked={exportTarget === 'source'}
                  onChange={() => setExportTarget('source')}
                  className="h-4 w-4 text-blue-600"
                />
                <SourceIcon
                  className={`w-5 h-5 ${exportTarget === 'source' ? 'text-blue-600' : 'text-gray-400'}`}
                />
                <div>
                  <p className="font-medium text-gray-900">来源</p>
                  <p className="text-xs text-gray-500">作为可搜索的知识来源</p>
                </div>
              </label>
              <label
                className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  exportTarget === 'note'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="export-target"
                  checked={exportTarget === 'note'}
                  onChange={() => setExportTarget('note')}
                  className="h-4 w-4 text-blue-600"
                />
                <NoteIcon
                  className={`w-5 h-5 ${exportTarget === 'note' ? 'text-blue-600' : 'text-gray-400'}`}
                />
                <div>
                  <p className="font-medium text-gray-900">笔记</p>
                  <p className="text-xs text-gray-500">作为 Studio 中的笔记</p>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-start gap-3">
            <DescriptionIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">
                研究报告：{session.topic.slice(0, 40)}
                {session.topic.length > 40 ? '…' : ''}
              </p>
              {hasReport ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  将导出完整最终报告（约 {reportChars} 字）。参考链接筛选暂未接入服务端。
                </p>
              ) : (
                <p className="text-xs text-red-600 mt-0.5">当前会话还没有最终报告，无法导出。</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
          <Button variant="outlined" color="gray" onClick={onClose} disabled={isExporting}>
            取消
          </Button>
          <Button
            color="blue"
            onClick={() => {
              void handleExport();
            }}
            disabled={isExporting || !hasReport}
            className="flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <Spinner className="h-4 w-4" />
                导出中...
              </>
            ) : (
              <>
                <DownloadIcon className="w-4 h-4" />
                导出到{exportTarget === 'source' ? '来源' : '笔记'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(ResearchExportDialog);
