import {
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';

import { chipToneClass } from './colors';
import { cx } from './cx';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: 'standard' | 'outlined' | 'static';
  size?: 'md' | 'lg';
  label?: string;
  error?: boolean;
  success?: boolean;
  icon?: ReactNode;
  labelProps?: { className?: string };
  containerProps?: { className?: string };
  shrink?: boolean;
  crossOrigin?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    label,
    labelProps,
    containerProps,
    size = 'md',
    variant: _variant,
    error,
    success: _success,
    icon,
    shrink: _shrink,
    crossOrigin: _crossOrigin,
    ...rest
  },
  ref,
) {
  const hideLabel = labelProps?.className?.includes('hidden');
  return (
    <label className={cx('flex w-full flex-col gap-1', containerProps?.className)}>
      {label && !hideLabel ? (
        <span
          className={cx(
            'text-xs font-medium text-gray-600 dark:text-slate-300',
            labelProps?.className,
          )}
        >
          {label}
        </span>
      ) : null}
      <span className="relative block">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            {icon}
          </span>
        ) : null}
        <input
          ref={ref}
          className={cx(
            'w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none',
            'focus:border-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100',
            size === 'lg' ? 'h-11' : 'h-9',
            icon ? 'pl-9' : undefined,
            error && 'border-red-500',
            className,
          )}
          {...rest}
        />
      </span>
    </label>
  );
});

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  variant?: 'standard' | 'outlined' | 'static';
  size?: 'md' | 'lg';
  label?: string;
  error?: boolean;
  success?: boolean;
  resize?: boolean;
  labelProps?: { className?: string };
  containerProps?: { className?: string };
  shrink?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    className,
    label,
    labelProps,
    containerProps,
    error,
    resize = true,
    variant: _variant,
    success: _success,
    shrink: _shrink,
    ...rest
  },
  ref,
) {
  const hideLabel = labelProps?.className?.includes('hidden');
  return (
    <label className={cx('flex w-full flex-col gap-1', containerProps?.className)}>
      {label && !hideLabel ? (
        <span
          className={cx(
            'text-xs font-medium text-gray-600 dark:text-slate-300',
            labelProps?.className,
          )}
        >
          {label}
        </span>
      ) : null}
      <textarea
        ref={ref}
        className={cx(
          'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none',
          'focus:border-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100',
          resize ? 'resize-y' : 'resize-none',
          error && 'border-red-500',
          className,
        )}
        {...rest}
      />
    </label>
  );
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  color?: string;
  label?: ReactNode;
  icon?: ReactNode;
  ripple?: boolean;
  containerProps?: { className?: string };
  labelProps?: { className?: string };
  iconProps?: object;
  crossOrigin?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    className,
    label,
    containerProps,
    labelProps,
    color: _color,
    icon: _icon,
    ripple: _ripple,
    iconProps: _iconProps,
    crossOrigin: _crossOrigin,
    ...rest
  },
  ref,
) {
  return (
    <label className={cx('inline-flex items-center gap-2', containerProps?.className)}>
      <input
        ref={ref}
        type="checkbox"
        className={cx('h-4 w-4 rounded border-gray-300 accent-blue-600', className)}
        {...rest}
      />
      {label ? <span className={cx('text-sm', labelProps?.className)}>{label}</span> : null}
    </label>
  );
});

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  label?: ReactNode;
}

export function Progress({ value = 0, size = 'md', className, label, ...rest }: ProgressProps) {
  const height = size === 'lg' ? 'h-3' : size === 'sm' ? 'h-1.5' : 'h-2';
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cx('w-full', className)} {...rest}>
      {label}
      <div
        className={cx('w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700', height)}
      >
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'filled' | 'gradient' | 'outlined' | 'ghost';
  color?: string;
  icon?: ReactNode;
  open?: boolean;
  onClose?: () => void;
  action?: ReactNode;
}

export function Alert({
  children,
  variant = 'ghost',
  color,
  icon,
  className,
  open = true,
  onClose,
  action,
  ...rest
}: AlertProps) {
  if (open === false) return null;
  return (
    <div
      role="alert"
      className={cx(
        'flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
        chipToneClass(variant, color),
        className,
      )}
      {...rest}
    >
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
      {action}
      {onClose ? (
        <button type="button" aria-label="关闭" onClick={onClose}>
          ×
        </button>
      ) : null}
    </div>
  );
}
