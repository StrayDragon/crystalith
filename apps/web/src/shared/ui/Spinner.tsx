import { forwardRef, type SVGAttributes } from 'react';

import { textColorClass } from './colors';
import { cx } from './cx';

export interface SpinnerProps extends SVGAttributes<SVGSVGElement> {
  color?: string;
}

export const Spinner = forwardRef<SVGSVGElement, SpinnerProps>(function Spinner(
  { className, color, ...rest },
  ref,
) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cx('h-5 w-5 animate-spin', textColorClass(color) ?? 'text-blue-500', className)}
      {...rest}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
});
