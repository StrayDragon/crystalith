import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input, Spinner, Typography } from "@material-tailwind/react";
import { BookmarkAdd as BookmarkAddIcon, Close as CloseIcon } from "@mui/icons-material";

import { useLayer } from "../../../../shared/layer";
import { toast } from "../../../../shared/toast";
import { useFocusTrap } from "../../shared/hooks/useFocusTrap";
import { DEFAULT_TYPE_LABELS } from "../studio/studioUtils";
import type { OutputTypeId } from "../../shared/types";

const OUTPUT_TYPE_OPTIONS: OutputTypeId[] = [
  "FAQ",
  "GUIDE",
  "TIMELINE",
  "MINDMAP",
  "QUIZ",
  "BRIEFING",
  "SLIDES",
  "PARAGRAPH",
  "BULLETS",
  "STRUCTURED",
];

interface SaveTemplateDialogProps {
  open: boolean;
  notebookId: number | null;
  defaultName: string;
  defaultOutputType: OutputTypeId;
  onClose: () => void;
  onSave: (payload: {
    notebookId: number;
    name: string;
    description: string;
    outputType: OutputTypeId | null;
  }) => Promise<boolean>;
}

export default function SaveTemplateDialog({
  open,
  notebookId,
  defaultName,
  defaultOutputType,
  onClose,
  onSave,
}: SaveTemplateDialogProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [outputType, setOutputType] = useState<OutputTypeId | null>(defaultOutputType);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setDescription("");
    setOutputType(defaultOutputType);
  }, [open, defaultName, defaultOutputType]);

  const canSave = Boolean(notebookId) && name.trim().length > 0 && !isSaving;

  async function handleSave() {
    if (!notebookId) return;
    if (!canSave) return;

    setIsSaving(true);
    try {
      const ok = await onSave({
        notebookId,
        name: name.trim(),
        description: description.trim(),
        outputType,
      });
      if (ok) {
        toast.success("模板已保存");
        onClose();
      } else {
        toast.error("保存失败");
      }
    } finally {
      setIsSaving(false);
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
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="关闭"
        tabIndex={-1}
      />

      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg mx-4 ux-modal-in"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <BookmarkAddIcon
              style={{ fontSize: 20 }}
              className="text-gray-700 dark:text-slate-200"
            />
            <span className="text-base font-semibold text-gray-900 dark:text-slate-100">
              保存为模板
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

        <div className="p-4 flex flex-col gap-4">
          <div>
            <Typography
              variant="small"
              className="font-semibold text-gray-600 dark:text-slate-200 text-[11px] mb-2"
            >
              模板名称
            </Typography>
            <Input
              variant="outlined"
              labelProps={{ className: "hidden" }}
              className="!border !border-gray-300 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-lg shadow-gray-900/5 ring-4 ring-transparent placeholder:text-gray-500 focus:!border-gray-900 focus:!border-t-gray-900 focus:ring-gray-900/10"
              containerProps={{ className: "min-w-0" }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入名称"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSave();
                }
              }}
            />
          </div>

          <div>
            <Typography
              variant="small"
              className="font-semibold text-gray-600 dark:text-slate-200 text-[11px] mb-2"
            >
              描述（可选）
            </Typography>
            <Input
              variant="outlined"
              labelProps={{ className: "hidden" }}
              className="!border !border-gray-300 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-lg shadow-gray-900/5 ring-4 ring-transparent placeholder:text-gray-500 focus:!border-gray-900 focus:!border-t-gray-900 focus:ring-gray-900/10"
              containerProps={{ className: "min-w-0" }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简单描述这个模板"
            />
          </div>

          <div>
            <Typography
              variant="small"
              className="font-semibold text-gray-600 dark:text-slate-200 text-[11px] mb-2"
            >
              输出偏好（可选）
            </Typography>
            <select
              className="w-full h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:border-gray-900"
              value={outputType ?? ""}
              onChange={(e) => setOutputType((e.target.value || null) as OutputTypeId | null)}
            >
              <option value="">默认</option>
              {OUTPUT_TYPE_OPTIONS.map((id) => (
                <option key={id} value={id}>
                  {DEFAULT_TYPE_LABELS[id]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-2">
          <Button
            size="sm"
            variant="text"
            className="rounded-full px-3 py-1.5 normal-case font-normal text-gray-700 dark:text-slate-200 text-[11px]"
            onClick={onClose}
            disabled={isSaving}
          >
            取消
          </Button>
          <Button
            size="sm"
            variant="filled"
            className="rounded-full px-3 py-1.5 normal-case font-normal bg-gray-900 dark:bg-slate-100 dark:text-slate-900 text-[11px]"
            onClick={handleSave}
            disabled={!canSave}
          >
            {isSaving ? <Spinner className="h-3 w-3" /> : "保存"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
