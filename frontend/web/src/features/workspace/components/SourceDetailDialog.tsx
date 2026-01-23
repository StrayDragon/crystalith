import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogBody,
  IconButton,
  Input,
  Typography,
  Chip,
  Spinner,
} from '@material-tailwind/react';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Description as DescriptionIcon,
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { getSourceSummary, askSourceQuestion } from '../api';
import { useWorkspaceState } from '../context/WorkspaceContext';
import type { SourceItem } from '../types';

interface SourceDetailDialogProps {
  open: boolean;
  source: SourceItem | null;
  onClose: () => void;
}

interface ChatMessage {
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

// Cache for source briefs
const briefCache = new Map<number, SourceBrief>();

export default function SourceDetailDialog({ open, source, onClose }: SourceDetailDialogProps) {
  const state = useWorkspaceState();
  const notebookId = state.activeNotebookId;
  const isDemo = state.connectionState === 'demo';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [brief, setBrief] = useState<SourceBrief | null>(null);
  const [isBriefLoading, setIsBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string>('');
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

    // If demo mode or no notebook, use mock data
    if (isDemo || !notebookId) {
      setIsBriefLoading(true);
      const timer = setTimeout(() => {
        const newBrief: SourceBrief = {
          summary: `这是关于「${source.title}」的自动生成摘要。该文档主要讨论了相关主题的核心概念、实践应用和最佳方案。`,
          keyPoints: [
            '核心概念和定义',
            '主要方法论',
            '实践案例分析',
            '建议和最佳实践',
          ],
          topics: ['分析', '方法论', '实践'],
          wordCount: Math.floor(Math.random() * 5000) + 1000,
          generatedAt: new Date(),
        };
        briefCache.set(source.id, newBrief);
        setBrief(newBrief);
        setIsBriefLoading(false);
      }, 800);
      return () => clearTimeout(timer);
    }

    // Call real API
    setIsBriefLoading(true);
    setBriefError('');
    getSourceSummary(notebookId, source.id)
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
  }, [source, open, notebookId, isDemo]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInputValue('');
      setBrief(null);
      setBriefError('');
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

    // If demo mode or no notebook, use mock response
    if (isDemo || !notebookId) {
      setTimeout(() => {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `基于「${source.title}」的内容，关于您的问题"${userMessage.content}"，以下是相关信息：\n\n这是一个模拟的 RAG 回答。在实际实现中，这里会基于文档内容进行检索增强生成，提供准确的答案和引用。`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsLoading(false);
      }, 1000);
      return;
    }

    // Call real API
    try {
      const response = await askSourceQuestion(notebookId, source.id, userMessage.content);
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
  }, [inputValue, isLoading, source, notebookId, isDemo]);

  const handleRefreshBrief = useCallback(() => {
    if (!source) return;
    briefCache.delete(source.id);
    setBrief(null);
    setBriefError('');
    setIsBriefLoading(true);

    // If demo mode or no notebook, use mock data
    if (isDemo || !notebookId) {
      setTimeout(() => {
        const newBrief: SourceBrief = {
          summary: `这是重新生成的关于「${source.title}」的摘要。文档深入探讨了该领域的关键问题和解决方案。`,
          keyPoints: [
            '更新后的核心要点',
            '新的方法论见解',
            '最新实践案例',
            '改进的建议',
          ],
          topics: ['更新', '洞察', '方案'],
          wordCount: Math.floor(Math.random() * 5000) + 1000,
          generatedAt: new Date(),
        };
        briefCache.set(source.id, newBrief);
        setBrief(newBrief);
        setIsBriefLoading(false);
      }, 800);
      return;
    }

    // Call real API
    getSourceSummary(notebookId, source.id)
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
  }, [source, notebookId, isDemo]);

  if (!source) return null;

  return (
    <Dialog
      open={open}
      handler={onClose}
      size="lg"
      className="rounded-xl overflow-hidden max-h-[85vh] flex flex-col"
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
            <Typography variant="small" className="text-gray-500 text-xs font-normal">
              来源详情 · 支持 RAG 问答
            </Typography>
          </div>
        </div>
        <IconButton variant="text" size="sm" onClick={onClose} className="rounded-full flex-shrink-0">
          <CloseIcon className="h-4 w-4" />
        </IconButton>
      </DialogHeader>

      <DialogBody className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Brief Section */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-blue-500">
              <AutoAwesomeIcon style={{ fontSize: 16 }} />
              <Typography variant="small" className="font-semibold text-xs">
                自动摘要
              </Typography>
            </div>
            <IconButton
              variant="text"
              size="sm"
              onClick={handleRefreshBrief}
              disabled={isBriefLoading}
              className={`rounded-full w-6 h-6 text-gray-400 hover:text-gray-700 ${isBriefLoading ? 'animate-spin' : ''}`}
            >
              <RefreshIcon style={{ fontSize: 16 }} />
            </IconButton>
          </div>

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
                      <Typography variant="small" className="text-[11px] text-gray-600 leading-tight">
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
                <Typography variant="small" className="text-[9px] text-gray-400">
                  约 {brief.wordCount.toLocaleString()} 字
                </Typography>
              </div>
            </div>
          ) : null}
        </div>

        {/* Chat Section */}
        <div className="flex flex-col flex-1 min-h-[200px] overflow-hidden bg-white">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-6">
                <Typography variant="small" className="text-gray-400 text-xs">
                  基于此来源内容提问，获取针对性回答
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
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {message.content}
                  </div>
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
          <div className="p-3 border-t border-gray-100 bg-white">
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
               />
               <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <IconButton
                    size="sm"
                    className={`rounded-full w-7 h-7 ${!inputValue.trim() || isLoading ? 'bg-gray-200 text-gray-400' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                  >
                    <SendIcon style={{ fontSize: 14 }} />
                  </IconButton>
               </div>
            </div>
          </div>
        </div>
      </DialogBody>
    </Dialog>
  );
}
