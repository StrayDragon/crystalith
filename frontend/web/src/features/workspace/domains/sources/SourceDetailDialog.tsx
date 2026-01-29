import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogBody,
  IconButton,
  Typography,
  Chip,
  Spinner,
  Tabs,
  TabsHeader,
  TabsBody,
  Tab,
  TabPanel,
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
} from '@material-tailwind/react';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Description as DescriptionIcon,
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  DataObject as DataObjectIcon,
  QuestionAnswer as QuestionAnswerIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  SaveAlt as SaveAltIcon,
  ContentCopy as ContentCopyIcon,
  FileDownload as FileDownloadIcon,
  NoteAdd as NoteAddIcon,
} from '@mui/icons-material';

import {
  getSourceSummaryV1NotebooksNotebookIdSourcesSourceIdSummaryGet as getSourceSummary,
  sourceQaV1NotebooksNotebookIdSourcesSourceIdQaPost as askSourceQuestion,
  listSourceChunksV1NotebooksNotebookIdSourcesSourceIdChunksGet as listSourceChunks,
  type ChunkRead,
} from '../../../../api/generated';
import { useWorkspaceState } from '../../app/WorkspaceContext';
import type { SourceItem } from '../../shared/types';
import { toast } from '../../../../shared/toast';
import { useLayer } from '../../../../shared/layer';
import { copyToClipboard } from '../../../../shared/clipboard';

interface SourceDetailDialogProps {
  open: boolean;
  source: SourceItem | null;
  onClose: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onSaveQAAsSource?: (sourceTitle: string, messages: ChatMessage[]) => Promise<void>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SourceBrief {
  summary: string;
  keyPoints: string[];
  topics: string[];
  wordCount: number;
  generatedAt: Date;
}

// Cache for source briefs and chunks
const briefCache = new Map<number, SourceBrief>();
const chunksCache = new Map<number, ChunkRead[]>();

type TabValue = 'overview' | 'raw';

// Chunk item component with expand/collapse
function ChunkItem({ chunk, index }: { chunk: ChunkRead; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const wordCount = chunk.text.split(/\s+/).length;
  const charCount = chunk.text.length;
  const previewLength = 150;
  const needsTruncate = chunk.text.length > previewLength;

  return (
    <div className="border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors">
      <button
        type="button"
        className="w-full p-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 text-gray-600 text-xs font-medium">
              #{chunk.chunk_index + 1}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <Typography variant="small" className="text-xs text-gray-700 leading-relaxed">
              {expanded || !needsTruncate
                ? chunk.text
                : `${chunk.text.slice(0, previewLength)}...`}
            </Typography>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {needsTruncate && (
              expanded ? (
                <ExpandLessIcon className="h-4 w-4 text-gray-400" />
              ) : (
                <ExpandMoreIcon className="h-4 w-4 text-gray-400" />
              )
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
          <span>{charCount} 字符</span>
          {chunk.start_offset !== null && chunk.end_offset !== null && (
            <span>位置: {chunk.start_offset}-{chunk.end_offset}</span>
          )}
          {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
            <span className="text-blue-400">有元数据</span>
          )}
        </div>
      </button>
      {expanded && chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
        <div className="px-3 pb-3 pt-0">
          <div className="p-2 bg-gray-50 rounded text-[10px] font-mono text-gray-500 overflow-x-auto">
            {JSON.stringify(chunk.metadata, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SourceDetailDialog({ open, source, onClose, isFullscreen = false, onToggleFullscreen, onSaveQAAsSource }: SourceDetailDialogProps) {
  const state = useWorkspaceState();
  const notebookId = state.activeNotebookId;
  const isConnected = state.connectionState === 'live';

  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [brief, setBrief] = useState<SourceBrief | null>(null);
  const [isBriefLoading, setIsBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string>('');
  const [chunks, setChunks] = useState<ChunkRead[]>([]);
  const [isChunksLoading, setIsChunksLoading] = useState(false);
  const [chunksError, setChunksError] = useState<string>('');
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [isSavingAsSource, setIsSavingAsSource] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load or generate brief when source changes
  useEffect(() => {
    if (!source || !open) return;

    // Check cache first
    const cached = briefCache.get(source.id);
    if (cached) {
      setBrief(cached);
      setBriefError('');
      return;
    }

    if (!notebookId || !isConnected) {
      setBrief(null);
      setBriefError('未连接到后端服务，无法生成摘要。');
      setIsBriefLoading(false);
      return;
    }

    // Call real API
    setIsBriefLoading(true);
    setBriefError('');
    getSourceSummary({ path: { notebook_id: notebookId, source_id: source.id } })
      .then((response) => {
        const newBrief: SourceBrief = {
          summary: response.summary,
          keyPoints: response.key_points,
          topics: response.topics,
          wordCount: response.word_count,
          generatedAt: new Date(response.generated_at),
        };
        briefCache.set(source.id, newBrief);
        setBrief(newBrief);
      })
      .catch((err) => {
        setBriefError(err.message || '加载摘要失败');
      })
      .finally(() => {
        setIsBriefLoading(false);
      });
  }, [source, open, notebookId, isConnected]);

  // Load chunks when switching to raw tab
  useEffect(() => {
    if (!source || !open || activeTab !== 'raw') return;

    // Check cache first
    const cached = chunksCache.get(source.id);
    if (cached) {
      setChunks(cached);
      setChunksError('');
      return;
    }

    if (!notebookId || !isConnected) {
      setChunks([]);
      setChunksError('未连接到后端服务，无法加载原始内容。');
      setIsChunksLoading(false);
      return;
    }

    // Call real API
    setIsChunksLoading(true);
    setChunksError('');
    listSourceChunks({ path: { notebook_id: notebookId, source_id: source.id } })
      .then((response) => {
        chunksCache.set(source.id, response);
        setChunks(response);
      })
      .catch((err) => {
        setChunksError(err.message || '加载原始数据失败');
      })
      .finally(() => {
        setIsChunksLoading(false);
      });
  }, [source, open, activeTab, notebookId, isConnected]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInputValue('');
      setBrief(null);
      setBriefError('');
      setChunks([]);
      setChunksError('');
      setActiveTab('overview');
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading || !source) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    if (!notebookId || !isConnected) {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '未连接到后端服务，无法生成回答。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
      return;
    }

    // Call real API
    try {
      const response = await askSourceQuestion({
        path: { notebook_id: notebookId, source_id: source.id },
        body: { question: userMessage.content },
      });
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(response.created_at),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `抱歉，回答生成失败：${err instanceof Error ? err.message : '未知错误'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, source, notebookId, isConnected]);

  const handleRefreshBrief = useCallback(() => {
    if (!source) return;
    briefCache.delete(source.id);
    setBrief(null);
    setBriefError('');
    setIsBriefLoading(true);

    if (!notebookId || !isConnected) {
      setBriefError('未连接到后端服务，无法刷新摘要。');
      setIsBriefLoading(false);
      return;
    }

    // Call real API
    getSourceSummary({ path: { notebook_id: notebookId, source_id: source.id } })
      .then((response) => {
        const newBrief: SourceBrief = {
          summary: response.summary,
          keyPoints: response.key_points,
          topics: response.topics,
          wordCount: response.word_count,
          generatedAt: new Date(response.generated_at),
        };
        briefCache.set(source.id, newBrief);
        setBrief(newBrief);
      })
      .catch((err) => {
        setBriefError(err.message || '刷新摘要失败');
      })
      .finally(() => {
        setIsBriefLoading(false);
      });
  }, [source, notebookId, isConnected]);

  // Generate QA content as markdown
  const generateQAContent = useCallback(() => {
    if (!source || messages.length === 0) return '';

    const timestamp = new Date().toLocaleString('zh-CN');
    let content = `# 来源问答记录\n\n`;
    content += `**来源**: ${source.title}\n`;
    content += `**导出时间**: ${timestamp}\n\n`;
    content += `---\n\n`;

    for (const msg of messages) {
      const role = msg.role === 'user' ? '**问**' : '**答**';
      content += `${role}: ${msg.content}\n\n`;
    }

    return content;
  }, [source, messages]);

  // Copy QA to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    const content = generateQAContent();
    if (!content) return;

    const success = await copyToClipboard(content);
    if (success) {
      toast.success('问答内容已复制到剪贴板');
    } else {
      toast.error('复制失败，请尝试下载文件');
    }
  }, [generateQAContent]);

  // Download QA as markdown file
  const handleDownloadAsFile = useCallback(() => {
    if (!source) return;
    const content = generateQAContent();
    if (!content) return;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${source.title}-问答记录.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('文件下载已开始');
  }, [source, generateQAContent]);

  // Save QA as a new source
  const handleSaveAsSource = useCallback(async () => {
    if (!source || messages.length === 0 || !onSaveQAAsSource) return;

    setIsSavingAsSource(true);
    try {
      await onSaveQAAsSource(source.title, messages);
      toast.success('问答记录已保存为新来源');
    } catch (err) {
      toast.error(`保存失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsSavingAsSource(false);
    }
  }, [source, messages, onSaveQAAsSource]);

  if (!source) return null;

  return (
    <Dialog
      open={open}
      handler={onClose}
      size={isFullscreen ? 'xxl' : 'xl'}
      className={`rounded-xl overflow-hidden flex flex-col ${isFullscreen ? 'h-[95vh] max-h-[95vh]' : 'h-[80vh] max-h-[80vh]'}`}
    >
      {/* Header */}
      <DialogHeader className="flex items-start justify-between gap-4 border-b border-gray-100 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex-shrink-0">
            <DescriptionIcon fontSize="small" />
          </div>
          <div className="min-w-0">
            <Typography variant="h6" className="text-[15px] font-semibold text-gray-900 truncate">
              {source.title}
            </Typography>
            <Typography variant="small" className="text-gray-500 text-xs font-medium">
              来源详情 · 支持 RAG 问答
            </Typography>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onToggleFullscreen && (
            <IconButton variant="text" size="sm" onClick={onToggleFullscreen} className="rounded-full">
              {isFullscreen ? (
                <FullscreenExitIcon className="h-4 w-4" />
              ) : (
                <FullscreenIcon className="h-4 w-4" />
              )}
            </IconButton>
          )}
          <IconButton
            variant="text"
            size="sm"
            onClick={onClose}
            className="rounded-full"
            aria-label="关闭来源详情"
          >
            <CloseIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </DialogHeader>

      <DialogBody className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
        <Tabs value={activeTab} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Tab Header */}
          <TabsHeader
            className="bg-transparent border-b border-gray-100 rounded-none p-0"
            indicatorProps={{
              className: 'bg-blue-500/10 shadow-none rounded-none border-b-2 border-blue-500',
            }}
          >
            <Tab
              value="overview"
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-4 text-xs font-medium ${activeTab === 'overview' ? 'text-blue-500' : 'text-gray-500'}`}
            >
              <div className="flex items-center gap-1.5">
                <AutoAwesomeIcon style={{ fontSize: 14 }} />
                <span>摘要 & 问答</span>
              </div>
            </Tab>
            <Tab
              value="raw"
              onClick={() => setActiveTab('raw')}
              className={`py-3 px-4 text-xs font-medium ${activeTab === 'raw' ? 'text-blue-500' : 'text-gray-500'}`}
            >
              <div className="flex items-center gap-1.5">
                <DataObjectIcon style={{ fontSize: 14 }} />
                <span>原始数据</span>
                {source.chunkCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500">
                    {source.chunkCount}
                  </span>
                )}
              </div>
            </Tab>
          </TabsHeader>

          <TabsBody className="flex-1 min-h-0 overflow-hidden">
            {/* Overview Tab - Summary + QA combined */}
            <TabPanel value="overview" className="p-0 h-full flex flex-col overflow-hidden">
              {/* Summary Section - Collapsible */}
              <div className="bg-gray-50/50 border-b border-gray-100 flex-shrink-0">
                <button
                  type="button"
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100/50 transition-colors"
                  onClick={() => setSummaryCollapsed(!summaryCollapsed)}
                >
                  <div className="flex items-center gap-2 text-blue-500">
                    <AutoAwesomeIcon style={{ fontSize: 16 }} />
                    <Typography variant="small" className="font-semibold text-xs">
                      自动摘要
                    </Typography>
                    {summaryCollapsed && brief && (
                      <Typography variant="small" className="text-xs text-gray-400 font-normal ml-2 truncate max-w-[300px]">
                        {brief.summary.slice(0, 50)}...
                      </Typography>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!summaryCollapsed && (
                      <IconButton
                        variant="text"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRefreshBrief();
                        }}
                        disabled={isBriefLoading}
                        className={`rounded-full w-6 h-6 text-gray-400 hover:text-gray-700 ${isBriefLoading ? 'animate-spin' : ''}`}
                      >
                        <RefreshIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                    {summaryCollapsed ? (
                      <ExpandMoreIcon className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ExpandLessIcon className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {!summaryCollapsed && (
                  <div className="px-4 pb-4">
                    {isBriefLoading ? (
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                        <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse" />
                        <div className="h-4 bg-gray-200 rounded w-4/6 animate-pulse" />
                      </div>
                    ) : briefError ? (
                      <Typography variant="small" color="red" className="text-xs">
                        {briefError}
                      </Typography>
                    ) : brief ? (
                      <div className="space-y-3">
                        <Typography variant="small" className="text-xs text-gray-600 leading-relaxed">
                          {brief.summary}
                        </Typography>
                        <div className="h-px bg-gray-200" />
                        <div>
                          <Typography variant="small" className="text-xs font-semibold text-gray-500 mb-1.5">
                            关键要点
                          </Typography>
                          <div className="space-y-1">
                            {brief.keyPoints.map((point, index) => (
                              <div key={index} className="flex items-start gap-1.5">
                                <span className="text-gray-400 text-xs">•</span>
                                <Typography variant="small" className="text-[11px] text-gray-600 font-medium leading-tight">
                                  {point}
                                </Typography>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex gap-1">
                            {brief.topics.map((topic) => (
                              <Chip key={topic} value={topic} size="sm" variant="ghost" className="h-5 px-2 py-0 text-[10px] bg-gray-100 text-gray-600 normal-case font-normal" />
                            ))}
                          </div>
                          <Typography variant="small" className="text-[10px] text-gray-500 font-medium">
                            约 {brief.wordCount.toLocaleString()} 字
                          </Typography>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* QA Section */}
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
                {/* QA Header */}
                <div className="px-4 py-2 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-2 text-gray-500">
                    <QuestionAnswerIcon style={{ fontSize: 14 }} />
                    <Typography variant="small" className="font-medium text-xs">
                      基于来源问答
                    </Typography>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-4">
                      <Typography variant="small" className="text-gray-400 text-xs">
                        在下方输入问题，获取基于此来源的针对性回答
                      </Typography>
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                            message.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {message.content}
                        </div>
                        {/* Export button for assistant messages */}
                        {message.role === 'assistant' && (
                          <div className="flex items-end ml-1">
                            <Menu
                              placement="bottom-start"
                              open={exportMenuOpen && exportMenuOpen === message.id}
                              handler={(open) => setExportMenuOpen(open ? message.id : null)}
                            >
                              <MenuHandler>
                                <IconButton
                                  variant="text"
                                  size="sm"
                                  className="rounded-full w-5 h-5 min-w-[20px] text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 hover:opacity-100"
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
                                    handleCopyToClipboard();
                                    setExportMenuOpen(null);
                                  }}
                                >
                                  <ContentCopyIcon style={{ fontSize: 14 }} />
                                  复制到剪贴板
                                </MenuItem>
                                <MenuItem
                                  className="flex items-center gap-2 text-xs"
                                  onClick={() => {
                                    handleDownloadAsFile();
                                    setExportMenuOpen(null);
                                  }}
                                >
                                  <FileDownloadIcon style={{ fontSize: 14 }} />
                                  下载为 Markdown
                                </MenuItem>
                                {onSaveQAAsSource && (
                                  <MenuItem
                                    className="flex items-center gap-2 text-xs"
                                    onClick={() => {
                                      handleSaveAsSource();
                                      setExportMenuOpen(null);
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
                      <div className="bg-gray-100 px-3 py-2 rounded-xl flex items-center gap-2">
                        <Spinner className="h-3 w-3" />
                        <span className="text-xs text-gray-500">思考中...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-gray-100 bg-white flex-shrink-0">
                  <div className="relative">
                    <input
                      className="w-full h-9 pl-3 pr-10 rounded-full bg-gray-50 border border-transparent focus:bg-white focus:border-gray-200 focus:ring-0 text-sm outline-none transition-all placeholder:text-gray-400"
                      placeholder="基于此来源内容提问..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
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
                        className={`rounded-full w-7 h-7 ${!inputValue.trim() || isLoading ? 'bg-gray-200 text-gray-400' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                        onClick={handleSend}
                        aria-label="发送问题"
                        disabled={!inputValue.trim() || isLoading}
                      >
                        <SendIcon style={{ fontSize: 14 }} />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </div>
            </TabPanel>

            {/* Raw Data Tab */}
            <TabPanel value="raw" className="p-0 h-full overflow-y-auto">
              <div className="p-4">
                {isChunksLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-3 animate-pulse">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-gray-200 rounded" />
                          <div className="h-4 bg-gray-200 rounded w-3/4" />
                        </div>
                        <div className="h-3 bg-gray-200 rounded w-1/4" />
                      </div>
                    ))}
                  </div>
                ) : chunksError ? (
                  <div className="text-center py-8">
                    <Typography variant="small" color="red" className="text-xs">
                      {chunksError}
                    </Typography>
                  </div>
                ) : chunks.length === 0 ? (
                  <div className="text-center py-8">
                    <DataObjectIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <Typography variant="small" className="text-gray-500 text-xs">
                      暂无原始数据
                    </Typography>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <Typography variant="small" className="text-xs text-gray-500 font-medium">
                        共 {chunks.length} 个片段
                      </Typography>
                    </div>
                    {chunks.map((chunk, index) => (
                      <ChunkItem key={chunk.id} chunk={chunk} index={index} />
                    ))}
                  </div>
                )}
              </div>
            </TabPanel>
          </TabsBody>
        </Tabs>
      </DialogBody>
    </Dialog>
  );
}
