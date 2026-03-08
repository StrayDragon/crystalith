import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Button,
  IconButton,
  Input,
  Popover,
  PopoverHandler,
  PopoverContent,
  Typography,
  Spinner,
} from "@material-tailwind/react";
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
} from "@mui/icons-material";

import type { AsyncStatus } from "../../../../shared/types";
import type { Notebook } from "../../shared/types";
import ConfirmPopover from "../../../../shared/ConfirmPopover";
import { LAYER_LEVELS } from "../../../../shared/layer";
import { useWorkspaceStore } from "../../shared/state/workspaceStore";
import TemplatePickerDialog from "../templates/TemplatePickerDialog";
import TemplateManagerDialog from "../templates/TemplateManagerDialog";
import SaveTemplateDialog from "../templates/SaveTemplateDialog";
import { useTemplates } from "../templates/useTemplates";
import type { WorkspaceTemplate } from "../templates/types";

export type NotebookSwitcherRequest =
  | { type: "edit"; notebookId: number; token: number }
  | { type: "create"; token: number };

interface NotebookSwitcherProps {
  notebooks: Notebook[];
  activeNotebookId: number | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string;
  isConnected: boolean;
  searchInputRef?: RefObject<HTMLInputElement | null>;
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
  const [searchValue, setSearchValue] = useState("");
  const [editingNotebookId, setEditingNotebookId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateNotebookId, setSaveTemplateNotebookId] = useState<number | null>(null);
  const [saveTemplateDefaultName, setSaveTemplateDefaultName] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const lastRequestTokenRef = useRef<number | null>(null);

  const createLoading = createState === "loading";
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

  const activeNotebook = notebooks.find((item) => item.id === activeNotebookId) ?? null;
  const filteredNotebooks = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return notebooks;
    return notebooks.filter((item) => item.title.toLowerCase().includes(keyword));
  }, [searchValue, notebooks]);

  // Handle Popover state change
  const handlePopoverHandler = (openState: boolean) => {
    if (openState && !isOpen) {
      onToggle();
    } else if (!openState && isOpen) {
      onClose();
      setSearchValue("");
      setEditingNotebookId(null);
      setEditingTitle("");
    }
  };

  function startEditing(notebook: Notebook) {
    setEditingNotebookId(notebook.id);
    setEditingTitle(notebook.title);
  }

  useEffect(() => {
    if (!request) return;
    if (lastRequestTokenRef.current === request.token) return;

    if (request.type === "create") {
      lastRequestTokenRef.current = request.token;
      setCreateOpen(true);
      return;
    }

    if (request.type === "edit") {
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
        setEditingTitle("");
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
    setSearchValue("");
    setEditingNotebookId(null);
    setEditingTitle("");
  }, [isOpen]);

  const displayTitle = activeNotebook?.title ?? "未命名笔记本";

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
        onSave={async ({ notebookId, name, description, outputType }) => {
          try {
            await saveCurrentNotebookAsTemplate({
              notebookId,
              name,
              description,
              outputType,
            });
            return true;
          } catch {
            return false;
          }
        }}
      />

      <Popover open={isOpen} handler={handlePopoverHandler} placement="bottom-start" offset={4}>
        <PopoverHandler>
          <button className="flex items-center gap-2 px-3 py-1 h-full hover:bg-gray-100 transition-colors text-left min-w-[120px] max-w-[240px]">
            <Typography variant="small" className="font-medium text-gray-600 text-[11px]">
              笔记本
            </Typography>
            <Typography
              variant="small"
              className="font-semibold text-gray-900 text-xs truncate max-w-[120px] sm:max-w-[160px]"
            >
              {displayTitle}
            </Typography>
            <ExpandMoreIcon
              className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        </PopoverHandler>
        <PopoverContent
          className="w-[340px] max-h-[420px] p-0 overflow-hidden"
          style={{ zIndex: LAYER_LEVELS.popover }}
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
                autoFocus
                id="notebook-search-input"
                name="notebookSearch"
                aria-label="搜索笔记本"
              />
            </div>
            {/* Error State */}
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
            data-testid="notebook-list"
          >
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Spinner className="h-5 w-5" />
              </div>
            ) : filteredNotebooks.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-600">
                {searchValue ? "未找到匹配笔记本" : "暂无笔记本"}
              </div>
            ) : (
              filteredNotebooks.map((item) => (
                <div
                  key={item.id}
                  className={`group relative rounded-lg transition-colors ${
                    item.id === activeNotebookId ? "bg-gray-200" : "hover:bg-gray-100"
                  }`}
                >
                  {editingNotebookId === item.id ? (
                    // 编辑模式
                    <div className="flex items-center gap-1 p-1 pr-2">
                      <input
                        ref={editInputRef}
                        className="flex-1 h-7 px-2 text-sm rounded border border-gray-400 focus:border-blue-500 focus:outline-none"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSaveEdit();
                          } else if (e.key === "Escape") {
                            setEditingNotebookId(null);
                            setEditingTitle("");
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
                        onClick={handleSaveEdit}
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
                          setEditingTitle("");
                        }}
                      >
                        <CloseIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </div>
                  ) : (
                    // 正常显示模式
                    <>
                      <button
                        className="w-full text-left p-2 pr-16"
                        data-testid="notebook-option"
                        onClick={() => {
                          onSelect(item.id);
                          onClose();
                          setSearchValue("");
                        }}
                      >
                        <Typography
                          variant="small"
                          className={`text-xs truncate ${
                            item.id === activeNotebookId
                              ? "font-semibold text-gray-900"
                              : "font-medium text-gray-800"
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
                              onClose();
                            }}
                            aria-label="保存为模板"
                          >
                            <BookmarkAddIcon style={{ fontSize: 14 }} />
                          </IconButton>
                          {onDelete && (
                            <ConfirmPopover
                              message={`确定删除「${item.title}」？此操作不可撤销。`}
                              onConfirm={() => handleDelete(item.id)}
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
        </PopoverContent>
      </Popover>

      <div className="h-4 w-px bg-gray-300" />

      {/* Create Notebook Button */}
      <Popover open={createOpen} handler={setCreateOpen} placement="bottom-start" offset={4}>
        <PopoverHandler>
          <IconButton
            variant="text"
            size="sm"
            className="rounded-none h-full w-8 hover:bg-gray-100"
            disabled={!isConnected}
          >
            {createLoading ? <Spinner className="h-3 w-3" /> : <AddIcon style={{ fontSize: 18 }} />}
          </IconButton>
        </PopoverHandler>
        <PopoverContent className="w-64 p-4" style={{ zIndex: LAYER_LEVELS.popover }}>
          <Typography variant="small" className="font-semibold text-gray-600 text-[11px] mb-2">
            新建笔记本
          </Typography>
          <Input
            variant="outlined"
            labelProps={{ className: "hidden" }}
            className="!border !border-gray-300 bg-white text-gray-900 shadow-lg shadow-gray-900/5 ring-4 ring-transparent placeholder:text-gray-500 focus:!border-gray-900 focus:!border-t-gray-900 focus:ring-gray-900/10"
            containerProps={{ className: "min-w-0" }}
            value={createName}
            onChange={(e) => onCreateNameChange(e.target.value)}
            placeholder={isConnected ? "输入名称" : "未连接到后端"}
            disabled={!isConnected || createLoading}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
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
        </PopoverContent>
      </Popover>
    </div>
  );
}
