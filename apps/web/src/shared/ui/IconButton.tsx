import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import type { ButtonSize, ButtonVariant } from './Button';
import { filledBgClass, outlinedToneClass, textColorClass } from './colors';
import { cx } from './cx';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  color?: string;
  ripple?: boolean;
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    children,
    variant = 'filled',
    size = 'md',
    color,
    className,
    disabled,
    type = 'button',
    ripple: _ripple,
    ...rest
  },
  ref,
) {
  const tone =
    variant === 'outlined'
      ? cx('border bg-transparent', outlinedToneClass(color))
      : variant === 'text'
        ? cx('bg-transparent', textColorClass(color) ?? 'text-gray-700')
        : filledBgClass(color);

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center align-middle select-none rounded-lg transition-all',
        'disabled:opacity-50 disabled:pointer-events-none',
        SIZE_CLASS[size],
        tone,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
