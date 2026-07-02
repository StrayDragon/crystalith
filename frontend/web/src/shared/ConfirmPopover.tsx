import {
  cloneElement,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button, Typography } from "@material-tailwind/react";
import { useLayer } from "./layer";

type Placement = "top" | "bottom" | "left" | "right";

// Popover dimensions (width: 220px, estimated height: ~125px)
const POPOVER_WIDTH = 220;
const POPOVER_HEIGHT = 125;
const OFFSET = 8;

interface ConfirmPopoverProps {
  message: string;
  onConfirm: () => void;
  children: ReactElement<any>;
  confirmText?: string;
  cancelText?: string;
  placement?: Placement;
  disabled?: boolean;
}

/**
 * Calculate the best placement to avoid overflow
 */
function calculateBestPlacement(anchorRect: DOMRect, preferredPlacement: Placement): Placement {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Check if each placement would overflow
  const wouldOverflow = {
    top: anchorRect.top - POPOVER_HEIGHT - OFFSET < 0,
    bottom: anchorRect.bottom + POPOVER_HEIGHT + OFFSET > viewportHeight,
    left: anchorRect.left - POPOVER_WIDTH - OFFSET < 0,
    right: anchorRect.right + POPOVER_WIDTH + OFFSET > viewportWidth,
  };

  // Also check horizontal centering for top/bottom placements
  const centerX = anchorRect.left + anchorRect.width / 2;
  const wouldOverflowHorizontalCenter = {
    leftSide: centerX - POPOVER_WIDTH / 2 < 0,
    rightSide: centerX + POPOVER_WIDTH / 2 > viewportWidth,
  };

  // Also check vertical centering for left/right placements
  const centerY = anchorRect.top + anchorRect.height / 2;
  const wouldOverflowVerticalCenter = {
    topSide: centerY - POPOVER_HEIGHT / 2 < 0,
    bottomSide: centerY + POPOVER_HEIGHT / 2 > viewportHeight,
  };

  // If preferred placement works, use it
  if (
    preferredPlacement === "top" &&
    !wouldOverflow.top &&
    !wouldOverflowHorizontalCenter.leftSide &&
    !wouldOverflowHorizontalCenter.rightSide
  ) {
    return "top";
  }
  if (
    preferredPlacement === "bottom" &&
    !wouldOverflow.bottom &&
    !wouldOverflowHorizontalCenter.leftSide &&
    !wouldOverflowHorizontalCenter.rightSide
  ) {
    return "bottom";
  }
  if (
    preferredPlacement === "left" &&
    !wouldOverflow.left &&
    !wouldOverflowVerticalCenter.topSide &&
    !wouldOverflowVerticalCenter.bottomSide
  ) {
    return "left";
  }
  if (
    preferredPlacement === "right" &&
    !wouldOverflow.right &&
    !wouldOverflowVerticalCenter.topSide &&
    !wouldOverflowVerticalCenter.bottomSide
  ) {
    return "right";
  }

  // Try opposite placement first
  const opposites: Record<Placement, Placement> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };
  const opposite = opposites[preferredPlacement];

  if (opposite === "top" && !wouldOverflow.top) return "top";
  if (opposite === "bottom" && !wouldOverflow.bottom) return "bottom";
  if (opposite === "left" && !wouldOverflow.left) return "left";
  if (opposite === "right" && !wouldOverflow.right) return "right";

  // Try all placements in order of preference
  const fallbackOrder: Placement[] = ["bottom", "top", "right", "left"];
  for (const p of fallbackOrder) {
    if (p === "top" && !wouldOverflow.top) return "top";
    if (p === "bottom" && !wouldOverflow.bottom) return "bottom";
    if (p === "left" && !wouldOverflow.left) return "left";
    if (p === "right" && !wouldOverflow.right) return "right";
  }

  // If all overflow, prefer bottom (most common fallback)
  return "bottom";
}

export default function ConfirmPopover({
  message,
  onConfirm,
  children,
  confirmText = "确认删除",
  cancelText = "取消",
  placement = "top",
  disabled = false,
}: ConfirmPopoverProps) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const { style } = useLayer("popover");

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
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const handleResize = () => updateAnchor();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [open, updateAnchor]);

  // Calculate the actual placement based on available space
  const actualPlacement = useMemo(() => {
    if (!anchorRect) return placement;
    return calculateBestPlacement(anchorRect, placement);
  }, [anchorRect, placement]);

  const anchor = useMemo(() => {
    if (!anchorRect) return null;
    switch (actualPlacement) {
      case "bottom":
        return { x: anchorRect.left + anchorRect.width / 2, y: anchorRect.bottom };
      case "left":
        return { x: anchorRect.left, y: anchorRect.top + anchorRect.height / 2 };
      case "right":
        return { x: anchorRect.right, y: anchorRect.top + anchorRect.height / 2 };
      case "top":
      default:
        return { x: anchorRect.left + anchorRect.width / 2, y: anchorRect.top };
    }
  }, [anchorRect, actualPlacement]);

  // Calculate transform with boundary checking for centered placements
  const transform = useMemo(() => {
    if (!anchorRect) {
      switch (actualPlacement) {
        case "bottom":
          return "translate(-50%, 8px)";
        case "left":
          return "translate(calc(-100% - 8px), -50%)";
        case "right":
          return "translate(8px, -50%)";
        case "top":
        default:
          return "translate(-50%, calc(-100% - 8px))";
      }
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // For top/bottom placements, adjust horizontal position if needed
    if (actualPlacement === "top" || actualPlacement === "bottom") {
      const centerX = anchorRect.left + anchorRect.width / 2;
      const leftEdge = centerX - POPOVER_WIDTH / 2;
      const rightEdge = centerX + POPOVER_WIDTH / 2;

      let translateX = "-50%";
      if (leftEdge < 8) {
        // Would overflow left, align to left edge with padding
        const offsetX = -centerX + POPOVER_WIDTH / 2 + 8;
        translateX = `calc(-50% + ${offsetX}px)`;
      } else if (rightEdge > viewportWidth - 8) {
        // Would overflow right, align to right edge with padding
        const offsetX = viewportWidth - 8 - centerX - POPOVER_WIDTH / 2;
        translateX = `calc(-50% + ${offsetX}px)`;
      }

      if (actualPlacement === "bottom") {
        return `translate(${translateX}, 8px)`;
      }
      return `translate(${translateX}, calc(-100% - 8px))`;
    }

    // For left/right placements, adjust vertical position if needed
    if (actualPlacement === "left" || actualPlacement === "right") {
      const centerY = anchorRect.top + anchorRect.height / 2;
      const topEdge = centerY - POPOVER_HEIGHT / 2;
      const bottomEdge = centerY + POPOVER_HEIGHT / 2;

      let translateY = "-50%";
      if (topEdge < 8) {
        // Would overflow top, align to top edge with padding
        const offsetY = -centerY + POPOVER_HEIGHT / 2 + 8;
        translateY = `calc(-50% + ${offsetY}px)`;
      } else if (bottomEdge > viewportHeight - 8) {
        // Would overflow bottom, align to bottom edge with padding
        const offsetY = viewportHeight - 8 - centerY - POPOVER_HEIGHT / 2;
        translateY = `calc(-50% + ${offsetY}px)`;
      }

      if (actualPlacement === "left") {
        return `translate(calc(-100% - 8px), ${translateY})`;
      }
      return `translate(8px, ${translateY})`;
    }

    return "translate(-50%, calc(-100% - 8px))";
  }, [anchorRect, actualPlacement]);

  return (
    <>
      {cloneElement(children, {
        onClick: handleTriggerClick,
      })}
      {open && anchor
        ? createPortal(
            <div className="fixed inset-0" style={style}>
              <button
                type="button"
                className="absolute inset-0"
                onClick={handleClose}
                aria-label="关闭确认"
                tabIndex={-1}
              />
              <div
                className="absolute"
                style={{ left: anchor.x, top: anchor.y, transform }}
                role="dialog"
                aria-modal="true"
              >
                <div className="rounded-lg border border-gray-200 bg-white shadow-lg p-3 w-[220px]">
                  <Typography variant="small" className="text-xs text-gray-700">
                    {message}
                  </Typography>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Button
                      variant="text"
                      size="sm"
                      className="px-2 py-1 text-xs"
                      onClick={handleClose}
                    >
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
