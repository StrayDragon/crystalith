import { forwardRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react';

import { textColorClass } from './colors';
import { cx } from './cx';

export type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'lead'
  | 'paragraph'
  | 'small';

export interface TypographyProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  variant?: TypographyVariant;
  color?: string;
  as?: ElementType;
  textGradient?: boolean;
}

const VARIANT_TAG: Record<TypographyVariant, ElementType> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  lead: 'p',
  paragraph: 'p',
  small: 'p',
};

const VARIANT_CLASS: Record<TypographyVariant, string> = {
  h1: 'text-4xl font-semibold',
  h2: 'text-3xl font-semibold',
  h3: 'text-2xl font-semibold',
  h4: 'text-xl font-semibold',
  h5: 'text-lg font-semibold',
  h6: 'text-base font-semibold',
  lead: 'text-lg font-normal',
  paragraph: 'text-base font-normal',
  small: 'text-sm font-normal',
};

export const Typography = forwardRef<HTMLElement, TypographyProps>(function Typography(
  { children, variant = 'paragraph', color, as, className, textGradient: _textGradient, ...rest },
  ref,
) {
  const Tag = as ?? VARIANT_TAG[variant];
  return (
    <Tag
      ref={ref}
      className={cx(VARIANT_CLASS[variant], textColorClass(color), className)}
      {...rest}
    >
      {children}
    </Tag>
  );
});
