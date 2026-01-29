import { useEffect, useRef } from 'react';

import type { OutputTypeId } from '../../shared/types';

interface OutputTypeOption {
  id: OutputTypeId;
  label: string;
  description: string;
}

interface OutputTypeSelectorProps {
  options: OutputTypeOption[];
  value: OutputTypeId;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (value: OutputTypeId) => void;
}

export default function OutputTypeSelector({
  options,
  value,
  isOpen,
  onToggle,
  onClose,
  onSelect,
}: OutputTypeSelectorProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const activeOption = options.find((item) => item.id === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleClick(event: MouseEvent) {
      if (!panelRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, onClose]);

  return (
    <div className="OutputTypeSelector">
      <button
        type="button"
        className="OutputTypeButton"
        aria-expanded={isOpen}
        aria-controls="output-type-panel"
        onClick={onToggle}
      >
        <span className="OutputTypeLabel">输出类型</span>
        <span className="OutputTypeValue">{activeOption?.label ?? value}</span>
      </button>
      {isOpen ? (
        <div
          id="output-type-panel"
          ref={panelRef}
          className="OutputTypePanel"
          role="dialog"
          aria-label="输出类型选择"
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`OutputTypeOption ${option.id === value ? 'isActive' : ''}`}
              onClick={() => {
                onSelect(option.id);
                onClose();
              }}
            >
              <div className="OutputTypeOptionLabel">{option.label}</div>
              <div className="OutputTypeOptionDescription">{option.description}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
