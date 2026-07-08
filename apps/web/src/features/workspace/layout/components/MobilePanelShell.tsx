import type { ReactNode } from 'react';

import ErrorBoundary from '../../shared/components/ErrorBoundary';

interface MobilePanelShellProps {
  title: string;
  headerExtras?: ReactNode;
  children: ReactNode;
}

export default function MobilePanelShell({ title, headerExtras, children }: MobilePanelShellProps) {
  return (
    <section className="flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/60 flex-shrink-0">
        <h2 className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 tracking-wide uppercase">
          {title}
        </h2>
        <span className="flex-1" />
        {headerExtras}
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ErrorBoundary title={`${title}模块异常`} description={`${title}模块渲染失败，请重试。`}>
          {children}
        </ErrorBoundary>
      </div>
    </section>
  );
}
