import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input, Spinner, Typography } from "@material-tailwind/react";
import { Close as CloseIcon, Layers as TemplateIcon } from "@mui/icons-material";

import { useLayer } from "../../../../shared/layer";
import { toast } from "../../../../shared/toast";
import { useFocusTrap } from "../../shared/hooks/useFocusTrap";
import { DEFAULT_TYPE_LABELS } from "../studio/studioUtils";
import type { WorkspaceTemplate } from "./types";

interface TemplatePickerDialogProps {
  open: boolean;
  templates: WorkspaceTemplate[];
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onOpenManager: () => void;
  onCreate: (template: WorkspaceTemplate, notebookName: string) => Promise<boolean>;
}

export default function TemplatePickerDialog({
  open,
  templates,
  isLoading,
  error,
  onClose,
  onOpenManager,
  onCreate,
}: TemplatePickerDialogProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notebookName, setNotebookName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  useEffect(() => {
    if (!open) return;
    const first = templates[0];
    if (first) {
      setSelectedId(first.id);
      setNotebookName(`${first.name} 笔记本`);
    } else {
      setSelectedId(null);
      setNotebookName("");
    }
  }, [open, templates]);

  useEffect(() => {
    if (!open) return;
    if (!selectedTemplate) return;
    setNotebookName((prev) => (prev.trim().length ? prev : `${selectedTemplate.name} 笔记本`));
  }, [open, selectedTemplate]);

  const canCreate = Boolean(selectedTemplate) && notebookName.trim().length > 0 && !isCreating;

  async function handleCreate() {
    if (!selectedTemplate) return;
    if (!canCreate) return;

    setIsCreating(true);
    try {
      const ok = await onCreate(selectedTemplate, notebookName.trim());
      if (ok) {
        toast.success("已从模板创建笔记本");
        onClose();
      } else {
        toast.error("创建失败，请检查后端状态。");
      }
    } finally {
      setIsCreating(false);
    }
  }

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
        className="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl mx-4 ux-modal-in"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <TemplateIcon style={{ fontSize: 20 }} className="text-gray-700 dark:text-slate-200" />
            <span className="text-base font-semibold text-gray-900 dark:text-slate-100">
              从模板创建
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

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-h-[320px] border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <Typography
                variant="small"
                className="font-semibold text-gray-600 dark:text-slate-200 text-[11px]"
              >
                模板列表
              </Typography>
              <Button
                size="sm"
                variant="text"
                className="rounded-full px-3 py-1.5 normal-case font-normal text-gray-700 dark:text-slate-200 text-[11px]"
                onClick={onOpenManager}
              >
                管理
              </Button>
            </div>

            <div className="max-h-[360px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-6">
                  <Spinner className="h-5 w-5" />
                </div>
              ) : error ? (
                <div className="p-4 text-xs text-red-600">{error}</div>
              ) : templates.length === 0 ? (
                <div className="p-4 text-xs text-gray-600 dark:text-slate-300">暂无模板</div>
              ) : (
                templates.map((tpl) => {
                  const active = tpl.id === selectedId;
                  return (
                    <button
                      key={tpl.id}
                      className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${active ? "bg-blue-50 dark:bg-slate-700" : ""}`}
                      onClick={() => {
                        setSelectedId(tpl.id);
                        setNotebookName(`${tpl.name} 笔记本`);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate">
                            {tpl.name}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-slate-400 truncate">
                            {tpl.isBuiltin ? "内置模板" : "自定义模板"}
                          </div>
                        </div>
                        {active && (
                          <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                            已选择
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="min-h-[320px] border border-gray-200 dark:border-slate-700 rounded-lg p-4">
            <Typography
              variant="small"
              className="font-semibold text-gray-600 dark:text-slate-200 text-[11px] mb-2"
            >
              新笔记本名称
            </Typography>
            <Input
              variant="outlined"
              labelProps={{ className: "hidden" }}
              className="!border !border-gray-300 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-lg shadow-gray-900/5 ring-4 ring-transparent placeholder:text-gray-500 focus:!border-gray-900 focus:!border-t-gray-900 focus:ring-gray-900/10"
              containerProps={{ className: "min-w-0" }}
              value={notebookName}
              onChange={(e) => setNotebookName(e.target.value)}
              placeholder="输入名称"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />

            {selectedTemplate && (
              <div className="mt-4">
                <Typography
                  variant="small"
                  className="font-semibold text-gray-600 dark:text-slate-200 text-[11px] mb-2"
                >
                  模板详情
                </Typography>
                {selectedTemplate.description ? (
                  <div className="text-xs text-gray-700 dark:text-slate-200 whitespace-pre-wrap">
                    {selectedTemplate.description}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 dark:text-slate-400">无描述</div>
                )}

                <div className="mt-3 text-xs text-gray-700 dark:text-slate-200">
                  <div>
                    <span className="font-semibold">会话：</span>
                    {selectedTemplate.config.sessionTitles.length
                      ? selectedTemplate.config.sessionTitles.join(" / ")
                      : "无"}
                  </div>
                  <div className="mt-1">
                    <span className="font-semibold">输出偏好：</span>
                    {selectedTemplate.config.outputType
                      ? DEFAULT_TYPE_LABELS[selectedTemplate.config.outputType]
                      : "默认"}
                  </div>
                  <div className="mt-1">
                    <span className="font-semibold">来源标签：</span>
                    {selectedTemplate.config.sourceTags.length
                      ? selectedTemplate.config.sourceTags.join(" / ")
                      : "无"}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button
                size="sm"
                variant="text"
                className="rounded-full px-3 py-1.5 normal-case font-normal text-gray-700 dark:text-slate-200 text-[11px]"
                onClick={onClose}
                disabled={isCreating}
              >
                取消
              </Button>
              <Button
                size="sm"
                variant="filled"
                className="rounded-full px-3 py-1.5 normal-case font-normal bg-gray-900 dark:bg-slate-100 dark:text-slate-900 text-[11px]"
                disabled={!canCreate}
                onClick={handleCreate}
              >
                {isCreating ? <Spinner className="h-3 w-3" /> : "创建"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
