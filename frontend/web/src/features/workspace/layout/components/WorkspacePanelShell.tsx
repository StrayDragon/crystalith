import type { ReactNode, RefObject } from 'react';
import { IconButton, Tooltip } from '@material-tailwind/react';

import { IconExitFullscreen, IconFullscreen } from '../../shared/components/Icons';
import ErrorBoundary from '../../shared/components/ErrorBoundary';

export type WorkspacePanelKey = 'sources' | 'chat' | 'studio';

export type WorkspaceExpandedPanel = WorkspacePanelKey | null;

type WorkspacePanelShellProps = {
  panel: WorkspacePanelKey;
  title: string;
  ariaLabel: string;
  expandedPanel: WorkspaceExpandedPanel;
  onToggleExpand: (panel: WorkspacePanelKey) => void;
  headerExtras?: ReactNode;
  errorTitle: string;
  errorDescription: string;
  sectionRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

export default function WorkspacePanelShell({
  panel,
  title,
  ariaLabel,
  expandedPanel,
  onToggleExpand,
  headerExtras,
  errorTitle,
  errorDescription,
  sectionRef,
  children,
}: WorkspacePanelShellProps) {
  const isExpanded = expandedPanel === panel;

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className="flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden ux-fade-in focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 dark:focus-visible:ring-blue-500"
      style={{
        animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      aria-label={ariaLabel}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/70 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h2>
          {headerExtras}
        </div>

        <Tooltip content={isExpanded ? '收起' : '展开'}>
          <IconButton
            variant="text"
            size="sm"
            className="w-7 h-7 rounded-full text-gray-500 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
            onClick={() => onToggleExpand(panel)}
          >
            {isExpanded ? (
              <IconExitFullscreen className="w-4 h-4" />
            ) : (
              <IconFullscreen className="w-4 h-4" />
            )}
          </IconButton>
        </Tooltip>
      </div>

      <ErrorBoundary title={errorTitle} description={errorDescription}>
        {children}
      </ErrorBoundary>
    </section>
  );
}
