import {
  Popover as RadixPopover,
  PopoverAnchor as RadixPopoverAnchor,
  PopoverContent as RadixPopoverContent,
  PopoverTrigger,
} from '@radix-ui/react-popover';
import { createContext, forwardRef, useContext, type HTMLAttributes, type ReactNode } from 'react';

import { useLayer } from '../layer';
import { cx } from './cx';
import { parsePlacement, type OverlayAlign, type OverlaySide } from './placement';
import { useRadixTriggerClickFallback } from './radixTrigger';

type PopoverPlacementValue = {
  side: OverlaySide;
  align: OverlayAlign;
  sideOffset: number;
};

const PopoverPlacementContext = createContext<PopoverPlacementValue>({
  side: 'bottom',
  align: 'center',
  sideOffset: 4,
});

export interface PopoverProps {
  children?: ReactNode;
  open?: boolean;
  handler?: (open: boolean) => void;
  placement?: string;
  offset?: number | object;
  dismiss?: object;
  animate?: object;
}

export function Popover({ children, open, handler, placement, offset }: PopoverProps) {
  const { side, align } = parsePlacement(placement);
  const sideOffset = typeof offset === 'number' ? offset : 4;
  return (
    <RadixPopover open={open} onOpenChange={handler}>
      <PopoverPlacementContext.Provider value={{ side, align, sideOffset }}>
        {children}
      </PopoverPlacementContext.Provider>
    </RadixPopover>
  );
}

export function PopoverHandler({ children }: { children: ReactNode }) {
  const triggerFallback = useRadixTriggerClickFallback();
  return (
    <PopoverTrigger asChild {...triggerFallback}>
      {children}
    </PopoverTrigger>
  );
}

/** Positioning anchor without toggling open state (controlled onboarding / coach marks). */
export function PopoverAnchor({ children }: { children?: ReactNode }) {
  if (!children) {
    return <RadixPopoverAnchor />;
  }
  return <RadixPopoverAnchor asChild>{children}</RadixPopoverAnchor>;
}

export interface PopoverContentProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  onOpenAutoFocus?: (event: Event) => void;
  onPointerDownOutside?: (event: Event) => void;
  onFocusOutside?: (event: Event) => void;
  onInteractOutside?: (event: Event) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent({ children, className, style, ...rest }, ref) {
    const { style: layerStyle } = useLayer('popover');
    const { side, align, sideOffset } = useContext(PopoverPlacementContext);
    return (
      <RadixPopoverContent
        ref={ref}
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cx(
          'rounded-xl border border-gray-200 bg-white shadow-lg outline-none dark:border-slate-700 dark:bg-slate-900',
          className,
        )}
        style={{ ...layerStyle, ...style }}
        {...rest}
      >
        {children}
      </RadixPopoverContent>
    );
  },
);
