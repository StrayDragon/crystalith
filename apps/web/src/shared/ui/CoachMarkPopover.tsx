import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { cx } from './cx';
import { Popover, PopoverAnchor, PopoverContent } from './Popover';

type CoachMarkContextValue = {
  autoDismissSeconds: number | null;
  countdownActionId: string | null;
};

const CoachMarkContext = createContext<CoachMarkContextValue>({
  autoDismissSeconds: null,
  countdownActionId: null,
});

function useAutoDismissCountdown(open: boolean, autoDismissMs?: number): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!open || autoDismissMs === undefined || autoDismissMs <= 0) {
      setSecondsLeft(null);
      return;
    }

    const deadline = Date.now() + autoDismissMs;
    setSecondsLeft(Math.ceil(autoDismissMs / 1000));

    const interval = window.setInterval(() => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        setSecondsLeft(0);
        window.clearInterval(interval);
        return;
      }
      setSecondsLeft(Math.ceil(remaining / 1000));
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoDismissMs, open]);

  return secondsLeft;
}

export interface CoachMarkPopoverProps {
  open: boolean;
  onDismiss: () => void;
  /** Auto-dismiss after N ms. Omit or ≤0 to keep open until manual dismiss. */
  autoDismissMs?: number;
  /** Invoked when the auto-dismiss timer fires, before `onDismiss`. */
  onAutoDismiss?: () => void;
  /** Show a live countdown via `CoachMarkCountdown` (requires `autoDismissMs`). */
  showAutoDismissCountdown?: boolean;
  /** `CoachMarkCountdown` only renders on the action with this id. */
  countdownActionId?: string;
  /** Close when clicking outside the content. Default: true. */
  dismissOnInteractOutside?: boolean;
  /** Close on Escape. Defaults to `dismissOnInteractOutside`. */
  dismissOnEscape?: boolean;
  placement?: string;
  offset?: number;
  anchor: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  /** Prevent focus steal when the coach mark opens (default: true). */
  preventOpenAutoFocus?: boolean;
}

export function CoachMarkPopover({
  open,
  onDismiss,
  autoDismissMs,
  onAutoDismiss,
  showAutoDismissCountdown = false,
  countdownActionId,
  dismissOnInteractOutside = true,
  dismissOnEscape,
  placement = 'bottom-start',
  offset = 8,
  anchor,
  children,
  contentClassName,
  preventOpenAutoFocus = true,
}: CoachMarkPopoverProps) {
  const resolvedDismissOnEscape = dismissOnEscape ?? dismissOnInteractOutside;
  const autoDismissSeconds = useAutoDismissCountdown(open, autoDismissMs);
  const contextValue = useMemo(
    () => ({
      autoDismissSeconds:
        showAutoDismissCountdown && autoDismissMs !== undefined && autoDismissMs > 0
          ? autoDismissSeconds
          : null,
      countdownActionId: showAutoDismissCountdown && countdownActionId ? countdownActionId : null,
    }),
    [autoDismissMs, autoDismissSeconds, countdownActionId, showAutoDismissCountdown],
  );

  useEffect(() => {
    if (!open || autoDismissMs === undefined || autoDismissMs <= 0) return;

    const timer = window.setTimeout(() => {
      onAutoDismiss?.();
      onDismiss();
    }, autoDismissMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoDismissMs, onAutoDismiss, onDismiss, open]);

  const blockOutsideDismiss = (event: Event) => {
    event.preventDefault();
  };

  return (
    <CoachMarkContext.Provider value={contextValue}>
      <Popover
        open={open}
        handler={
          dismissOnInteractOutside
            ? (nextOpen) => {
                if (!nextOpen) onDismiss();
              }
            : undefined
        }
        placement={placement}
        offset={offset}
      >
        <PopoverAnchor>{anchor}</PopoverAnchor>
        {open ? (
          <PopoverContent
            className={contentClassName}
            onOpenAutoFocus={
              preventOpenAutoFocus
                ? (event) => {
                    event.preventDefault();
                  }
                : undefined
            }
            onPointerDownOutside={dismissOnInteractOutside ? undefined : blockOutsideDismiss}
            onFocusOutside={dismissOnInteractOutside ? undefined : blockOutsideDismiss}
            onInteractOutside={dismissOnInteractOutside ? undefined : blockOutsideDismiss}
            onEscapeKeyDown={
              resolvedDismissOnEscape
                ? undefined
                : (event) => {
                    event.preventDefault();
                  }
            }
          >
            {children}
          </PopoverContent>
        ) : null}
      </Popover>
    </CoachMarkContext.Provider>
  );
}

export function useCoachMarkCountdown(): number | null {
  return useContext(CoachMarkContext).autoDismissSeconds;
}

export function CoachMarkCountdown({
  actionId,
  className,
}: {
  actionId: string;
  className?: string;
}) {
  const seconds = useCoachMarkCountdown();
  const { countdownActionId } = useContext(CoachMarkContext);
  if (seconds === null || countdownActionId !== actionId) return null;
  return (
    <span className={cx('tabular-nums', className)} aria-hidden="true">
      {seconds}s
    </span>
  );
}
