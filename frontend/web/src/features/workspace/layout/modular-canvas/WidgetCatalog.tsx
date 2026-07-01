import type { WidgetMeta } from "./types";

import { useLayer } from "../../../../shared/layer";

interface WidgetCatalogProps {
  open: boolean;
  onClose: () => void;
  widgetMeta: Record<string, WidgetMeta>;
  activeWidgetIds: string[];
  onAddWidget: (id: string) => void;
}

export default function WidgetCatalog({
  open,
  onClose,
  widgetMeta,
  activeWidgetIds,
  onAddWidget,
}: WidgetCatalogProps) {
  if (!open) return null;

  const { style: layerStyle } = useLayer("popover");

  return (
    <div
      className="fixed inset-0"
      style={layerStyle}
      role="dialog"
      aria-modal="true"
      aria-label="模块目录"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        onClick={onClose}
        aria-label="关闭模块目录"
      />
      <div className="absolute top-14 right-36 z-10 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 p-2">
        <div className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 py-1.5">
          模块目录
        </div>
        {Object.entries(widgetMeta).map(([id, meta]) => {
          const isActive = activeWidgetIds.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (!isActive) {
                  onAddWidget(id);
                  onClose();
                }
              }}
              disabled={isActive}
              className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-left transition-colors ${
                isActive
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer"
              }`}
            >
              <span className="text-base">{meta.icon}</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                {meta.label}
              </span>
              {isActive && (
                <span className="ml-auto text-[9px] text-gray-400 dark:text-slate-500">已添加</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
