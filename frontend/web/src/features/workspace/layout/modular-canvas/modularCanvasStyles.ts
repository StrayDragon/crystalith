/**
 * GridStack CSS overrides for Modular Canvas.
 * Injected via <style> to override GridStack's default styles.
 */
export const GRIDSTACK_STYLES = `
/* GridStack container — transparent background so page bg shows through */
.grid-stack {
  min-height: 100% !important;
  background: transparent !important;
}

/* Grid stack items — transparent background to avoid white flash */
.grid-stack-item {
  background: transparent !important;
}

/* Widget card style */
.grid-stack-item-content {
  border-radius: 14px !important;
  overflow: hidden !important;
  background: white !important;
  border: 1px solid rgb(229, 231, 235) !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
  transition: box-shadow 0.2s, border-color 0.2s !important;
  inset: 4px !important;
}
.grid-stack-item-content:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06) !important;
  border-color: rgba(217, 119, 6, 0.25) !important;
}

/* Dark mode via class (Tailwind) */
.dark .grid-stack-item-content {
  background: rgb(15, 23, 42) !important;
  border-color: rgb(51, 65, 85) !important;
}
.dark .grid-stack-item-content:hover {
  border-color: rgba(217, 119, 6, 0.35) !important;
}

/* Fallback dark mode via media query */
@media (prefers-color-scheme: dark) {
  .grid-stack-item-content {
    background: rgb(15, 23, 42) !important;
    border-color: rgb(51, 65, 85) !important;
  }
  .grid-stack-item-content:hover {
    border-color: rgba(217, 119, 6, 0.35) !important;
  }
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

/* Editing mode visual hint: show border on all widgets */
.mc-editing .grid-stack-item-content {
  border-style: dashed !important;
  border-color: rgba(217, 119, 6, 0.2) !important;
}
.dark .mc-editing .grid-stack-item-content {
  border-color: rgba(217, 119, 6, 0.3) !important;
}

/* Ensure dragging widget doesn't show white bg artifact */
.grid-stack-item.ui-draggable-dragging {
  background: transparent !important;
}
.grid-stack-item.ui-draggable-dragging > .grid-stack-item-content {
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12) !important;
}
`;
