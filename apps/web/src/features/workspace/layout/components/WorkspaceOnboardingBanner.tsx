import { Close as CloseIcon } from '@mui/icons-material';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { t } from '../../../../shared/i18n';
import { TestIds, tid, type TestId } from '../../../../shared/testids';
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
  slidesAvailable?: boolean;
  slidesRecoveryHint?: string | null;
  onRecoverSlides?: () => void;
  onOpenCommandPalette: () => void;
  onOpenShortcutHelp: () => void;
}

function ActionButton({
  children,
  onClick,
  variant = 'secondary',
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  testId?: TestId;
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
    <button type="button" onClick={onClick} className={className} {...(testId ? tid(testId) : {})}>
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
  slidesAvailable = false,
  slidesRecoveryHint = null,
  onRecoverSlides,
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
    const slidesHint = !slidesAvailable
      ? slidesRecoveryHint?.trim() || 'Slides 当前由插件提供，请先安装并启用对应插件。'
      : null;
    const slidesAction = slidesAvailable ? (
      <ActionButton variant="secondary" onClick={onOpenSlidesStudio}>
        {t('workspace.onboarding.generate_slides')}
      </ActionButton>
    ) : (
      <ActionButton variant="secondary" onClick={onRecoverSlides ?? onOpenDiagnostics}>
        {t('workspace.onboarding.recover_slides')}
      </ActionButton>
    );

    switch (readiness.kind) {
      case 'not_connected': {
        const title =
          readiness.connectionState === 'connecting'
            ? t('workspace.onboarding.connecting_title')
            : t('workspace.onboarding.connection_failed_title');
        const description =
          readiness.connectionState === 'connecting'
            ? t('workspace.onboarding.connecting_description')
            : readiness.error || t('workspace.onboarding.connection_failed_description');
        return {
          title,
          description,
          tone: readiness.connectionState === 'error' ? 'error' : 'info',
          actions: (
            <>
              <ActionButton variant="primary" onClick={onRetryConnection} testId={TestIds.connectionRetry}>
                {t('workspace.onboarding.retry_connection')}
              </ActionButton>
              <ActionButton variant="secondary" onClick={onOpenDiagnostics}>
                {t('workspace.onboarding.open_diagnostics')}
              </ActionButton>
              <ActionButton variant="ghost" onClick={onOpenDeploymentDocs}>
                {t('workspace.onboarding.open_deployment_docs')}
              </ActionButton>
            </>
          ),
        } as const;
      }

      case 'no_notebook':
        return {
          title: t('workspace.onboarding.no_notebook_title'),
          description: t('workspace.onboarding.no_notebook_description'),
          tone: 'info',
          actions: (
            <>
              <ActionButton variant="primary" onClick={onCreateNotebook}>
                {t('workspace.onboarding.create_notebook')}
              </ActionButton>
              <ActionButton variant="secondary" onClick={onOpenCommandPalette}>
                {t('workspace.onboarding.command_palette')}
              </ActionButton>
              <ActionButton variant="ghost" onClick={onOpenShortcutHelp}>
                {t('workspace.onboarding.shortcut_help')}
              </ActionButton>
            </>
          ),
        } as const;

      case 'no_sources':
        return {
          title: t('workspace.onboarding.no_sources_title'),
          description: t('workspace.onboarding.no_sources_description'),
          tone: 'info',
          actions: (
            <>
              <ActionButton variant="primary" onClick={onUploadSources}>
                {t('workspace.onboarding.upload_sources')}
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={onAddSourceFromUrl}
                testId={TestIds.urlImportOpen}
              >
                {t('workspace.onboarding.add_source_from_url')}
              </ActionButton>
              <ActionButton variant="secondary" onClick={onFocusSourceSearch}>
                {t('workspace.onboarding.focus_source_search')}
              </ActionButton>
            </>
          ),
        } as const;

      case 'no_session':
        return {
          title: t('workspace.onboarding.no_session_title'),
          description: t('workspace.onboarding.no_session_description'),
          tone: 'info',
          actions: (
            <>
              <ActionButton variant="primary" onClick={onStartSession}>
                {t('workspace.onboarding.start_session')}
              </ActionButton>
              <ActionButton variant="secondary" onClick={onFocusChat}>
                {t('workspace.onboarding.focus_chat')}
              </ActionButton>
              {slidesAvailable ? (
                <ActionButton variant="secondary" onClick={onOpenSlidesStudio}>
                  {t('workspace.onboarding.open_slides_studio')}
                </ActionButton>
              ) : (
                <ActionButton variant="secondary" onClick={onRecoverSlides ?? onOpenDiagnostics}>
                  {t('workspace.onboarding.recover_slides')}
                </ActionButton>
              )}
            </>
          ),
          hint: slidesHint,
        } as const;

      case 'ready':
        return {
          title: t('workspace.onboarding.ready_title'),
          description: t('workspace.onboarding.ready_description'),
          tone: 'success',
          actions: (
            <>
              <ActionButton variant="primary" onClick={onFocusChat}>
                {t('workspace.onboarding.ask_question')}
              </ActionButton>
              {slidesAction}
              <ActionButton variant="ghost" onClick={onOpenCommandPalette}>
                {t('workspace.onboarding.command_palette')}
              </ActionButton>
            </>
          ),
          hint: slidesHint,
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
    onRecoverSlides,
    onRetryConnection,
    onStartSession,
    onUploadSources,
    readiness,
    slidesAvailable,
    slidesRecoveryHint,
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
      aria-label={t('workspace.onboarding.banner_aria')}
      className={`mt-2 rounded-xl border ${borderTone} px-3 py-2 shadow-sm`}
      {...tid(TestIds.onboardingBanner)}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {content.title}
          </div>
          <div className="mt-0.5 text-xs text-gray-700 dark:text-slate-300">
            {content.description}
          </div>
          {content.hint ? (
            <div className="mt-2 text-xs text-gray-600 dark:text-slate-400">{content.hint}</div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">{content.actions}</div>
        </div>

        {isDismissible ? (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t('workspace.onboarding.dismiss_banner_aria')}
            className="flex-shrink-0 w-7 h-7 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-colors flex items-center justify-center"
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
