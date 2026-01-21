import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  TextField,
  Stack,
  Paper,
  Divider,
  CircularProgress,
  Chip,
  InputAdornment,
  Skeleton,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Description as DescriptionIcon,
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { getSourceSummary, askSourceQuestion, type SourceSummaryResponse } from '../api';
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
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '85vh',
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          pb: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'grey.100',
              flexShrink: 0,
            }}
          >
            <DescriptionIcon color="action" fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ fontSize: '0.9375rem' }}>
              {source.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              来源详情 · 支持 RAG 问答
            </Typography>
          </Box>
        </Stack>
        <IconButton size="small" onClick={onClose} sx={{ mt: -0.5, mr: -0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Brief Section */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <AutoAwesomeIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="caption" fontWeight={600}>
                自动摘要
              </Typography>
            </Stack>
            <IconButton
              size="small"
              onClick={handleRefreshBrief}
              disabled={isBriefLoading}
              sx={{ width: 24, height: 24 }}
            >
              <RefreshIcon
                fontSize="small"
                sx={{
                  animation: isBriefLoading ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    from: { transform: 'rotate(0deg)' },
                    to: { transform: 'rotate(360deg)' },
                  },
                }}
              />
            </IconButton>
          </Stack>

          {isBriefLoading ? (
            <Stack spacing={1}>
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="85%" />
              <Skeleton variant="text" width="60%" />
            </Stack>
          ) : briefError ? (
            <Typography variant="caption" color="error" sx={{ fontSize: '0.75rem' }}>
              {briefError}
            </Typography>
          ) : brief ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
                {brief.summary}
              </Typography>
              <Divider />
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75 }}>
                  关键要点
                </Typography>
                <Stack spacing={0.5}>
                  {brief.keyPoints.map((point, index) => (
                    <Typography key={index} variant="caption" sx={{ fontSize: '0.6875rem', display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                      <span style={{ color: '#94a3b8' }}>•</span>
                      {point}
                    </Typography>
                  ))}
                </Stack>
              </Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={0.5}>
                  {brief.topics.map((topic) => (
                    <Chip key={topic} label={topic} size="small" sx={{ height: 18, fontSize: '0.5625rem' }} />
                  ))}
                </Stack>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.5625rem' }}>
                  约 {brief.wordCount.toLocaleString()} 字
                </Typography>
              </Stack>
            </Stack>
          ) : null}
        </Box>

        {/* Chat Section */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 200 }}>
          {/* Messages */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, minHeight: 150, maxHeight: 280 }}>
            {messages.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  基于此来源内容提问，获取针对性回答
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {messages.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      display: 'flex',
                      justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Paper
                      sx={{
                        px: 1.5,
                        py: 1,
                        maxWidth: '80%',
                        borderRadius: 2,
                        bgcolor: message.role === 'user' ? 'primary.main' : 'grey.100',
                        color: message.role === 'user' ? 'white' : 'text.primary',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                        {message.content}
                      </Typography>
                    </Paper>
                  </Box>
                ))}
                {isLoading && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <Paper sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: 'grey.100' }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <CircularProgress size={12} />
                        <Typography variant="caption" color="text.secondary">
                          思考中...
                        </Typography>
                      </Stack>
                    </Paper>
                  </Box>
                )}
                <div ref={messagesEndRef} />
              </Stack>
            )}
          </Box>

          {/* Input */}
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <TextField
              fullWidth
              size="small"
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
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={handleSend}
                      disabled={!inputValue.trim() || isLoading}
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        width: 28,
                        height: 28,
                        '&:hover': { bgcolor: 'primary.dark' },
                        '&.Mui-disabled': { bgcolor: 'grey.300', color: 'grey.500' },
                      }}
                    >
                      <SendIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: { pr: 0.5, fontSize: '0.75rem' },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                },
              }}
            />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
