import {
  createContext,
  useContext,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { cx } from './cx';

type TabsValue = string | number;

const TabsContext = createContext<{ value?: TabsValue }>({});

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  value?: TabsValue;
  orientation?: 'horizontal' | 'vertical';
  children?: ReactNode;
}

export function Tabs({
  value,
  className,
  children,
  orientation: _orientation,
  ...rest
}: TabsProps) {
  return (
    <TabsContext.Provider value={{ value }}>
      <div className={className} {...rest}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsHeader({
  children,
  className,
  indicatorProps: _indicatorProps,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { indicatorProps?: { className?: string } }) {
  return (
    <div className={cx('flex', className)} {...rest}>
      {children}
    </div>
  );
}

export function TabsBody({
  children,
  className,
  animate: _animate,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { animate?: Record<string, unknown> }) {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

export interface TabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: TabsValue;
  activeClassName?: string;
  children?: ReactNode;
}

export function Tab({ value: _value, className, children, type = 'button', ...rest }: TabProps) {
  return (
    <button type={type} className={className} {...rest}>
      {children}
    </button>
  );
}

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  value: TabsValue;
  children?: ReactNode;
}

export function TabPanel({ value, className, children, ...rest }: TabPanelProps) {
  const active = useContext(TabsContext).value;
  if (active !== value) return null;
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}
