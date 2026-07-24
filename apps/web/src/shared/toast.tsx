import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import { create } from 'zustand';

import { useLayer } from './layer';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

/** Optional weak link / button on a toast (c91 / r446). */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  duration?: number;
  action?: ToastAction;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, durationOrOptions?: number | ToastOptions) => void;
  removeToast: (id: string) => void;
}

const DEFAULT_TOAST_DURATION: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  info: 4000,
  warning: 4000,
};

function resolveToastOptions(durationOrOptions?: number | ToastOptions): {
  duration?: number;
  action?: ToastAction;
} {
  if (durationOrOptions === undefined) return {};
  if (typeof durationOrOptions === 'number') return { duration: durationOrOptions };
  return {
    duration: durationOrOptions.duration,
    action: durationOrOptions.action,
  };
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (
    message: string,
    type: ToastType = 'info',
    durationOrOptions?: number | ToastOptions,
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const { duration, action } = resolveToastOptions(durationOrOptions);
    const resolvedDuration = duration ?? DEFAULT_TOAST_DURATION[type];
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration: resolvedDuration, action }],
    }));

    if (resolvedDuration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, resolvedDuration);
    }
  },
  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

function pushToast(type: ToastType, message: string, durationOrOptions?: number | ToastOptions) {
  useToastStore.getState().addToast(message, type, durationOrOptions);
}

export const toast = {
  success: (message: string, durationOrOptions?: number | ToastOptions) => {
    pushToast('success', message, durationOrOptions);
  },
  error: (message: string, durationOrOptions?: number | ToastOptions) => {
    pushToast('error', message, durationOrOptions);
  },
  info: (message: string, durationOrOptions?: number | ToastOptions) => {
    pushToast('info', message, durationOrOptions);
  },
  warning: (message: string, durationOrOptions?: number | ToastOptions) => {
    pushToast('warning', message, durationOrOptions);
  },
};

const iconMap = {
  success: CheckCircleIcon,
  error: ErrorIcon,
  info: InfoIcon,
  warning: WarningIcon,
};

const colorMap = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
};

function ToastItem({ toast: toastItem, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = iconMap[toastItem.type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white ${colorMap[toastItem.type]} ux-slide-in`}
      role="alert"
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{toastItem.message}</span>
        {toastItem.action ? (
          <button
            type="button"
            className="mt-1 block text-left text-sm font-medium underline underline-offset-2 decoration-white/70 hover:decoration-white"
            data-testid="toast-action"
            onClick={() => {
              toastItem.action?.onClick();
              onClose();
            }}
          >
            {toastItem.action.label}
          </button>
        ) : null}
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded-full hover:bg-white/20 dark:hover:bg-slate-700/40 transition-colors"
        aria-label="关闭"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  const { style } = useLayer('toast');

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 flex flex-col gap-2 max-w-sm" style={style}>
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          toast={t}
          onClose={() => {
            removeToast(t.id);
          }}
        />
      ))}
    </div>
  );
}
