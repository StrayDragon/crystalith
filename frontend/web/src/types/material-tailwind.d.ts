/**
 * Material Tailwind React 19 类型兼容性修复
 *
 * Material Tailwind 2.x 的类型定义与 React 19 不完全兼容
 * 这个文件覆盖了必要的类型声明来消除 TypeScript 错误
 */

import type { ComponentProps, ReactNode } from "react";

declare module "@material-tailwind/react" {
  // Typography
  export interface TypographyProps {
    children?: ReactNode;
    variant?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "lead" | "paragraph" | "small";
    color?: string;
    className?: string;
    as?: React.ElementType;
    textGradient?: boolean;
    [key: string]: unknown;
  }
  export const Typography: React.FC<TypographyProps>;

  // Button
  export interface ButtonProps extends Omit<ComponentProps<"button">, "ref"> {
    children?: ReactNode;
    variant?: "filled" | "outlined" | "gradient" | "text";
    size?: "sm" | "md" | "lg";
    color?: string;
    fullWidth?: boolean;
    ripple?: boolean;
    className?: string;
    disabled?: boolean;
    loading?: boolean;
    [key: string]: unknown;
  }
  export const Button: React.FC<ButtonProps>;

  // IconButton
  export interface IconButtonProps extends Omit<ComponentProps<"button">, "ref"> {
    children?: ReactNode;
    variant?: "filled" | "outlined" | "gradient" | "text";
    size?: "sm" | "md" | "lg";
    color?: string;
    ripple?: boolean;
    className?: string;
    disabled?: boolean;
    [key: string]: unknown;
  }
  export const IconButton: React.FC<IconButtonProps>;

  // Input
  export interface InputProps extends Omit<ComponentProps<"input">, "ref" | "size"> {
    variant?: "standard" | "outlined" | "static";
    size?: "md" | "lg";
    color?: string;
    label?: string;
    error?: boolean;
    success?: boolean;
    icon?: ReactNode;
    labelProps?: object;
    containerProps?: object;
    className?: string;
    shrink?: boolean;
    crossOrigin?: string;
    [key: string]: unknown;
  }
  export const Input: React.FC<InputProps>;

  // Checkbox
  export interface CheckboxProps extends Omit<ComponentProps<"input">, "ref"> {
    color?: string;
    label?: ReactNode;
    icon?: ReactNode;
    ripple?: boolean;
    className?: string;
    disabled?: boolean;
    containerProps?: object;
    labelProps?: object;
    iconProps?: object;
    crossOrigin?: string;
    [key: string]: unknown;
  }
  export const Checkbox: React.FC<CheckboxProps>;

  // Spinner
  export interface SpinnerProps {
    color?: string;
    className?: string;
    [key: string]: unknown;
  }
  export const Spinner: React.FC<SpinnerProps>;

  // Card
  export interface CardProps extends Omit<ComponentProps<"div">, "ref"> {
    children?: ReactNode;
    variant?: "filled" | "gradient";
    color?: string;
    shadow?: boolean;
    className?: string;
    [key: string]: unknown;
  }
  export const Card: React.FC<CardProps>;

  export interface CardBodyProps extends Omit<ComponentProps<"div">, "ref"> {
    children?: ReactNode;
    className?: string;
    [key: string]: unknown;
  }
  export const CardBody: React.FC<CardBodyProps>;

  // Chip
  export interface ChipProps {
    children?: ReactNode;
    variant?: "filled" | "gradient" | "outlined" | "ghost";
    size?: "sm" | "md" | "lg";
    color?: string;
    icon?: ReactNode;
    open?: boolean;
    onClose?: () => void;
    action?: ReactNode;
    animate?: object;
    className?: string;
    value?: string;
    dismissible?: object;
    [key: string]: unknown;
  }
  export const Chip: React.FC<ChipProps>;

  // Dialog
  export interface DialogProps {
    children?: ReactNode;
    open: boolean;
    handler?: (value: boolean) => void;
    size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
    dismiss?: object;
    animate?: object;
    className?: string;
    [key: string]: unknown;
  }
  export const Dialog: React.FC<DialogProps>;

  export interface DialogHeaderProps extends Omit<ComponentProps<"div">, "ref"> {
    children?: ReactNode;
    className?: string;
    [key: string]: unknown;
  }
  export const DialogHeader: React.FC<DialogHeaderProps>;

  export interface DialogBodyProps extends Omit<ComponentProps<"div">, "ref"> {
    children?: ReactNode;
    className?: string;
    divider?: boolean;
    [key: string]: unknown;
  }
  export const DialogBody: React.FC<DialogBodyProps>;

  export interface DialogFooterProps extends Omit<ComponentProps<"div">, "ref"> {
    children?: ReactNode;
    className?: string;
    [key: string]: unknown;
  }
  export const DialogFooter: React.FC<DialogFooterProps>;

  // Popover
  export interface PopoverProps {
    children?: ReactNode;
    open?: boolean;
    handler?: (value: boolean) => void;
    placement?: string;
    offset?: number | object;
    dismiss?: object;
    animate?: object;
    [key: string]: unknown;
  }
  export const Popover: React.FC<PopoverProps>;

  export interface PopoverHandlerProps {
    children: ReactNode;
    [key: string]: unknown;
  }
  export const PopoverHandler: React.FC<PopoverHandlerProps>;

  export interface PopoverContentProps extends Omit<ComponentProps<"div">, "ref"> {
    children?: ReactNode;
    className?: string;
    [key: string]: unknown;
  }
  export const PopoverContent: React.FC<PopoverContentProps>;

  // Menu
  export interface MenuProps {
    children?: ReactNode;
    open?: boolean;
    handler?: (value: boolean) => void;
    placement?: string;
    offset?: number | object;
    dismiss?: object;
    animate?: object;
    lockScroll?: boolean;
    allowHover?: boolean;
    [key: string]: unknown;
  }
  export const Menu: React.FC<MenuProps>;

  export interface MenuHandlerProps {
    children: ReactNode;
    [key: string]: unknown;
  }
  export const MenuHandler: React.FC<MenuHandlerProps>;

  export interface MenuListProps extends Omit<ComponentProps<"ul">, "ref"> {
    children?: ReactNode;
    className?: string;
    [key: string]: unknown;
  }
  export const MenuList: React.FC<MenuListProps>;

  export interface MenuItemProps extends Omit<ComponentProps<"li">, "ref"> {
    children?: ReactNode;
    disabled?: boolean;
    className?: string;
    [key: string]: unknown;
  }
  export const MenuItem: React.FC<MenuItemProps>;

  // Select
  export interface SelectProps {
    children?: ReactNode;
    variant?: "standard" | "outlined" | "static";
    size?: "md" | "lg";
    color?: string;
    label?: string;
    error?: boolean;
    success?: boolean;
    arrow?: ReactNode;
    value?: string;
    onChange?: (value: string) => void;
    selected?: (element: ReactNode, index: number) => ReactNode;
    offset?: number | object;
    dismiss?: object;
    animate?: object;
    lockScroll?: boolean;
    labelProps?: object;
    menuProps?: object;
    className?: string;
    disabled?: boolean;
    name?: string;
    containerProps?: object;
    [key: string]: unknown;
  }
  export const Select: React.FC<SelectProps>;

  export interface OptionProps extends Omit<ComponentProps<"li">, "ref"> {
    children?: ReactNode;
    value: string;
    index?: number;
    disabled?: boolean;
    className?: string;
    [key: string]: unknown;
  }
  export const Option: React.FC<OptionProps>;

  // Alert
  export interface AlertProps {
    children?: ReactNode;
    variant?: "filled" | "gradient" | "outlined" | "ghost";
    color?: string;
    icon?: ReactNode;
    open?: boolean;
    onClose?: () => void;
    action?: ReactNode;
    animate?: object;
    className?: string;
    [key: string]: unknown;
  }
  export const Alert: React.FC<AlertProps>;

  // Avatar
  export interface AvatarProps extends Omit<ComponentProps<"img">, "ref"> {
    variant?: "circular" | "rounded" | "square";
    size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
    className?: string;
    withBorder?: boolean;
    color?: string;
    [key: string]: unknown;
  }
  export const Avatar: React.FC<AvatarProps>;

  // List
  export interface ListProps extends Omit<ComponentProps<"ul">, "ref"> {
    children?: ReactNode;
    className?: string;
    [key: string]: unknown;
  }
  export const List: React.FC<ListProps>;

  export interface ListItemProps extends Omit<ComponentProps<"li">, "ref"> {
    children?: ReactNode;
    className?: string;
    selected?: boolean;
    disabled?: boolean;
    ripple?: boolean;
    [key: string]: unknown;
  }
  export const ListItem: React.FC<ListItemProps>;

  export interface ListItemPrefixProps extends Omit<ComponentProps<"div">, "ref"> {
    children?: ReactNode;
    className?: string;
    [key: string]: unknown;
  }
  export const ListItemPrefix: React.FC<ListItemPrefixProps>;

  export interface ListItemSuffixProps extends Omit<ComponentProps<"div">, "ref"> {
    children?: ReactNode;
    className?: string;
    [key: string]: unknown;
  }
  export const ListItemSuffix: React.FC<ListItemSuffixProps>;

  // Tooltip
  export interface TooltipProps {
    children: ReactNode;
    content: ReactNode;
    placement?: string;
    offset?: number | object;
    dismiss?: object;
    animate?: object;
    className?: string;
    interactive?: boolean;
    open?: boolean;
    handler?: (value: boolean) => void;
    [key: string]: unknown;
  }
  export const Tooltip: React.FC<TooltipProps>;

  // Textarea
  export interface TextareaProps extends Omit<ComponentProps<"textarea">, "ref" | "size"> {
    variant?: "standard" | "outlined" | "static";
    size?: "md" | "lg";
    color?: string;
    label?: string;
    error?: boolean;
    success?: boolean;
    resize?: boolean;
    labelProps?: object;
    containerProps?: object;
    className?: string;
    shrink?: boolean;
    [key: string]: unknown;
  }
  export const Textarea: React.FC<TextareaProps>;

  // Progress
  export interface ProgressProps extends Omit<ComponentProps<"div">, "ref"> {
    value?: number;
    size?: "sm" | "md" | "lg";
    color?: string;
    label?: ReactNode;
    className?: string;
    [key: string]: unknown;
  }
  export const Progress: React.FC<ProgressProps>;

  // Tabs
  export interface TabsProps extends Omit<ComponentProps<"div">, "ref"> {
    value?: string | number;
    orientation?: "horizontal" | "vertical";
    className?: string;
    children?: ReactNode;
    [key: string]: unknown;
  }
  export const Tabs: React.FC<TabsProps>;

  export interface TabsHeaderProps extends Omit<ComponentProps<"div">, "ref"> {
    indicatorProps?: Record<string, unknown>;
    className?: string;
    children?: ReactNode;
    [key: string]: unknown;
  }
  export const TabsHeader: React.FC<TabsHeaderProps>;

  export interface TabsBodyProps extends Omit<ComponentProps<"div">, "ref"> {
    animate?: Record<string, unknown>;
    className?: string;
    children?: ReactNode;
    [key: string]: unknown;
  }
  export const TabsBody: React.FC<TabsBodyProps>;

  export interface TabProps extends Omit<ComponentProps<"button">, "ref"> {
    value: string | number;
    className?: string;
    activeClassName?: string;
    disabled?: boolean;
    children?: ReactNode;
    [key: string]: unknown;
  }
  export const Tab: React.FC<TabProps>;

  export interface TabPanelProps extends Omit<ComponentProps<"div">, "ref"> {
    value: string | number;
    className?: string;
    children?: ReactNode;
    [key: string]: unknown;
  }
  export const TabPanel: React.FC<TabPanelProps>;

  // ThemeProvider
  export interface ThemeProviderProps {
    children?: ReactNode;
    value?: object;
    [key: string]: unknown;
  }
  export const ThemeProvider: React.FC<ThemeProviderProps>;
}
