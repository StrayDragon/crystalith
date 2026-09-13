import type { HTMLAttributes, ReactNode } from 'react';

import { chipToneClass } from './colors';
import { cx } from './cx';

export interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  children?: ReactNode;
  value?: ReactNode;
  variant?: 'filled' | 'gradient' | 'outlined' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  icon?: ReactNode;
  open?: boolean;
  onClose?: () => void;
}

const SIZE_CLASS = {
  sm: 'h-6 px-2 text-[11px]',
  md: 'h-7 px-2.5 text-xs',
  lg: 'h-8 px-3 text-sm',
} as const;

export function Chip({
  children,
  value,
  variant = 'filled',
  size = 'md',
  color,
  icon,
  className,
  open = true,
  onClose,
  ...rest
}: ChipProps) {
  if (open === false) return null;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
        SIZE_CLASS[size],
        chipToneClass(variant, color),
        className,
      )}
      {...rest}
    >
      {icon}
      {children ?? value}
      {onClose ? (
        <button type="button" className="ml-0.5 inline-flex" aria-label="关闭" onClick={onClose}>
          ×
        </button>
      ) : null}
    </span>
  );
}
