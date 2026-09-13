import {
  CloudUpload as CloudUploadIcon,
  Hub as HubIcon,
  Link as LinkIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import type { Ref, RefObject } from 'react';

import { t } from '../../../../../shared/i18n';
import { TestIds, tid } from '../../../../../shared/testids';
import { toast } from '../../../../../shared/toast';
import type { AsyncStatus } from '../../../../../shared/types';
import { Button, Spinner, Typography, Tooltip } from '../../../../../shared/ui';
import { SOURCE_UPLOAD_ACCEPT } from '../../../shared/uploadTypes';
import type { SourceUploadItem } from '../useSources';
import { splitUploadFiles } from './sources-panel-utils';

export interface SourcesPanelUploadSectionProps {
  uploadDisabled: boolean;
  connectorDisabled: boolean;
  uploadDragActive: boolean;
  onUploadDragActiveChange: (active: boolean) => void;
  uploadState: AsyncStatus;
  uploadHint: string;
  onUploadHintChange: (hint: string) => void;
  uploadError?: string;
  uploadQueue: SourceUploadItem[];
  onUpload: (input: File | File[] | FileList | null) => void;
  onRetryUpload?: () => void;
  onClearUploadQueue?: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onOpenConnectors: () => void;
  onOpenUrlImport?: () => void;
  extractorTooltip: string;
  onOpenExtractorPolicy: () => void;
}

const secondaryBtnClass =
  'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 text-[11px] font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-100';

export default function SourcesPanelUploadSection({
  uploadDisabled,
  connectorDisabled,
  uploadDragActive,
  onUploadDragActiveChange,
  uploadState,
  uploadHint,
  onUploadHintChange,
  uploadError = '',
  uploadQueue,
  onUpload,
  onRetryUpload,
  onClearUploadQueue,
  fileInputRef,
  onOpenConnectors,
  onOpenUrlImport,
  extractorTooltip,
  onOpenExtractorPolicy,
}: SourcesPanelUploadSectionProps) {
  return (
    <>
      {/* L1: primary add / upload */}
      <Tooltip content={t('sources.upload.tooltip')}>
        <div
          className={`rounded-xl ${uploadDragActive ? 'ring-2 ring-blue-200' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (uploadDisabled) return;
            onUploadDragActiveChange(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            onUploadDragActiveChange(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            onUploadDragActiveChange(false);
            if (uploadDisabled) return;
            const droppedFiles = Array.from(event.dataTransfer.files ?? []);
            if (!droppedFiles.length) return;
            const { supported, unsupported } = splitUploadFiles(droppedFiles);
            if (unsupported.length > 0) {
              toast.warning(t('sources.upload.toast.unsupported', { count: unsupported.length }));
            }
            if (supported.length === 0) {
              onUploadHintChange(t('sources.upload.hint.only_supported'));
              return;
            }
            onUploadHintChange(
              unsupported.length > 0
                ? t('sources.upload.hint.filtered_ready', {
                    unsupported: unsupported.length,
                    supported: supported.length,
                  })
                : t('sources.upload.hint.default'),
            );
            onUpload(supported);
          }}
        >
          <Button
            variant="outlined"
            fullWidth
            size="sm"
            disabled={uploadDisabled}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-dashed border-gray-300 normal-case font-normal text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-400"
            {...tid(TestIds.sourcesAdd)}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadState === 'loading' ? (
              <Spinner className="h-3 w-3" />
            ) : (
              <CloudUploadIcon style={{ fontSize: 18 }} />
            )}
            {uploadDragActive
              ? t('sources.upload.drag_drop')
              : uploadState === 'loading'
                ? t('sources.upload.uploading')
                : t('sources.upload.add_sources')}
            <input
              // RefObject from parent matches useRef; hidden input ref typing is stricter.
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              ref={fileInputRef as Ref<HTMLInputElement>}
              type="file"
              hidden
              multiple
              accept={SOURCE_UPLOAD_ACCEPT}
              {...tid(TestIds.sourcesUploadInput)}
              onChange={(event) => {
                const selectedFiles = Array.from(event.target.files ?? []);
                const { supported, unsupported } = splitUploadFiles(selectedFiles);
                if (unsupported.length > 0) {
                  toast.warning(
                    t('sources.upload.toast.unsupported', { count: unsupported.length }),
                  );
                }
                if (supported.length > 0) {
                  onUpload(supported);
                }
                if (event.target) {
                  event.target.value = '';
                }
              }}
              disabled={uploadDisabled}
              id="source-upload-input"
              name="sourceUpload"
              aria-label={t('sources.upload.aria_label')}
            />
          </Button>
        </div>
      </Tooltip>

      {/* L2: equal-weight secondary actions — URL / connectors / extractor */}
      <div className="flex items-stretch gap-1.5" role="group" aria-label="更多来源操作">
        {onOpenUrlImport ? (
          <Tooltip content="从网页链接导入来源">
            <button
              type="button"
              disabled={uploadDisabled}
              className={secondaryBtnClass}
              {...tid(TestIds.urlImportOpen)}
              onClick={onOpenUrlImport}
            >
              <LinkIcon style={{ fontSize: 15 }} />
              URL
            </button>
          </Tooltip>
        ) : null}
        <Tooltip content="通过连接器接入外部资料仓（如 Obsidian / 本地目录）">
          <button
            type="button"
            disabled={connectorDisabled}
            className={secondaryBtnClass}
            {...tid(TestIds.sourcesConnectors)}
            onClick={onOpenConnectors}
          >
            <HubIcon style={{ fontSize: 15 }} />
            连接器
          </button>
        </Tooltip>
        <Tooltip content={extractorTooltip}>
          <button
            type="button"
            className={secondaryBtnClass}
            {...tid(TestIds.sourcesExtractorSettings)}
            onClick={onOpenExtractorPolicy}
            aria-label="提取器设置"
          >
            <TuneIcon style={{ fontSize: 15 }} />
            提取器
          </button>
        </Tooltip>
      </div>

      {uploadDragActive || uploadHint !== t('sources.upload.hint.default') ? (
        <Typography
          variant="small"
          className="text-[10px] text-gray-400 dark:text-slate-500 px-0.5 -mt-0.5"
        >
          {uploadDragActive ? '拖放文件到此处' : uploadHint}
        </Typography>
      ) : null}

      {uploadError ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          <span className="flex-1">{uploadError}</span>
          {onRetryUpload ? (
            <button
              type="button"
              className="font-semibold text-red-800 hover:underline"
              onClick={onRetryUpload}
            >
              重试上传
            </button>
          ) : null}
        </div>
      ) : null}

      {uploadQueue.length > 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <Typography variant="small" className="text-[11px] font-semibold text-gray-600">
              上传队列
            </Typography>
            {onClearUploadQueue ? (
              <button
                type="button"
                className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-200"
                onClick={onClearUploadQueue}
              >
                清空
              </button>
            ) : null}
          </div>
          <div className="space-y-1">
            {uploadQueue.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-[11px] text-gray-600"
              >
                <span className="truncate pr-2">{item.name}</span>
                <span
                  className={
                    item.status === 'error'
                      ? 'text-red-600'
                      : item.status === 'success'
                        ? 'text-green-600'
                        : 'text-blue-600'
                  }
                >
                  {item.status === 'queued'
                    ? '等待中'
                    : item.status === 'uploading'
                      ? '上传中'
                      : item.status === 'success'
                        ? '完成'
                        : '失败'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
