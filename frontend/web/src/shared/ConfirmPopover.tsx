import { cloneElement, type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Typography } from '@material-tailwind/react';
import { useLayer } from './layer';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface ConfirmPopoverProps {
  message: string;
  onConfirm: () => void;
  children: ReactElement;
  confirmText?: string;
  cancelText?: string;
  placement?: Placement;
  disabled?: boolean;
}

export default function ConfirmPopover({
  message,
  onConfirm,
  children,
  confirmText = '确认删除',
  cancelText = '取消',
  placement = 'top',
  disabled = false,
}: ConfirmPopoverProps) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const { style } = useLayer('popover');

  const updateAnchor = useCallback(() => {
    if (triggerRef.current) {
      setAnchorRect(triggerRef.current.getBoundingClientRect());
    }
  }, []);

  const handleTriggerClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (children.props.onClick) {
        children.props.onClick(event);
      }
      if (event.defaultPrevented) return;
      if (disabled) return;
      triggerRef.current = event.currentTarget as HTMLElement;
      updateAnchor();
      setOpen(true);
    },
    [children, disabled, updateAnchor],
  );

  const handleClose = useCallback(() => setOpen(false), []);

  const handleConfirm = useCallback(() => {
    onConfirm();
    setOpen(false);
  }, [onConfirm]);

  useEffect(() => {
    if (!open) return;
    updateAnchor();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    const handleResize = () => updateAnchor();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [open, updateAnchor]);

  const anchor = useMemo(() => {
    if (!anchorRect) return null;
    switch (placement) {
      case 'bottom':
        return { x: anchorRect.left + anchorRect.width / 2, y: anchorRect.bottom };
      case 'left':
        return { x: anchorRect.left, y: anchorRect.top + anchorRect.height / 2 };
      case 'right':
        return { x: anchorRect.right, y: anchorRect.top + anchorRect.height / 2 };
      case 'top':
      default:
        return { x: anchorRect.left + anchorRect.width / 2, y: anchorRect.top };
    }
  }, [anchorRect, placement]);

  const transform = useMemo(() => {
    switch (placement) {
      case 'bottom':
        return 'translate(-50%, 8px)';
      case 'left':
        return 'translate(calc(-100% - 8px), -50%)';
      case 'right':
        return 'translate(8px, -50%)';
      case 'top':
      default:
        return 'translate(-50%, calc(-100% - 8px))';
    }
  }, [placement]);

  return (
    <>
      {cloneElement(children, {
        onClick: handleTriggerClick,
      })}
      {open && anchor
        ? createPortal(
          <div className="fixed inset-0" style={style} onClick={handleClose}>
            <div
              className="absolute"
              style={{ left: anchor.x, top: anchor.y, transform }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="rounded-lg border border-gray-200 bg-white shadow-lg p-3 w-[220px]">
                <Typography variant="small" className="text-xs text-gray-700">
                  {message}
                </Typography>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button variant="text" size="sm" className="px-2 py-1 text-xs" onClick={handleClose}>
                    {cancelText}
                  </Button>
                  <Button
                    size="sm"
                    className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600"
                    onClick={handleConfirm}
                  >
                    {confirmText}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
