import {
  Send as SendIcon,
  QuestionAnswer as QuestionAnswerIcon,
  SaveAlt as SaveAltIcon,
  ContentCopy as ContentCopyIcon,
  FileDownload as FileDownloadIcon,
  NoteAdd as NoteAddIcon,
} from '@mui/icons-material';
import type { RefObject } from 'react';

import { t } from '../../../../shared/i18n';
import {
  IconButton,
  Typography,
  Spinner,
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
} from '../../../../shared/ui';
import type { ChatMessage } from './sourceDetailTypes';

interface SourceDetailQAPanelProps {
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  isLoading: boolean;
  isSavingAsSource: boolean;
  exportMenuOpen: string | null;
  onExportMenuOpenChange: (messageId: string | null) => void;
  messagesEndRef: RefObject<HTMLDivElement>;
  onSend: () => void;
  onCopyToClipboard: () => void;
  onDownloadAsFile: () => void;
  onSaveAsSource?: () => void;
  canSaveAsSource: boolean;
}

export function SourceDetailQAPanel({
  messages,
  inputValue,
  onInputChange,
  isLoading,
  isSavingAsSource,
  exportMenuOpen,
  onExportMenuOpenChange,
  messagesEndRef,
  onSend,
  onCopyToClipboard,
  onDownloadAsFile,
  onSaveAsSource,
  canSaveAsSource,
}: SourceDetailQAPanelProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white dark:bg-slate-900">
      <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
          <QuestionAnswerIcon style={{ fontSize: 14 }} />
          <Typography variant="small" className="font-medium text-xs">
            基于来源问答
          </Typography>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <Typography variant="small" className="text-gray-400 dark:text-slate-500 text-xs">
              在下方输入问题，获取基于此来源的针对性回答
            </Typography>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200'
                }`}
              >
                {message.content}
              </div>
              {message.role === 'assistant' && (
                <div className="flex items-end ml-1">
                  <Menu
                    placement="bottom-start"
                    open={exportMenuOpen === message.id}
                    handler={(isMenuOpen) => {
                      onExportMenuOpenChange(isMenuOpen ? message.id : null);
                    }}
                  >
                    <MenuHandler>
                      <IconButton
                        variant="text"
                        size="sm"
                        className="rounded-full w-5 h-5 min-w-[20px] text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:text-slate-200 opacity-0 group-hover:opacity-100 hover:opacity-100"
                        title="导出问答记录"
                        disabled={isSavingAsSource}
                        style={{ opacity: 1 }}
                      >
                        {isSavingAsSource ? (
                          <Spinner className="h-3 w-3" />
                        ) : (
                          <SaveAltIcon style={{ fontSize: 12 }} />
                        )}
                      </IconButton>
                    </MenuHandler>
                    <MenuList className="min-w-[160px]">
                      <MenuItem
                        className="flex items-center gap-2 text-xs"
                        onClick={() => {
                          onCopyToClipboard();
                          onExportMenuOpenChange(null);
                        }}
                      >
                        <ContentCopyIcon style={{ fontSize: 14 }} />
                        {t('common.copy_to_clipboard')}
                      </MenuItem>
                      <MenuItem
                        className="flex items-center gap-2 text-xs"
                        onClick={() => {
                          onDownloadAsFile();
                          onExportMenuOpenChange(null);
                        }}
                      >
                        <FileDownloadIcon style={{ fontSize: 14 }} />
                        {t('sources.detail.qa_export.download_markdown')}
                      </MenuItem>
                      {canSaveAsSource && onSaveAsSource && (
                        <MenuItem
                          className="flex items-center gap-2 text-xs"
                          onClick={() => {
                            onSaveAsSource();
                            onExportMenuOpenChange(null);
                          }}
                          disabled={isSavingAsSource}
                        >
                          <NoteAddIcon style={{ fontSize: 14 }} />
                          保存为来源
                        </MenuItem>
                      )}
                    </MenuList>
                  </Menu>
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-slate-800 px-3 py-2 rounded-xl flex items-center gap-2">
              <Spinner className="h-3 w-3" />
              <span className="text-xs text-gray-500 dark:text-slate-400">思考中...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
        <div className="relative">
          <input
            className="w-full h-9 pl-3 pr-10 rounded-full bg-gray-50 dark:bg-slate-800 border border-transparent focus:bg-white dark:bg-slate-900 focus:border-gray-200 dark:border-slate-700 focus:ring-0 text-sm outline-none transition-all placeholder:text-gray-400 dark:text-slate-500"
            placeholder="基于此来源内容提问..."
            value={inputValue}
            onChange={(e) => {
              onInputChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            disabled={isLoading}
            id="source-question-input"
            name="sourceQuestion"
            aria-label="基于来源内容提问"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            <IconButton
              size="sm"
              className={`rounded-full w-7 h-7 ${!inputValue.trim() || isLoading ? 'bg-gray-200 text-gray-400 dark:text-slate-500' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
              onClick={() => {
                onSend();
              }}
              aria-label="发送问题"
              disabled={!inputValue.trim() || isLoading}
            >
              <SendIcon style={{ fontSize: 14 }} />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}
