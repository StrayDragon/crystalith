import type { PointerEventHandler } from "react";

type WorkspaceResizeHandleProps = {
  ariaLabel: string;
  isResizing: boolean;
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  className?: string;
};

export default function WorkspaceResizeHandle({
  ariaLabel,
  isResizing,
  onPointerDown,
  className = "",
}: WorkspaceResizeHandleProps) {
  return (
    <button
      type="button"
      className={`items-center justify-center w-3 cursor-col-resize bg-transparent hover:bg-transparent group flex ${className}`}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
    >
      <div
        className={`w-0.5 h-12 rounded-full bg-gray-200 transition-colors group-hover:bg-gray-400 ${
          isResizing ? "bg-gray-500" : ""
        }`}
      />
    </button>
  );
}
