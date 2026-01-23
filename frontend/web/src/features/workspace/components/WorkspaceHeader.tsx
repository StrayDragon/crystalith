import { useEffect, useRef, useState } from 'react';
import {
  Button,
  IconButton,
  Input,
  Popover,
  PopoverHandler,
  PopoverContent,
  Typography,
  Spinner,
} from '@material-tailwind/react';
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
  const [editName, setEditName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Control popovers manually
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const isCreating = createState === 'loading';
  const createDisabled = isDemo || isCreating || createName.trim().length === 0;
  const updateDisabled = isDemo || isUpdating || editName.trim().length === 0;
  const deleteDisabled = isDemo || isDeleting || !activeNotebookId;

  async function handleCreate() {
    if (createDisabled) return;
    const created = await onCreateNotebook();
    if (created) {
      setCreateOpen(false);
    }
  }

  async function handleUpdate() {
    if (updateDisabled || !onUpdateNotebook) return;
    setIsUpdating(true);
    try {
      const updated = await onUpdateNotebook(editName);
      if (updated) {
        setEditOpen(false);
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
      setEditOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <header className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-gray-300 rounded-xl shadow-sm flex-wrap">
      {/* Left Section - Logo & Title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Logo */}
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white shadow-sm border border-gray-100 text-gray-900">
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
        </div>

        {/* Title with Edit */}
        <Popover
          open={editOpen}
          handler={setEditOpen}
          placement="bottom-start"
        >
          <PopoverHandler>
            <button
              onClick={() => {
                setEditName(title);
                // setEditOpen(true); // Handled by PopoverHandler click
              }}
              disabled={isDemo || !activeNotebookId}
              className="group flex items-center px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors disabled:cursor-default"
            >
              <Typography
                variant="small"
                className="font-bold text-gray-900 text-sm truncate max-w-[140px] sm:max-w-[200px] md:max-w-[300px]"
              >
                {title}
              </Typography>
              {!isDemo && activeNotebookId && (
                <EditIcon
                  className="ml-1 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ fontSize: 14 }}
                />
              )}
            </button>
          </PopoverHandler>
          <PopoverContent className="w-72 p-4 z-[9999]">
            <Typography variant="small" className="font-semibold text-gray-600 text-[11px] mb-2">
              笔记本名称
            </Typography>
            <Input
              variant="outlined"
              labelProps={{ className: "hidden" }}
              className="!border !border-gray-300 bg-white text-gray-900 shadow-lg shadow-gray-900/5 ring-4 ring-transparent placeholder:text-gray-500 focus:!border-gray-900 focus:!border-t-gray-900 focus:ring-gray-900/10"
              containerProps={{ className: "min-w-0" }}
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
            />
            <div className="flex items-center justify-between mt-3 gap-2">
              <Button
                size="sm"
                variant="outlined"
                color="red"
                className="flex items-center gap-1 rounded-full px-3 py-1.5 normal-case font-normal text-[11px]"
                onClick={handleDelete}
                disabled={deleteDisabled}
              >
                {isDeleting ? <Spinner className="h-3 w-3" /> : <DeleteIcon style={{ fontSize: 14 }} />}
                {isDeleting ? '删除中…' : '删除'}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="text"
                  className="rounded-full px-3 py-1.5 normal-case font-normal text-gray-700 text-[11px]"
                  onClick={() => setEditOpen(false)}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  variant="filled"
                  className="rounded-full px-3 py-1.5 normal-case font-normal bg-gray-900 text-[11px]"
                  disabled={updateDisabled}
                  onClick={handleUpdate}
                >
                  {isUpdating ? '保存中…' : '保存'}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Right Section - Create & Avatar */}
      <div className="flex items-center gap-2">
        {/* Create Notebook Button */}
        <Popover
          open={createOpen}
          handler={setCreateOpen}
          placement="bottom-end"
        >
          <PopoverHandler>
            <Button
              variant="filled"
              size="sm"
              className="flex items-center gap-1.5 rounded-full bg-gray-900 py-2 px-3 normal-case font-normal text-xs"
              disabled={isDemo}
            >
              {isCreating ? <Spinner className="h-3 w-3" /> : <AddIcon style={{ fontSize: 16 }} />}
              {isCreating ? '创建中…' : '创建笔记本'}
            </Button>
          </PopoverHandler>
          <PopoverContent className="w-64 p-4 z-[9999]">
            <Typography variant="small" className="font-semibold text-gray-600 text-[11px] mb-2">
              笔记本名称
            </Typography>
            <Input
              variant="outlined"
              labelProps={{ className: "hidden" }}
              className="!border !border-gray-300 bg-white text-gray-900 shadow-lg shadow-gray-900/5 ring-4 ring-transparent placeholder:text-gray-500 focus:!border-gray-900 focus:!border-t-gray-900 focus:ring-gray-900/10"
              containerProps={{ className: "min-w-0" }}
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
            />
            {createError && (
              <Typography variant="small" color="red" className="mt-1 text-[10px]">
                {createError}
              </Typography>
            )}
            {isDemo && (
              <Typography variant="small" className="mt-1 text-[10px] text-gray-500">
                演示模式下无法创建笔记本。
              </Typography>
            )}
            <div className="flex justify-end gap-2 mt-3">
              <Button
                size="sm"
                variant="text"
                className="rounded-full px-3 py-1.5 normal-case font-normal text-gray-700 text-[11px]"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                variant="filled"
                className="rounded-full px-3 py-1.5 normal-case font-normal bg-gray-900 text-[11px]"
                disabled={createDisabled}
                onClick={handleCreate}
              >
                创建
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* User Avatar */}
        <div className="p-0.5 border-2 border-gray-100 rounded-full cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
            CL
          </div>
        </div>
      </div>
    </header>
  );
}
