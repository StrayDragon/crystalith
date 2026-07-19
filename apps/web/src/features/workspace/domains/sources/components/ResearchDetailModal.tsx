import { Suspense, lazy } from 'react';
import type { Ref, RefObject } from 'react';

import { LAYER_LEVELS } from '../../../../../shared/layer';
import { TestIds, tid } from '../../../../../shared/testids';
import { SkeletonCard } from '../../../shared/components/Skeleton';
import type { Research } from './sources-panel-types';

const ResearchDetailPanel = lazy(() => import('../../research/ResearchDetailPanel'));

export interface ResearchDetailModalProps {
  open: boolean;
  research: Research;
  researchModalRef: RefObject<HTMLDivElement | null>;
  researchFullscreen: boolean;
  onClose: () => void;
  onApprove: () => Promise<void>;
  onSkip: () => Promise<void>;
  onFinish: () => Promise<void>;
  onCancel: () => Promise<void>;
  onResume: () => Promise<void>;
  onRetry: () => Promise<void>;
  onStart: (sessionId: number) => Promise<void>;
  onToggleFullscreen: () => void;
  onAddSourceFromUrl: (url: string) => Promise<void>;
}

export default function ResearchDetailModal({
  open,
  research,
  researchModalRef,
  researchFullscreen,
  onClose,
  onApprove,
  onSkip,
  onFinish,
  onCancel,
  onResume,
  onRetry,
  onStart,
  onToggleFullscreen,
  onAddSourceFromUrl,
}: ResearchDetailModalProps) {
  if (!open || !research.activeSession) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: LAYER_LEVELS.modal }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      {...tid(TestIds.researchDetailDialog)}
    >
      <div
        ref={researchModalRef as Ref<HTMLDivElement>}
        tabIndex={-1}
        className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden ux-modal-in transition-all ${
          researchFullscreen ? 'w-full max-w-5xl' : 'w-full max-w-lg'
        }`}
      >
        <Suspense
          fallback={
            <div className="p-4">
              <SkeletonCard lines={6} />
            </div>
          }
        >
          <ResearchDetailPanel
            session={research.activeSession}
            sseEvents={research.sseEvents}
            onClose={onClose}
            onApprove={onApprove}
            onSkip={onSkip}
            onFinish={onFinish}
            onCancel={onCancel}
            onResume={onResume}
            onRetry={onRetry}
            onStart={() => onStart(research.activeSession!.id)}
            isFullscreen={researchFullscreen}
            onToggleFullscreen={onToggleFullscreen}
            onAddSourceFromUrl={onAddSourceFromUrl}
          />
        </Suspense>
      </div>
    </div>
  );
}
