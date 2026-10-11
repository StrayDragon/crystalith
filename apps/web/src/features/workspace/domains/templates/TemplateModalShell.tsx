import { Close as CloseIcon } from '@mui/icons-material';
import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useLayer } from '../../../../shared/layer';
import { useFocusTrap } from '../../shared/hooks/useFocusTrap';

interface TemplateModalShellProps {
  open: boolean;
  onClose: () => void;
  icon: ReactNode;
  title: string;
  widthClass?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared modal scaffold for template dialogs (Save / Manage / Picker).
 * Owns: portal + overlay + focus trap + layered z-index + header/close chrome.
 * Body padding & footer layout are caller-owned via `children` / `footer`.
 */
export function TemplateModalShell({
  open,
  onClose,
  icon,
  title,
  widthClass = 'max-w-lg',
  children,
  footer,
}: TemplateModalShellProps) {
  const { style: modalStyle } = useLayer('modal');
  const modalRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap({ active: open, containerRef: modalRef, onEscape: onClose });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={modalStyle}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="关闭"
        tabIndex={-1}
      />

      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full ${widthClass} mx-4 ux-modal-in`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-gray-700 dark:text-slate-200 flex [&_svg]:text-[20px]">
              {icon}
            </span>
            <span className="text-base font-semibold text-gray-900 dark:text-slate-100">
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="关闭"
          >
            <CloseIcon style={{ fontSize: 18 }} className="text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {children}

        {footer}
      </div>
    </div>,
    document.body,
  );
}
