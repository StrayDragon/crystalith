import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';

import { cx } from './cx';
import { Menu, MenuHandler, MenuItem, MenuList } from './Menu';

export interface OptionProps {
  children?: ReactNode;
  value: string;
  disabled?: boolean;
  className?: string;
}

export function Option(_props: OptionProps) {
  return null;
}

export interface SelectProps {
  children?: ReactNode;
  value?: string;
  onChange?: (value?: string) => void;
  label?: string;
  disabled?: boolean;
  size?: 'md' | 'lg';
  className?: string;
  error?: boolean;
  success?: boolean;
  variant?: 'standard' | 'outlined' | 'static';
  name?: string;
  containerProps?: { className?: string };
}

export function Select({
  children,
  value = '',
  onChange,
  label,
  disabled,
  size = 'md',
  className,
  error,
  containerProps,
}: SelectProps) {
  const options = Children.toArray(children).filter((child): child is ReactElement<OptionProps> =>
    isValidElement(child),
  );
  const selected = options.find((option) => option.props.value === value);

  return (
    <div className={cx('w-full', containerProps?.className, className)}>
      {label ? (
        <div className="mb-1 text-xs font-medium text-gray-600 dark:text-slate-300">{label}</div>
      ) : null}
      <Menu>
        <MenuHandler>
          <button
            type="button"
            disabled={disabled}
            className={cx(
              'flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-left text-sm',
              'dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100',
              size === 'lg' ? 'h-11' : 'h-10',
              error && 'border-red-500',
              disabled && 'opacity-50',
            )}
          >
            <span className="min-w-0 flex-1 truncate">{selected?.props.children ?? '选择…'}</span>
            <span className="ml-2 text-gray-400">▾</span>
          </button>
        </MenuHandler>
        <MenuList className="max-h-72 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-auto">
          {options.map((option) => (
            <MenuItem
              key={option.props.value}
              disabled={option.props.disabled}
              className={option.props.className}
              onClick={() => onChange?.(option.props.value)}
            >
              {option.props.children}
            </MenuItem>
          ))}
        </MenuList>
      </Menu>
    </div>
  );
}
