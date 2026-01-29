interface CitationActionsProps {
  selectedCount: number;
  totalCount: number;
  onSendSelected: () => void;
  onCompareSelected: () => void;
  onCopySelected: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export default function CitationActions({
  selectedCount,
  totalCount,
  onSendSelected,
  onCompareSelected,
  onCopySelected,
  onSelectAll,
  onClearSelection,
}: CitationActionsProps) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="CitationActionBar">
      <div className="CitationActionMeta">
        已选 {selectedCount}/{totalCount} 条引用
      </div>
      <div className="CitationActionButtons">
        <button
          type="button"
          className="ActionButton"
          onClick={onSendSelected}
          disabled={!hasSelection}
        >
          发送至提炼
        </button>
        <button
          type="button"
          className="ActionButton isPrimary"
          onClick={onCompareSelected}
          disabled={!hasSelection}
        >
          对比分析
        </button>
        <button
          type="button"
          className="ActionButton"
          onClick={onCopySelected}
          disabled={!hasSelection}
        >
          复制引用
        </button>
        <button type="button" className="ActionButton" onClick={onSelectAll}>
          全选
        </button>
        <button
          type="button"
          className="ActionButton"
          onClick={onClearSelection}
          disabled={!hasSelection}
        >
          清空
        </button>
      </div>
    </div>
  );
}
