import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Box,
  Button,
  IconButton,
  TextField,
  Popover,
  Typography,
  Stack,
  CircularProgress,
  Tooltip,
  List,
  ListItemButton,
  ListItemText,
  InputAdornment,
  Chip,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';

import type { SessionSummary } from '../types';

interface SessionSwitcherProps {
  sessions: SessionSummary[];
  activeSessionId: number | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string;
  isDemo: boolean;
  searchInputRef: RefObject<HTMLInputElement>;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (sessionId: number | null) => void;
  onCreate: () => Promise<void> | void;
  onUpdate?: (sessionId: number, title: string) => Promise<boolean>;
  onDelete?: (sessionId: number) => Promise<boolean>;
  onRetry: () => Promise<void> | void;
}

export default function SessionSwitcher({
  sessions,
  activeSessionId,
  isOpen,
  isLoading,
  error,
  isDemo,
  searchInputRef,
  onToggle,
  onClose,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onRetry,
}: SessionSwitcherProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const activeSession = sessions.find((item) => item.id === activeSessionId) ?? null;
  const filteredSessions = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return sessions;
    return sessions.filter((item) => item.title.toLowerCase().includes(keyword));
  }, [searchValue, sessions]);

  function handleToggle(event: React.MouseEvent<HTMLButtonElement>) {
    if (isOpen) {
      setAnchorEl(null);
      onClose();
    } else {
      setAnchorEl(event.currentTarget);
      onToggle();
    }
  }

  function startEditing(session: SessionSummary) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  }

  async function handleSaveEdit() {
    if (!editingSessionId || !onUpdate || isUpdating) return;
    setIsUpdating(true);
    try {
      const success = await onUpdate(editingSessionId, editingTitle);
      if (success) {
        setEditingSessionId(null);
        setEditingTitle('');
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDeleteSession(sessionId: number, sessionTitle: string) {
    if (!onDelete || isDeleting) return;
    if (!window.confirm(`确定要删除会话「${sessionTitle}」吗？`)) return;
    setIsDeleting(true);
    try {
      await onDelete(sessionId);
      if (editingSessionId === sessionId) {
        setEditingSessionId(null);
        setEditingTitle('');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  useEffect(() => {
    if (!isOpen) return;
    // Focus search input when opened
    setTimeout(() => {
      const input = document.querySelector('[data-session-search]') as HTMLInputElement;
      if (input) input.focus();
    }, 100);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setSearchValue('');
    setEditingSessionId(null);
    setEditingTitle('');
  }, [isOpen]);

  const handleClose = () => {
    setAnchorEl(null);
    onClose();
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      {/* New Session Button - Left side */}
      <Tooltip title="新建会话">
        <IconButton
          size="small"
          onClick={async () => {
            await onCreate();
            handleClose();
          }}
          sx={{
            borderRadius: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            px: 1,
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Session Selector Button */}
      <Button
        onClick={handleToggle}
        variant="text"
        size="small"
        endIcon={<ExpandMoreIcon sx={{ fontSize: 16, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />}
        sx={{
          borderRadius: 0,
          px: 1.5,
          py: 0.5,
          minHeight: 32,
          textTransform: 'none',
          color: 'text.primary',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.6875rem' }}>
            会话
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              fontSize: '0.75rem',
              maxWidth: 100,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeSession?.title ?? '未命名'}
          </Typography>
        </Stack>
      </Button>

      {/* Session List Popover */}
      <Popover
        open={isOpen && Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { width: 340, maxHeight: 420 },
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* Search Input */}
          <TextField
            fullWidth
            size="small"
            placeholder="搜索会话"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            inputProps={{ 'data-session-search': true }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 1.5 }}
          />

          {/* Error State */}
          {error && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="error">
                {error}
              </Typography>
              <Button size="small" onClick={onRetry} sx={{ minWidth: 'auto', fontSize: '0.75rem' }}>
                重试
              </Button>
            </Stack>
          )}

          {/* Session List */}
          <List
            sx={{
              maxHeight: 260,
              overflow: 'auto',
              mx: -1,
              '& .MuiListItemButton-root': {
                borderRadius: 2,
                mx: 1,
                mb: 0.5,
              },
            }}
          >
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : filteredSessions.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: 'center', py: 3 }}
              >
                {searchValue ? '未找到匹配会话' : '暂无会话记录'}
              </Typography>
            ) : (
              filteredSessions.map((item) => (
                <ListItemButton
                  key={item.id}
                  selected={item.id === activeSessionId}
                  sx={{
                    position: 'relative',
                    '&:hover .session-actions': {
                      opacity: 1,
                    },
                  }}
                >
                  {editingSessionId === item.id ? (
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
                      <TextField
                        inputRef={editInputRef}
                        size="small"
                        fullWidth
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleSaveEdit();
                          } else if (e.key === 'Escape') {
                            setEditingSessionId(null);
                            setEditingTitle('');
                          }
                        }}
                        disabled={isUpdating}
                        sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
                      />
                      <IconButton
                        size="small"
                        onClick={handleSaveEdit}
                        disabled={isUpdating}
                        color="primary"
                      >
                        {isUpdating ? <CircularProgress size={16} /> : <CheckIcon fontSize="small" />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingSessionId(null);
                          setEditingTitle('');
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ) : (
                    <>
                      <ListItemText
                        onClick={() => {
                          onSelect(item.id);
                          handleClose();
                        }}
                        primary={
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: item.id === activeSessionId ? 600 : 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.title}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {item.updatedAt}
                          </Typography>
                        }
                        sx={{ cursor: 'pointer' }}
                      />
                      <Stack
                        direction="row"
                        spacing={0.5}
                        className="session-actions"
                        sx={{
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          position: 'absolute',
                          right: 8,
                        }}
                      >
                        {onUpdate && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(item);
                            }}
                            sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                          >
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        )}
                        {onDelete && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteSession(item.id, item.title);
                            }}
                            disabled={isDeleting}
                            sx={{
                              '&:hover': {
                                bgcolor: alpha('#ef4444', 0.1),
                                color: 'error.main',
                              },
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        )}
                      </Stack>
                    </>
                  )}
                </ListItemButton>
              ))
            )}
          </List>

          {/* Demo Mode Notice */}
          {isDemo && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1.5, textAlign: 'center' }}
            >
              演示模式下会话仅在前端保存。
            </Typography>
          )}
        </Box>
      </Popover>
    </Stack>
  );
}
