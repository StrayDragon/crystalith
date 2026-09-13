import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { filledBgClass, outlinedToneClass, textColorClass } from './colors';
import { cx } from './cx';

export type ButtonVariant = 'filled' | 'outlined' | 'gradient' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  color?: string;
  fullWidth?: boolean;
  ripple?: boolean;
  loading?: boolean;
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'text-xs py-2 px-4',
  md: 'text-xs py-3 px-6',
  lg: 'text-sm py-3.5 px-7',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = 'filled',
    size = 'md',
    color,
    fullWidth,
    className,
    disabled,
    type = 'button',
    ripple: _ripple,
    loading: _loading,
    ...rest
  },
  ref,
) {
  const tone =
    variant === 'outlined'
      ? cx('border bg-transparent', outlinedToneClass(color))
      : variant === 'text'
        ? cx('bg-transparent', textColorClass(color) ?? 'text-blue-500')
        : filledBgClass(color);

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center align-middle select-none font-sans font-bold text-center uppercase transition-all rounded-lg',
        'disabled:opacity-50 disabled:pointer-events-none',
        SIZE_CLASS[size],
        fullWidth && 'w-full',
        tone,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
