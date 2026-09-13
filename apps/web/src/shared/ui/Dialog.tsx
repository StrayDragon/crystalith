import { useRef, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useLayer } from '../layer';
import { cx } from './cx';
import { useFocusTrap } from './useFocusTrap';

export interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  open: boolean;
  handler?: (open: boolean) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  dismiss?: object;
}

const SIZE_CLASS: Record<NonNullable<DialogProps['size']>, string> = {
  xs: 'max-w-sm',
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  xxl: 'max-w-[90vw]',
};

export function Dialog({
  children,
  open,
  handler,
  size = 'md',
  className,
  dismiss: _dismiss,
  ...rest
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { style } = useLayer('modal');

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: () => handler?.(false),
  });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={style}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="关闭对话框"
        onClick={() => handler?.(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[90vh] w-full flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-900',
          SIZE_CLASS[size],
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogHeader({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('flex-shrink-0', className)} {...rest}>
      {children}
    </div>
  );
}

export function DialogBody({
  children,
  className,
  divider: _divider,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { divider?: boolean }) {
  return (
    <div className={cx('min-h-0 flex-1 overflow-auto', className)} {...rest}>
      {children}
    </div>
  );
}

export function DialogFooter({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('flex-shrink-0', className)} {...rest}>
      {children}
    </div>
  );
}
