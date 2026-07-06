import { useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useLayer } from "../../../../shared/layer";

export interface CommandItem {
  id: string;
  label: string;
  icon: ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export default function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { style: modalStyle } = useLayer("modal");

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = commands.filter(
    (cmd) => !query || cmd.label.toLowerCase().includes(query.toLowerCase()),
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-start justify-center pt-[18vh] bg-black/40 backdrop-blur-sm"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        onClick={onClose}
        aria-label="关闭命令面板"
      />
      <div className="w-[460px] max-w-[90vw] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden relative z-10">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
            if (e.key === "Enter" && filtered.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              filtered[0].action();
              onClose();
            }
          }}
          placeholder="搜索命令…"
          className="w-full px-5 py-3.5 text-sm border-b border-gray-100 dark:border-slate-700 outline-none bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
        />
        <div className="max-h-[280px] overflow-y-auto p-1.5">
          {filtered.map((cmd) => (
            <button
              key={cmd.id}
              type="button"
              onClick={() => {
                cmd.action();
                onClose();
              }}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            >
              <span className="text-base w-6 text-center flex-shrink-0">{cmd.icon}</span>
              <span className="text-xs font-medium">{cmd.label}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-xs text-gray-400 dark:text-slate-500 py-5">
              无匹配命令
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
