import { useMemo } from "react";
import { IconButton, Typography } from "@material-tailwind/react";
import { Close as CloseIcon } from "@mui/icons-material";

import { useLayer } from "../../../shared/layer";
import type { ShortcutCategory, WorkspaceShortcutDefinition } from "../shared/shortcuts";

interface ShortcutHelpPanelProps {
  open: boolean;
  shortcuts: WorkspaceShortcutDefinition[];
  onClose: () => void;
}

const CATEGORY_ORDER: ShortcutCategory[] = ["导航", "操作", "编辑"];

function renderShortcutCombo(combo: string) {
  return combo
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (
      <kbd
        key={`${combo}-${part}`}
        className="inline-flex min-w-[32px] items-center justify-center rounded-md border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        {part}
      </kbd>
    ));
}

export default function ShortcutHelpPanel({ open, shortcuts, onClose }: ShortcutHelpPanelProps) {
  const { style: modalStyle } = useLayer("modal", 20);

  const groupedShortcuts = useMemo(() => {
    const groups = new Map<ShortcutCategory, WorkspaceShortcutDefinition[]>();
    CATEGORY_ORDER.forEach((category) => groups.set(category, []));

    shortcuts.forEach((shortcut) => {
      const items = groups.get(shortcut.category) ?? [];
      items.push(shortcut);
      groups.set(shortcut.category, items);
    });

    return groups;
  }, [shortcuts]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="快捷键帮助"
      className="fixed inset-0 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm"
      style={modalStyle}
      onClick={onClose}
    >
      <section
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-slate-700">
          <div className="space-y-0.5">
            <Typography
              variant="h6"
              className="text-base font-semibold text-gray-900 dark:text-slate-100"
            >
              快捷键帮助
            </Typography>
            <Typography variant="small" className="text-xs text-gray-500 dark:text-slate-400">
              使用以下快捷键快速操作工作区
            </Typography>
          </div>
          <IconButton
            variant="text"
            size="sm"
            className="h-8 w-8 rounded-full text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={onClose}
            aria-label="关闭快捷键帮助"
          >
            <CloseIcon style={{ fontSize: 18 }} />
          </IconButton>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            {CATEGORY_ORDER.map((category) => {
              const items = groupedShortcuts.get(category) ?? [];
              if (items.length === 0) return null;

              return (
                <section key={category} className="space-y-2">
                  <Typography
                    variant="small"
                    className="text-xs font-semibold tracking-wide text-gray-500 dark:text-slate-400"
                  >
                    {category}
                  </Typography>
                  <div className="space-y-2">
                    {items.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70"
                      >
                        <Typography
                          variant="small"
                          className="text-sm text-gray-700 dark:text-slate-200"
                        >
                          {shortcut.description}
                        </Typography>
                        <div
                          className="flex items-center gap-1.5"
                          aria-label={`快捷键 ${shortcut.combo}`}
                        >
                          {renderShortcutCombo(shortcut.combo)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
