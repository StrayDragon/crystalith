import { Tooltip as RadixTooltip, TooltipContent, TooltipTrigger } from '@radix-ui/react-tooltip';
import {
  cloneElement,
  forwardRef,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';

import { useLayer } from '../layer';
import { cx } from './cx';
import { parsePlacement } from './placement';

export { TooltipProvider } from '@radix-ui/react-tooltip';

export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  placement?: string;
  className?: string;
  style?: CSSProperties;
  offset?: number | object;
  interactive?: boolean;
  animate?: unknown;
  open?: boolean;
  handler?: (open: boolean) => void;
}

export const Tooltip = forwardRef<HTMLElement, TooltipProps>(function Tooltip(
  { children, content, placement, className, style, offset, open, handler, animate: _animate },
  ref,
) {
  const { style: layerStyle } = useLayer('tooltip');
  const { side, align } = parsePlacement(placement);
  const sideOffset = typeof offset === 'number' ? offset : 6;
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ ref?: typeof ref }>, { ref })
    : children;

  return (
    <RadixTooltip open={open} onOpenChange={handler} delayDuration={200}>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cx(
          'rounded-md bg-gray-900 px-2 py-1 text-[11px] text-white shadow-md dark:bg-slate-700',
          className,
        )}
        style={{ ...layerStyle, ...style }}
      >
        {content}
      </TooltipContent>
    </RadixTooltip>
  );
});
