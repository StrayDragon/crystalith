/**
 * GridStack CSS overrides for Modular Canvas.
 * Injected via <style> to override GridStack's default styles.
 *
 * NOTE: All visual card styling (bg, border, shadow, border-radius) lives on
 * WidgetShell so that empty GridStack DOM nodes are invisible until React
 * portals mount.
 */
export const GRIDSTACK_STYLES = `
/* GridStack container — transparent background so page bg shows through */
.grid-stack {
  min-height: 100% !important;
  background: transparent !important;
}

/* Grid stack items — fully transparent, no visual appearance */
.grid-stack-item {
  background: transparent !important;
}

/* Item content — positioning only, no visual decoration */
.grid-stack-item-content {
  overflow: hidden !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  inset: 4px !important;
}

/* Placeholder when dragging */
.grid-stack-placeholder > .placeholder-content {
  border: 2px dashed rgba(217, 119, 6, 0.3) !important;
  border-radius: 14px !important;
  background: rgba(217, 119, 6, 0.03) !important;
}

/* Resize handles - hidden by default, visible on hover */
.grid-stack-item > .ui-resizable-handle {
  opacity: 0;
  transition: opacity 0.2s;
}
.grid-stack-item:hover > .ui-resizable-handle {
  opacity: 0.4;
}

/* Ensure dragging widget doesn't show white bg artifact */
.grid-stack-item.ui-draggable-dragging {
  background: transparent !important;
}
`;
