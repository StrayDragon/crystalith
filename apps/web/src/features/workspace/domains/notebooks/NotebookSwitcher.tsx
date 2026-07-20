import { Button, IconButton, Input, Typography, Spinner } from '@material-tailwind/react';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Add as AddIcon,
  BookmarkAdd as BookmarkAddIcon,
  Layers as TemplateIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import ConfirmPopover from '../../../../shared/ConfirmPopover';
import { useLayer } from '../../../../shared/layer';
import { TestIds, tid } from '../../../../shared/testids';
import type { AsyncStatus } from '../../../../shared/types';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type { Notebook } from '../../shared/types';
import SaveTemplateDialog from '../templates/SaveTemplateDialog';
import TemplateManagerDialog from '../templates/TemplateManagerDialog';
import TemplatePickerDialog from '../templates/TemplatePickerDialog';
import type { WorkspaceTemplate } from '../templates/types';
import { useTemplates } from '../templates/useTemplates';

export type NotebookSwitcherRequest =
  | { type: 'edit'; notebookId: number; token: number }
  | { type: 'create'; token: number };

interface NotebookSwitcherProps {
  notebooks: Notebook[];
  activeNotebookId: number | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string;
  isConnected: boolean;
  searchInputRef?: RefObject<HTMLInputElement>;
  createName: string;
  createState: AsyncStatus;
  createError: string;
  request?: NotebookSwitcherRequest | null;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (notebookId: number | null) => void;
  onUpdate?: (notebookId: number, name: string) => Promise<boolean>;
  onDelete?: (notebookId: number) => Promise<boolean>;
  onCreateNameChange: (value: string) => void;
  onCreateNotebook: () => Promise<boolean>;
  onCreateNotebookFromTemplate?: (templateId: number, name: string) => Promise<boolean>;
}

export default function NotebookSwitcher({
  notebooks,
  activeNotebookId,
  isOpen,
  isLoading,
  error,
  isConnected,
  searchInputRef,
  createName,
  createState,
  createError,
  request = null,
  onToggle,
  onClose,
  onSelect,
  onUpdate,
  onDelete,
  onCreateNameChange,
  onCreateNotebook,
  onCreateNotebookFromTemplate,
}: NotebookSwitcherProps) {
  const [searchValue, setSearchValue] = useState('');
  const [editingNotebookId, setEditingNotebookId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateNotebookId, setSaveTemplateNotebookId] = useState<number | null>(null);
  const [saveTemplateDefaultName, setSaveTemplateDefaultName] = useState('');
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const createInputHostRef = useRef<HTMLDivElement | null>(null);
  const lastRequestTokenRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const createTriggerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const createPanelRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const [createPos, setCreatePos] = useState<{ top: number; left: number } | null>(null);
  // Portal to body at tooltip layer so GridStack / sidebar cannot cover the panel.
  // No backdrop/blur — plain dropdown only.
  const { style: panelStyle } = useLayer('tooltip');

  const createLoading = createState === 'loading';
  const createDisabled = !isConnected || createLoading || createName.trim().length === 0;
  const outputType = useWorkspaceStore((s) => s.outputType);

  const {
    templates,
    isLoading: templatesLoading,
    error: templatesError,
    updateTemplateDescription,
    removeTemplate,
    saveCurrentNotebookAsTemplate,
  } = useTemplates();

  async function handleCreate() {
    if (createDisabled) return;
    const created = await onCreateNotebook();
    if (created) {
      setCreateOpen(false);
    }
  }

  async function handleCreateFromTemplate(template: WorkspaceTemplate, notebookName: string) {
    if (!onCreateNotebookFromTemplate) return false;
    const ok = await onCreateNotebookFromTemplate(template.id, notebookName);
    if (ok && template.config.outputType) {
      useWorkspaceStore.getState().setOutputType(template.config.outputType);
    }
    return ok;
  }

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      searchInputRef?.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, searchInputRef]);

  useEffect(() => {
    if (!createOpen) return;
    const timer = setTimeout(() => {
      createInputHostRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [createOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPanelPos(null);
      return;
    }
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 340;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      setPanelPos({ top: rect.bottom + 4, left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!createOpen) {
      setCreatePos(null);
      return;
    }
    const update = () => {
      const rect = createTriggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 256;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      setCreatePos({ top: rect.bottom + 4, left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [createOpen]);

  useEffect(() => {
    if (!isOpen && !createOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (createOpen) {
        setCreateOpen(false);
        return;
      }
      onClose();
      setSearchValue('');
      setEditingNotebookId(null);
      setEditingTitle('');
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [createOpen, isOpen, onClose]);

  // Click-outside close without a dimming mask.
  useEffect(() => {
    if (!isOpen && !createOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target;
      // ConfirmPopover portals to body above this panel — ignore it.
      if (target instanceof Element && target.closest('[data-confirm-popover]')) return;
      if (!(target instanceof Node)) return;
      if (isOpen) {
        if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
        onClose();
        setSearchValue('');
        setEditingNotebookId(null);
        setEditingTitle('');
        return;
      }
      if (createOpen) {
        if (
          createPanelRef.current?.contains(target) ||
          createTriggerRef.current?.contains(target)
        ) {
          return;
        }
        setCreateOpen(false);
      }
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [createOpen, isOpen, onClose]);

  const activeNotebook = notebooks.find((item) => item.id === activeNotebookId) ?? null;
  const filteredNotebooks = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return notebooks;
    return notebooks.filter((item) => item.title.toLowerCase().includes(keyword));
  }, [searchValue, notebooks]);

  function closeSwitcher() {
    onClose();
    setSearchValue('');
    setEditingNotebookId(null);
    setEditingTitle('');
  }

  function startEditing(notebook: Notebook) {
    setEditingNotebookId(notebook.id);
    setEditingTitle(notebook.title);
  }

  useEffect(() => {
    if (!request) return;
    if (lastRequestTokenRef.current === request.token) return;

    if (request.type === 'create') {
      lastRequestTokenRef.current = request.token;
      setCreateOpen(true);
      return;
    }

    if (request.type === 'edit') {
      if (!isOpen) return;
      const notebook = notebooks.find((item) => item.id === request.notebookId);
      if (!notebook) return;
      startEditing(notebook);
      lastRequestTokenRef.current = request.token;
    }
  }, [isOpen, notebooks, request]);

  async function handleSaveEdit() {
    if (!editingNotebookId || !onUpdate || isUpdating) return;
    setIsUpdating(true);
    try {
      const success = await onUpdate(editingNotebookId, editingTitle);
      if (success) {
        setEditingNotebookId(null);
        setEditingTitle('');
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete(notebookId: number) {
    if (!onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(notebookId);
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    if (editingNotebookId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingNotebookId]);

  useEffect(() => {
    if (isOpen) return;
    setSearchValue('');
    setEditingNotebookId(null);
    setEditingTitle('');
  }, [isOpen]);

  const displayTitle = activeNotebook?.title ?? '未命名笔记本';

  return (
    <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden h-8">
      <TemplatePickerDialog
        open={templatePickerOpen}
        templates={templates}
        isLoading={templatesLoading}
        error={templatesError}
        onClose={() => setTemplatePickerOpen(false)}
        onOpenManager={() => {
          setTemplatePickerOpen(false);
          setTemplateManagerOpen(true);
        }}
        onCreate={handleCreateFromTemplate}
      />

      <TemplateManagerDialog
        open={templateManagerOpen}
        templates={templates}
        isLoading={templatesLoading}
        error={templatesError}
        onClose={() => setTemplateManagerOpen(false)}
        onUpdateDescription={async (templateId, description) => {
          await updateTemplateDescription(templateId, description);
        }}
        onDelete={async (templateId) => {
          await removeTemplate(templateId);
        }}
      />

      <SaveTemplateDialog
        open={saveTemplateOpen}
        notebookId={saveTemplateNotebookId}
        defaultName={saveTemplateDefaultName}
        defaultOutputType={outputType}
        onClose={() => setSaveTemplateOpen(false)}
        onSave={async ({ notebookId, name, description, outputType: templateOutputType }) => {
          try {
            await saveCurrentNotebookAsTemplate({
              notebookId,
              name,
              description,
              outputType: templateOutputType,
            });
            return true;
          } catch {
            return false;
          }
        }}
      />

      <div className="flex items-center min-w-0 h-8">
        <button
          ref={triggerRef}
          type="button"
          className="flex items-center gap-2 px-3 py-1 h-full hover:bg-gray-100 transition-colors text-left min-w-[120px] max-w-[240px]"
          {...tid(TestIds.notebookSwitcherTrigger)}
          onClick={() => {
            if (isOpen) {
              closeSwitcher();
            } else {
              setCreateOpen(false);
              onToggle();
            }
          }}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={`当前笔记本：${displayTitle}`}
        >
          <Typography
            variant="small"
            className="font-semibold text-gray-900 text-xs truncate max-w-[120px] sm:max-w-[160px]"
          >
            {displayTitle}
          </Typography>
          <ExpandMoreIcon
            className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <div className="h-4 w-px bg-gray-300" />

        <div ref={createTriggerRef} className="h-full">
          <IconButton
            variant="text"
            size="sm"
            className="rounded-none h-8 w-8 hover:bg-gray-100"
            disabled={!isConnected}
            {...tid(TestIds.notebookCreateButton)}
            onClick={() => {
              if (createOpen) {
                setCreateOpen(false);
                return;
              }
              if (isOpen) closeSwitcher();
              setCreateOpen(true);
            }}
            aria-label="新建笔记本"
          >
            {createLoading ? <Spinner className="h-3 w-3" /> : <AddIcon style={{ fontSize: 18 }} />}
          </IconButton>
        </div>
      </div>

      {isOpen && panelPos
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed w-[340px] max-h-[420px] max-w-[calc(100vw-16px)] p-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
              style={{ ...panelStyle, top: panelPos.top, left: panelPos.left }}
              role="dialog"
              aria-label="切换笔记本"
              {...tid(TestIds.notebookSwitcherOverlay)}
            >
              <div className="p-3 border-b border-gray-200">
                <div className="relative w-full">
                  <div className="absolute top-2/4 left-3 -translate-y-2/4 text-gray-500">
                    <SearchIcon style={{ fontSize: 16 }} />
                  </div>
                  <input
                    ref={searchInputRef}
                    className="w-full h-8 pl-9 pr-3 rounded-lg bg-gray-100 border border-gray-300 text-xs text-gray-900 focus:outline-none focus:border-gray-500 focus:ring-0"
                    placeholder="搜索笔记本"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    id="notebook-search-input"
                    name="notebookSearch"
                    aria-label="搜索笔记本"
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 mt-2">
                    <Typography variant="small" color="red" className="text-[11px]">
                      {error}
                    </Typography>
                  </div>
                )}
              </div>

              <div
                className="max-h-[300px] overflow-y-auto p-2 flex flex-col gap-1"
                {...tid(TestIds.notebookList)}
              >
                {isLoading ? (
                  <div className="flex justify-center py-4">
                    <Spinner className="h-5 w-5" />
                  </div>
                ) : filteredNotebooks.length === 0 ? (
                  <div className="py-4 text-center text-xs text-gray-600">
                    {searchValue ? '未找到匹配笔记本' : '暂无笔记本'}
                  </div>
                ) : (
                  filteredNotebooks.map((item) => (
                    <div
                      key={item.id}
                      className={`group relative rounded-lg transition-colors ${
                        item.id === activeNotebookId ? 'bg-gray-200' : 'hover:bg-gray-100'
                      }`}
                    >
                      {editingNotebookId === item.id ? (
                        <div className="flex items-center gap-1 p-1 pr-2">
                          <input
                            ref={editInputRef}
                            className="flex-1 h-7 px-2 text-sm rounded border border-gray-400 focus:border-blue-500 focus:outline-none"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleSaveEdit();
                              } else if (e.key === 'Escape') {
                                setEditingNotebookId(null);
                                setEditingTitle('');
                              }
                            }}
                            disabled={isUpdating}
                            name="notebookTitle"
                            aria-label="编辑笔记本标题"
                          />
                          <IconButton
                            size="sm"
                            variant="text"
                            className="w-6 h-6 min-w-[24px] rounded text-blue-500 hover:bg-blue-50"
                            onClick={() => {
                              void handleSaveEdit();
                            }}
                            disabled={isUpdating}
                          >
                            {isUpdating ? (
                              <Spinner className="h-3 w-3" />
                            ) : (
                              <CheckIcon style={{ fontSize: 16 }} />
                            )}
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="text"
                            className="w-6 h-6 min-w-[24px] rounded text-gray-600 hover:bg-gray-200"
                            onClick={() => {
                              setEditingNotebookId(null);
                              setEditingTitle('');
                            }}
                          >
                            <CloseIcon style={{ fontSize: 16 }} />
                          </IconButton>
                        </div>
                      ) : (
                        <>
                          <button
                            className="w-full text-left p-2 pr-16"
                            {...tid(TestIds.notebookOption)}
                            onClick={() => {
                              onSelect(item.id);
                              closeSwitcher();
                            }}
                          >
                            <Typography
                              variant="small"
                              className={`text-xs truncate ${
                                item.id === activeNotebookId
                                  ? 'font-semibold text-gray-900'
                                  : 'font-medium text-gray-800'
                              }`}
                            >
                              {item.title}
                            </Typography>
                            <Typography
                              variant="small"
                              className="text-[10px] text-gray-500 font-medium mt-0.5"
                            >
                              {item.updatedAt}
                            </Typography>
                          </button>

                          {isConnected && (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-inherit">
                              {onUpdate && (
                                <IconButton
                                  size="sm"
                                  variant="text"
                                  className="w-6 h-6 min-w-[24px] rounded hover:bg-gray-300 text-gray-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(item);
                                  }}
                                >
                                  <EditIcon style={{ fontSize: 14 }} />
                                </IconButton>
                              )}
                              <IconButton
                                size="sm"
                                variant="text"
                                className="w-6 h-6 min-w-[24px] rounded hover:bg-gray-300 text-gray-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSaveTemplateNotebookId(item.id);
                                  setSaveTemplateDefaultName(item.title);
                                  setSaveTemplateOpen(true);
                                  closeSwitcher();
                                }}
                                aria-label="保存为模板"
                              >
                                <BookmarkAddIcon style={{ fontSize: 14 }} />
                              </IconButton>
                              {onDelete && (
                                <ConfirmPopover
                                  message={`确定删除「${item.title}」？此操作不可撤销。`}
                                  onConfirm={() => {
                                    void handleDelete(item.id);
                                  }}
                                  placement="left"
                                  disabled={isDeleting}
                                >
                                  <IconButton
                                    size="sm"
                                    variant="text"
                                    className="w-6 h-6 min-w-[24px] rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    disabled={isDeleting}
                                  >
                                    <DeleteIcon style={{ fontSize: 14 }} />
                                  </IconButton>
                                </ConfirmPopover>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}

      {createOpen && createPos
        ? createPortal(
            <div
              ref={createPanelRef}
              className="fixed w-64 max-w-[calc(100vw-16px)] p-4 rounded-xl border border-gray-200 bg-white shadow-xl"
              style={{ ...panelStyle, top: createPos.top, left: createPos.left }}
              role="dialog"
              aria-label="新建笔记本"
              {...tid(TestIds.notebookCreateOverlay)}
            >
              <Typography variant="small" className="font-semibold text-gray-600 text-[11px] mb-2">
                新建笔记本
              </Typography>
              <div ref={createInputHostRef}>
                <Input
                  variant="outlined"
                  labelProps={{ className: 'hidden' }}
                  className="!border !border-gray-300 bg-white text-gray-900 shadow-lg shadow-gray-900/5 ring-4 ring-transparent placeholder:text-gray-500 focus:!border-gray-900 focus:!border-t-gray-900 focus:ring-gray-900/10"
                  containerProps={{ className: 'min-w-0' }}
                  value={createName}
                  onChange={(e) => onCreateNameChange(e.target.value)}
                  placeholder={isConnected ? '输入名称' : '未连接到后端'}
                  disabled={!isConnected || createLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleCreate();
                    }
                  }}
                />
              </div>
              {createError && (
                <Typography variant="small" color="red" className="mt-1 text-[10px]">
                  {createError}
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
                  onClick={() => {
                    void handleCreate();
                  }}
                >
                  创建
                </Button>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="text"
                  className="rounded-full px-3 py-1.5 normal-case font-normal text-gray-700 text-[11px] flex items-center gap-1"
                  disabled={!isConnected || !onCreateNotebookFromTemplate}
                  onClick={() => {
                    setCreateOpen(false);
                    setTemplatePickerOpen(true);
                  }}
                >
                  <TemplateIcon style={{ fontSize: 14 }} />
                  从模板
                </Button>
                <Button
                  size="sm"
                  variant="text"
                  className="rounded-full px-3 py-1.5 normal-case font-normal text-gray-700 text-[11px] flex items-center gap-1"
                  disabled={!isConnected}
                  onClick={() => {
                    setCreateOpen(false);
                    setTemplateManagerOpen(true);
                  }}
                >
                  <SettingsIcon style={{ fontSize: 14 }} />
                  管理模板
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
