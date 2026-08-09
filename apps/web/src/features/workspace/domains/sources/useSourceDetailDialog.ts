import type { Chunk as ChunkRead, SourceSummary } from '@crystalith/shared';
import { useState, useCallback, useRef, useEffect } from 'react';

import { api } from '../../../../api/eden';
import { parseServerError } from '../../../../api/parseServerError';
import { copyToClipboard } from '../../../../shared/clipboard';
import { toast } from '../../../../shared/toast';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type { SourceItem } from '../../shared/types';
import {
  type ChatMessage,
  type SourceBrief,
  type SourceDetailTabValue,
  briefFromResponse,
  hasGeneratedBrief,
} from './sourceDetailTypes';

// Cache for source briefs and chunks (GET/POST results only — empty GET is cacheable too)
const briefCache = new Map<number, SourceBrief>();
const chunksCache = new Map<number, ChunkRead[]>();

async function fetchSourceSummary(notebookId: number, sourceId: number): Promise<SourceSummary> {
  const { data, error } = await api.v2
    .notebooks({ nid: notebookId })
    .sources({ sid: sourceId })
    .summary.get();
  if (error) throw new Error(parseServerError(error).message);
  if (!data) throw new Error('source summary returned an empty payload');
  return data;
}

async function postSourceSummary(notebookId: number, sourceId: number): Promise<SourceSummary> {
  const { data, error } = await api.v2
    .notebooks({ nid: notebookId })
    .sources({ sid: sourceId })
    .summary.post();
  if (error) throw new Error(parseServerError(error).message);
  if (!data) throw new Error('source summary POST returned an empty payload');
  return data;
}

async function fetchSourceChunks(notebookId: number, sourceId: number): Promise<ChunkRead[]> {
  const { data, error } = await api.v2
    .notebooks({ nid: notebookId })
    .sources({ sid: sourceId })
    .chunks.get();
  if (error) throw new Error(parseServerError(error).message);
  return data ?? [];
}

export function useSourceDetailDialog({
  open,
  source,
  onSaveQAAsSource,
}: {
  open: boolean;
  source: SourceItem | null;
  onSaveQAAsSource?: (sourceName: string, messages: ChatMessage[]) => Promise<void>;
}) {
  const notebookId = useWorkspaceStore((s) => s.activeNotebookId);
  const connectionState = useWorkspaceStore((s) => s.connectionState);
  const isConnected = connectionState === 'live';

  const [activeTab, setActiveTab] = useState<SourceDetailTabValue>('overview');
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
  const fetchedSourceRef = useRef<number | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load cached brief when source changes (GET is side-effect free)
  useEffect(() => {
    if (!source || !open) return;

    const cached = briefCache.get(source.id);
    if (cached) {
      setBrief(cached);
      setBriefError('');
      return;
    }

    if (!notebookId || !isConnected) {
      setBrief(null);
      setBriefError('未连接到后端服务，无法加载摘要。');
      setIsBriefLoading(false);
      return;
    }

    // Dedup: skip if a fetch is already in-flight for this source
    if (fetchedSourceRef.current === source.id) return;
    fetchedSourceRef.current = source.id;

    setIsBriefLoading(true);
    setBriefError('');
    fetchSourceSummary(notebookId, source.id)
      .then((response) => {
        const newBrief = briefFromResponse(response);
        // Only persist generated summaries in memory; empty state re-GETs on reopen
        // so async post-ingest pregenerate can become visible.
        if (hasGeneratedBrief(newBrief)) {
          briefCache.set(source.id, newBrief);
        } else {
          briefCache.delete(source.id);
        }
        setBrief(newBrief);
      })
      .catch((error: unknown) => {
        const message = parseServerError(error).message;
        // intentionally || — empty error message gets default
        // oxlint-disable-next-line typescript/prefer-nullish-coalescing
        setBriefError(message || '加载摘要失败');
      })
      .finally(() => {
        setIsBriefLoading(false);
      });
  }, [source, open, notebookId, isConnected]);

  // Load chunks when switching to raw tab
  useEffect(() => {
    if (!source || !open || activeTab !== 'raw') return;

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

    setIsChunksLoading(true);
    setChunksError('');
    fetchSourceChunks(notebookId, source.id)
      .then((response) => {
        chunksCache.set(source.id, response);
        setChunks(response);
      })
      .catch((error: unknown) => {
        const message = parseServerError(error).message;
        // intentionally || — empty error message gets default
        // oxlint-disable-next-line typescript/prefer-nullish-coalescing
        setChunksError(message || '加载原始数据失败');
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
      fetchedSourceRef.current = null;
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

    try {
      const { data: response, error: qaErr } = await api.v2
        .notebooks({ nid: notebookId })
        .sources({ sid: source.id })
        .qa.post({ question: userMessage.content });
      if (qaErr) throw new Error(parseServerError(qaErr).message);
      if (!response || !('answer' in response)) {
        throw new Error('source QA returned an unexpected payload');
      }
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `抱歉，回答生成失败：${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, source, notebookId, isConnected]);

  const handleGenerateOrRefreshBrief = useCallback(() => {
    if (!source) return;
    briefCache.delete(source.id);
    setBriefError('');
    setIsBriefLoading(true);

    if (!notebookId || !isConnected) {
      setBriefError('未连接到后端服务，无法生成摘要。');
      setIsBriefLoading(false);
      return;
    }

    postSourceSummary(notebookId, source.id)
      .then((response) => {
        const newBrief = briefFromResponse(response);
        briefCache.set(source.id, newBrief);
        setBrief(newBrief);
      })
      .catch((error: unknown) => {
        const message = parseServerError(error).message;
        // intentionally || — empty error message gets default
        // oxlint-disable-next-line typescript/prefer-nullish-coalescing
        setBriefError(message || '生成摘要失败');
      })
      .finally(() => {
        setIsBriefLoading(false);
      });
  }, [source, notebookId, isConnected]);

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

  const handleSaveAsSource = useCallback(async () => {
    if (!source || messages.length === 0 || !onSaveQAAsSource) return;

    setIsSavingAsSource(true);
    try {
      await onSaveQAAsSource(source.title, messages);
      toast.success('问答记录已保存为新来源');
    } catch (error) {
      toast.error(`保存失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSavingAsSource(false);
    }
  }, [source, messages, onSaveQAAsSource]);

  return {
    notebookId,
    isConnected,
    activeTab,
    setActiveTab,
    messages,
    inputValue,
    setInputValue,
    isLoading,
    brief,
    isBriefLoading,
    briefError,
    chunks,
    isChunksLoading,
    chunksError,
    summaryCollapsed,
    setSummaryCollapsed,
    isSavingAsSource,
    exportMenuOpen,
    setExportMenuOpen,
    messagesEndRef,
    handleSend,
    handleGenerateOrRefreshBrief,
    handleCopyToClipboard,
    handleDownloadAsFile,
    handleSaveAsSource,
  };
}
