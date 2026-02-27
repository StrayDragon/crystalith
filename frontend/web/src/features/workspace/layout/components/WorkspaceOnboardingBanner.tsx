import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Close as CloseIcon } from '@mui/icons-material';

import type { WorkspaceReadiness } from '../hooks/useWorkspaceReadiness';

const ONBOARDING_DISMISSED_KEY = 'crystalith_workspace_onboarding_dismissed_v1';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
  } catch {
    // ignore
  }
}

interface WorkspaceOnboardingBannerProps {
  readiness: WorkspaceReadiness;
  showReadyGuide: boolean;
  onRetryConnection: () => void;
  onOpenDiagnostics: () => void;
  onOpenDeploymentDocs: () => void;
  onCreateNotebook: () => void;
  onUploadSources: () => void;
  onAddSourceFromUrl: () => void;
  onFocusSourceSearch: () => void;
  onStartSession: () => void;
  onFocusChat: () => void;
  onOpenSlidesStudio: () => void;
  onOpenCommandPalette: () => void;
  onOpenShortcutHelp: () => void;
}

function ActionButton({
  children,
  onClick,
  variant = 'secondary',
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const className = useMemo(() => {
    if (variant === 'primary') {
      return 'px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs hover:bg-gray-800';
    }
    if (variant === 'ghost') {
      return 'px-3 py-1.5 rounded-lg text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800';
    }
    return 'px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800';
  }, [variant]);

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export default function WorkspaceOnboardingBanner({
  readiness,
  showReadyGuide,
  onRetryConnection,
  onOpenDiagnostics,
  onOpenDeploymentDocs,
  onCreateNotebook,
  onUploadSources,
  onAddSourceFromUrl,
  onFocusSourceSearch,
  onStartSession,
  onFocusChat,
  onOpenSlidesStudio,
  onOpenCommandPalette,
  onOpenShortcutHelp,
}: WorkspaceOnboardingBannerProps) {
  const [dismissed, setDismissed] = useState(readDismissed);

  const isDismissible = readiness.kind !== 'not_connected' && readiness.kind !== 'loading';
  const shouldRender = useMemo(() => {
    if (readiness.kind === 'loading') return false;
    if (readiness.kind === 'ready' && !showReadyGuide) return false;
    if (dismissed && isDismissible) return false;
    return true;
  }, [dismissed, isDismissible, readiness.kind, showReadyGuide]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    writeDismissed();
  }, []);

  const content = useMemo(() => {
    switch (readiness.kind) {
      case 'not_connected': {
        const title =
          readiness.connectionState === 'connecting' ? '正在连接后端…' : '后端连接失败';
        const description =
          readiness.connectionState === 'connecting'
            ? '首次加载可能需要几秒；若长时间无响应，请确认后端服务已启动。'
            : readiness.error || '未连接到后端服务，请检查后重试。';
        return {
          title,
          description,
          tone: readiness.connectionState === 'error' ? 'error' : 'info',
          actions: (
            <>
              <ActionButton variant="primary" onClick={onRetryConnection}>
                重试连接
              </ActionButton>
              <ActionButton variant="secondary" onClick={onOpenDiagnostics}>
                查看诊断
              </ActionButton>
              <ActionButton variant="ghost" onClick={onOpenDeploymentDocs}>
                打开部署文档
              </ActionButton>
            </>
          ),
        } as const;
      }

      case 'no_notebook':
        return {
          title: '先创建一个笔记本',
          description: '笔记本用于隔离不同项目的来源、对话与输出。',
          tone: 'info',
          actions: (
            <>
              <ActionButton variant="primary" onClick={onCreateNotebook}>
                创建笔记本
              </ActionButton>
              <ActionButton variant="secondary" onClick={onOpenCommandPalette}>
                命令面板（Ctrl+K）
              </ActionButton>
              <ActionButton variant="ghost" onClick={onOpenShortcutHelp}>
                快捷键帮助
              </ActionButton>
            </>
          ),
        } as const;

      case 'no_sources':
        return {
          title: '导入一些来源',
          description: '上传文件、从 URL 导入，或先做一次搜索，把内容放进当前笔记本。',
          tone: 'info',
          actions: (
            <>
              <ActionButton variant="primary" onClick={onUploadSources}>
                上传文件
              </ActionButton>
              <ActionButton variant="secondary" onClick={onAddSourceFromUrl}>
                从 URL 导入
              </ActionButton>
              <ActionButton variant="secondary" onClick={onFocusSourceSearch}>
                搜索导入
              </ActionButton>
            </>
          ),
        } as const;

      case 'no_session':
        return {
          title: '开始一个会话',
          description: '有了来源后，创建会话开始提问；也可以直接打开 Studio 生成输出。',
          tone: 'info',
          actions: (
            <>
              <ActionButton variant="primary" onClick={onStartSession}>
                一键开始会话
              </ActionButton>
              <ActionButton variant="secondary" onClick={onFocusChat}>
                去提问
              </ActionButton>
              <ActionButton variant="secondary" onClick={onOpenSlidesStudio}>
                打开 Slides Studio
              </ActionButton>
            </>
          ),
        } as const;

      case 'ready':
        return {
          title: '准备就绪',
          description: '试试提问（对话面板），或直接生成一个输出（例如 Slides）。',
          tone: 'success',
          actions: (
            <>
              <ActionButton variant="primary" onClick={onFocusChat}>
                开始提问
              </ActionButton>
              <ActionButton variant="secondary" onClick={onOpenSlidesStudio}>
                生成 Slides
              </ActionButton>
              <ActionButton variant="ghost" onClick={onOpenCommandPalette}>
                命令面板（Ctrl+K）
              </ActionButton>
            </>
          ),
        } as const;

      default:
        return null;
    }
  }, [
    onAddSourceFromUrl,
    onCreateNotebook,
    onFocusChat,
    onFocusSourceSearch,
    onOpenCommandPalette,
    onOpenDeploymentDocs,
    onOpenDiagnostics,
    onOpenShortcutHelp,
    onOpenSlidesStudio,
    onRetryConnection,
    onStartSession,
    onUploadSources,
    readiness,
  ]);

  if (!shouldRender || !content) return null;

  const borderTone =
    content.tone === 'error'
      ? 'border-red-200 bg-red-50/60 dark:border-red-900/30 dark:bg-red-950/20'
      : content.tone === 'success'
        ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/30 dark:bg-emerald-950/20'
        : 'border-blue-200 bg-blue-50/60 dark:border-slate-700 dark:bg-slate-900/40';

  return (
    <section
      aria-label="Workspace 引导提示"
      className={`mt-2 rounded-xl border ${borderTone} px-3 py-2 shadow-sm`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {content.title}
          </div>
          <div className="mt-0.5 text-xs text-gray-700 dark:text-slate-300">
            {content.description}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">{content.actions}</div>
        </div>

        {isDismissible ? (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="关闭引导提示"
            className="flex-shrink-0 w-7 h-7 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-colors flex items-center justify-center"
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
