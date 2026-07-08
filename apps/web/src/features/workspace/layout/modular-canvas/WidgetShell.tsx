import type { ReactNode } from 'react';

import ErrorBoundary from '../../shared/components/ErrorBoundary';

interface WidgetShellProps {
  icon: ReactNode;
  label: string;
  locked: boolean;
  headerExtras?: ReactNode;
  children: ReactNode;
  onRemove?: () => void;
}

export default function WidgetShell({
  icon,
  label,
  locked,
  headerExtras,
  children,
  onRemove,
}: WidgetShellProps) {
  return (
    <div
      className={`flex flex-col h-full rounded-[14px] overflow-hidden bg-white dark:bg-slate-900 border shadow-sm transition-shadow duration-200 ${
        locked
          ? 'border-gray-200 dark:border-slate-700 hover:shadow-md'
          : 'border-dashed border-amber-300/40 dark:border-amber-600/30 hover:shadow-md'
      }`}
    >
      {/* Drag handle area */}
      <div
        className={`mc-draghandle flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/60 flex-shrink-0 select-none ${
          locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        {icon && <span className="text-sm flex-shrink-0">{icon}</span>}
        <span className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 tracking-wide uppercase">
          {label}
        </span>

        {headerExtras && <div className="flex items-center gap-1.5">{headerExtras}</div>}

        <span className="flex-1" />

        {!locked && (
          <span className="text-[10px] text-gray-300 dark:text-slate-600 tracking-widest flex-shrink-0">
            ⋮⋮
          </span>
        )}
        {onRemove && !locked && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-1 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs flex-shrink-0"
            aria-label={`移除${label}模块`}
          >
            ✕
          </button>
        )}
      </div>

      {/* Widget content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ErrorBoundary title={`${label}模块异常`} description={`${label}模块渲染失败，请重试。`}>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  );
}
