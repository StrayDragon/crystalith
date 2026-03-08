import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, IconButton, Input, Spinner, Typography } from "@material-tailwind/react";
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";

import ConfirmPopover from "../../../../shared/ConfirmPopover";
import { useLayer } from "../../../../shared/layer";
import { toast } from "../../../../shared/toast";
import { useFocusTrap } from "../../shared/hooks/useFocusTrap";
import type { WorkspaceTemplate } from "./types";

interface TemplateManagerDialogProps {
  open: boolean;
  templates: WorkspaceTemplate[];
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onUpdateDescription: (templateId: number, description: string) => Promise<void>;
  onDelete: (templateId: number) => Promise<void>;
}

export default function TemplateManagerDialog({
  open,
  templates,
  isLoading,
  error,
  onClose,
  onUpdateDescription,
  onDelete,
}: TemplateManagerDialogProps) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const next: Record<number, string> = {};
    for (const tpl of templates) {
      next[tpl.id] = tpl.description ?? "";
    }
    setDrafts(next);
  }, [open, templates]);

  const items = useMemo(() => templates, [templates]);

  const { style: modalStyle } = useLayer("modal");
  const modalRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap({ active: open, containerRef: modalRef, onEscape: onClose });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-3xl mx-4 ux-modal-in"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <SettingsIcon style={{ fontSize: 20 }} className="text-gray-700 dark:text-slate-200" />
            <span className="text-base font-semibold text-gray-900 dark:text-slate-100">
              模板管理
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="关闭"
          >
            <CloseIcon style={{ fontSize: 18 }} className="text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Spinner className="h-5 w-5" />
            </div>
          ) : error ? (
            <div className="p-4 text-xs text-red-600">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-xs text-gray-600 dark:text-slate-300">暂无模板</div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((tpl) => {
                const draft = drafts[tpl.id] ?? "";
                const dirty = (draft ?? "") !== (tpl.description ?? "");
                const disabled = tpl.isBuiltin;
                return (
                  <div
                    key={tpl.id}
                    className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Typography
                            variant="small"
                            className="font-semibold text-gray-900 dark:text-slate-100 text-xs truncate"
                          >
                            {tpl.name}
                          </Typography>
                          {tpl.isBuiltin && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                              内置
                            </span>
                          )}
                        </div>
                        <Typography
                          variant="small"
                          className="text-[10px] text-gray-500 dark:text-slate-400"
                        >
                          会话 {tpl.config.sessionTitles.length} · 标签{" "}
                          {tpl.config.sourceTags.length}
                        </Typography>
                      </div>

                      <div className="flex items-center gap-1">
                        <IconButton
                          size="sm"
                          variant="text"
                          className="w-8 h-8 min-w-[32px] rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-200 disabled:opacity-40"
                          disabled={!dirty || disabled || savingId === tpl.id}
                          onClick={async () => {
                            setSavingId(tpl.id);
                            try {
                              await onUpdateDescription(tpl.id, draft);
                              toast.success("模板已更新");
                            } catch {
                              toast.error("更新失败");
                            } finally {
                              setSavingId(null);
                            }
                          }}
                          aria-label="保存模板"
                        >
                          {savingId === tpl.id ? (
                            <Spinner className="h-3 w-3" />
                          ) : (
                            <SaveIcon style={{ fontSize: 18 }} />
                          )}
                        </IconButton>

                        <ConfirmPopover
                          message={`确定删除模板「${tpl.name}」？此操作不可撤销。`}
                          onConfirm={async () => {
                            setDeletingId(tpl.id);
                            try {
                              await onDelete(tpl.id);
                              toast.success("模板已删除");
                            } catch (err) {
                              const msg = err instanceof Error ? err.message : "删除失败";
                              toast.error(msg);
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                          placement="left"
                          disabled={tpl.isBuiltin || deletingId === tpl.id}
                        >
                          <IconButton
                            size="sm"
                            variant="text"
                            className="w-8 h-8 min-w-[32px] rounded hover:bg-red-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-200 disabled:opacity-40"
                            disabled={tpl.isBuiltin || deletingId === tpl.id}
                            aria-label="删除模板"
                          >
                            {deletingId === tpl.id ? (
                              <Spinner className="h-3 w-3" />
                            ) : (
                              <DeleteIcon style={{ fontSize: 18 }} />
                            )}
                          </IconButton>
                        </ConfirmPopover>
                      </div>
                    </div>

                    <div>
                      <Typography
                        variant="small"
                        className="font-semibold text-gray-600 dark:text-slate-200 text-[11px] mb-1"
                      >
                        描述
                      </Typography>
                      <Input
                        variant="outlined"
                        labelProps={{ className: "hidden" }}
                        className="!border !border-gray-300 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-lg shadow-gray-900/5 ring-4 ring-transparent placeholder:text-gray-500 focus:!border-gray-900 focus:!border-t-gray-900 focus:ring-gray-900/10"
                        containerProps={{ className: "min-w-0" }}
                        value={draft}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [tpl.id]: e.target.value }))
                        }
                        placeholder={disabled ? "内置模板不可编辑" : "输入描述"}
                        disabled={disabled}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end">
          <Button
            size="sm"
            variant="filled"
            className="rounded-full px-4 py-1.5 normal-case font-normal bg-gray-900 dark:bg-slate-100 dark:text-slate-900 text-[11px]"
            onClick={onClose}
          >
            关闭
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
