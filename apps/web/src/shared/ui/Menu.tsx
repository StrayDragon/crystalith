import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';

import { useLayer } from '../layer';
import { cx } from './cx';
import { parsePlacement, type OverlayAlign, type OverlaySide } from './placement';
import { useRadixTriggerClickFallback } from './radixTrigger';

type MenuDismiss = {
  itemPress?: boolean;
  outsidePress?: boolean;
  escapeKey?: boolean;
};

type MenuContextValue = {
  side: OverlaySide;
  align: OverlayAlign;
  sideOffset: number;
  closeOnItemPress: boolean;
};

const MenuPlacementContext = createContext<MenuContextValue>({
  side: 'bottom',
  align: 'center',
  sideOffset: 6,
  closeOnItemPress: true,
});

export interface MenuProps {
  children?: ReactNode;
  open?: boolean;
  handler?: (open: boolean) => void;
  placement?: string;
  offset?: number | object;
  dismiss?: MenuDismiss;
  animate?: object;
  lockScroll?: boolean;
  allowHover?: boolean;
}

export function Menu({ children, open, handler, placement, offset, dismiss }: MenuProps) {
  const { side, align } = parsePlacement(placement);
  const sideOffset = typeof offset === 'number' ? offset : 6;
  const closeOnItemPress = dismiss?.itemPress !== false;
  return (
    <DropdownMenu open={open} onOpenChange={handler} modal>
      <MenuPlacementContext.Provider value={{ side, align, sideOffset, closeOnItemPress }}>
        {children}
      </MenuPlacementContext.Provider>
    </DropdownMenu>
  );
}

export function MenuHandler({ children }: { children: ReactNode }) {
  const triggerFallback = useRadixTriggerClickFallback();
  return (
    <DropdownMenuTrigger asChild {...triggerFallback}>
      {children}
    </DropdownMenuTrigger>
  );
}

export interface MenuListProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export const MenuList = forwardRef<HTMLDivElement, MenuListProps>(function MenuList(
  { children, className, style, ...rest },
  ref,
) {
  const { style: layerStyle } = useLayer('dropdown');
  const { side, align, sideOffset } = useContext(MenuPlacementContext);
  return (
    <DropdownMenuPortal>
      <DropdownMenuContent
        ref={ref}
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cx(
          'min-w-[8rem] overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900',
          className,
        )}
        style={{ ...layerStyle, ...style }}
        {...rest}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenuPortal>
  );
});

export interface MenuItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  children?: ReactNode;
  disabled?: boolean;
}

export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(function MenuItem(
  { children, className, disabled, onClick, ...rest },
  ref,
) {
  const { closeOnItemPress } = useContext(MenuPlacementContext);
  return (
    <DropdownMenuItem
      ref={ref}
      disabled={disabled}
      className={cx(
        'flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-xs outline-none',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        'data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-slate-800',
        className,
      )}
      onSelect={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event as unknown as MouseEvent<HTMLDivElement>);
        if (!closeOnItemPress) {
          event.preventDefault();
        }
      }}
      {...rest}
    >
      {children}
    </DropdownMenuItem>
  );
});
