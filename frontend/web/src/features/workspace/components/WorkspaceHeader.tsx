import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  TextField,
  Popover,
  Avatar,
  Typography,
  Stack,
  CircularProgress,
  Tooltip,
  Paper,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

import type { AsyncStatus } from '../../../shared/types';

interface WorkspaceHeaderProps {
  title: string;
  createName: string;
  createState: AsyncStatus;
  createError: string;
  isDemo: boolean;
  onCreateNameChange: (value: string) => void;
  onCreateNotebook: () => Promise<boolean>;
  onUpdateNotebook?: (name: string) => Promise<boolean>;
  onDeleteNotebook?: () => Promise<boolean>;
  activeNotebookId?: number | null;
}

export default function WorkspaceHeader({
  title,
  createName,
  createState,
  createError,
  isDemo,
  onCreateNameChange,
  onCreateNotebook,
  onUpdateNotebook,
  onDeleteNotebook,
  activeNotebookId,
}: WorkspaceHeaderProps) {
  const [createAnchorEl, setCreateAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [editAnchorEl, setEditAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [editName, setEditName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const editPanelRef = useRef<HTMLDivElement | null>(null);
  const isCreating = createState === 'loading';
  const createDisabled = isDemo || isCreating || createName.trim().length === 0;
  const updateDisabled = isDemo || isUpdating || editName.trim().length === 0;
  const deleteDisabled = isDemo || isDeleting || !activeNotebookId;

  const isCreateOpen = Boolean(createAnchorEl);
  const isEditOpen = Boolean(editAnchorEl);

  async function handleCreate() {
    if (createDisabled) return;
    const created = await onCreateNotebook();
    if (created) {
      setCreateAnchorEl(null);
    }
  }

  async function handleUpdate() {
    if (updateDisabled || !onUpdateNotebook) return;
    setIsUpdating(true);
    try {
      const updated = await onUpdateNotebook(editName);
      if (updated) {
        setEditAnchorEl(null);
        setEditName('');
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (deleteDisabled || !onDeleteNotebook) return;
    if (!window.confirm(`确定要删除笔记本「${title}」吗？此操作不可撤销。`)) return;
    setIsDeleting(true);
    try {
      await onDeleteNotebook();
      setEditAnchorEl(null);
    } finally {
      setIsDeleting(false);
    }
  }

  function openEditPanel(event: React.MouseEvent<HTMLButtonElement>) {
    setEditName(title);
    setEditAnchorEl(event.currentTarget);
  }

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: { xs: 1.5, sm: 2 },
        px: { xs: 1.5, sm: 2, lg: 3 },
        py: { xs: 1, sm: 1.25 },
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        flexWrap: 'wrap',
        bgcolor: 'background.paper',
        boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
      }}
    >
      {/* Left Section - Logo & Title */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
        {/* Logo */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: { xs: 28, sm: 32 },
            height: { xs: 28, sm: 32 },
            borderRadius: 2,
            bgcolor: 'background.paper',
            boxShadow: 1,
            color: 'text.primary',
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
            <path
              d="M6 12a6 6 0 0 1 10.8-3.6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M8.5 12a3.5 3.5 0 0 1 6.2-2.1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="12" cy="14.5" r="1.4" fill="currentColor" />
          </svg>
        </Box>

        {/* Title with Edit */}
        <Box ref={editPanelRef}>
          <Tooltip title={isDemo ? '演示模式下无法编辑' : '点击编辑笔记本'}>
            <Button
              onClick={openEditPanel}
              disabled={isDemo || !activeNotebookId}
              size="small"
              sx={{
                textTransform: 'none',
                color: 'text.primary',
                px: 1,
                py: 0.5,
                borderRadius: 1.5,
                minHeight: 28,
                '&:hover': {
                  bgcolor: 'action.hover',
                },
                '&:hover .edit-icon': {
                  opacity: 1,
                },
              }}
            >
              <Typography
                variant="body2"
                component="h1"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                  maxWidth: { xs: 140, sm: 200, md: 300 },
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </Typography>
              {!isDemo && activeNotebookId && (
                <EditIcon
                  className="edit-icon"
                  fontSize="small"
                  sx={{
                    ml: 0.5,
                    color: 'text.secondary',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                />
              )}
            </Button>
          </Tooltip>

          {/* Edit Popover */}
          <Popover
            open={isEditOpen}
            anchorEl={editAnchorEl}
            onClose={() => setEditAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{
              paper: {
                sx: { width: 280, p: 2 },
              },
            }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block', fontSize: '0.6875rem' }}>
              笔记本名称
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="输入新名称"
              disabled={isUpdating}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleUpdate();
                }
              }}
              sx={{ mb: 1.5 }}
            />
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Button
                size="small"
                color="error"
                variant="outlined"
                startIcon={isDeleting ? <CircularProgress size={10} color="inherit" /> : <DeleteIcon fontSize="small" />}
                onClick={handleDelete}
                disabled={deleteDisabled}
                sx={{ borderRadius: 5, fontSize: '0.6875rem' }}
              >
                {isDeleting ? '删除中…' : '删除'}
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                variant="outlined"
                onClick={() => setEditAnchorEl(null)}
                sx={{ borderRadius: 5, fontSize: '0.6875rem' }}
              >
                取消
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={updateDisabled}
                onClick={handleUpdate}
                sx={{ borderRadius: 5, fontSize: '0.6875rem' }}
              >
                {isUpdating ? '保存中…' : '保存'}
              </Button>
            </Stack>
          </Popover>
        </Box>
      </Stack>

      {/* Right Section - Create & Avatar */}
      <Stack direction="row" alignItems="center" spacing={1}>
        {/* Create Notebook Button */}
        <Box ref={panelRef}>
          <Button
            variant="contained"
            size="small"
            startIcon={isCreating ? <CircularProgress size={12} color="inherit" /> : <AddIcon fontSize="small" />}
            onClick={(e) => setCreateAnchorEl(e.currentTarget)}
            disabled={isDemo}
            sx={{
              borderRadius: 5,
              px: { xs: 1.5, sm: 2 },
              py: 0.625,
              fontSize: '0.75rem',
            }}
          >
            {isCreating ? '创建中…' : '创建笔记本'}
          </Button>

          {/* Create Popover */}
          <Popover
            open={isCreateOpen}
            anchorEl={createAnchorEl}
            onClose={() => setCreateAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{
              paper: {
                sx: { width: 260, p: 2 },
              },
            }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block', fontSize: '0.6875rem' }}>
              笔记本名称
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={createName}
              onChange={(e) => onCreateNameChange(e.target.value)}
              placeholder={isDemo ? '演示模式不可创建' : '输入名称'}
              disabled={isDemo || isCreating}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              sx={{ mb: 1 }}
            />
            {createError && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.75, fontSize: '0.6875rem' }}>
                {createError}
              </Typography>
            )}
            {isDemo && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontSize: '0.6875rem' }}>
                演示模式下无法创建笔记本。
              </Typography>
            )}
            <Stack direction="row" spacing={0.75} justifyContent="flex-end" sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setCreateAnchorEl(null)}
                sx={{ borderRadius: 5, fontSize: '0.6875rem' }}
              >
                取消
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={createDisabled}
                onClick={handleCreate}
                sx={{ borderRadius: 5, fontSize: '0.6875rem' }}
              >
                创建
              </Button>
            </Stack>
          </Popover>
        </Box>

        {/* User Avatar */}
        <Tooltip title="个人账户">
          <IconButton
            size="small"
            sx={{
              p: 0.25,
              border: '1.5px solid',
              borderColor: 'divider',
            }}
          >
            <Avatar
              sx={{
                width: { xs: 24, sm: 28 },
                height: { xs: 24, sm: 28 },
                bgcolor: 'grey.200',
                color: 'text.primary',
                fontSize: '0.625rem',
                fontWeight: 600,
              }}
            >
              CL
            </Avatar>
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}
