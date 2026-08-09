import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SourceItem } from '../../../shared/types';

export function useSourcesPanelSelection({
  sources,
  onRemoveSources,
  onBatchReembedSources,
  onCreateSourceTag,
  onAssignTagToSources,
  onRemoveTagFromSources,
  onSelectedSourceIdsChange,
}: {
  sources: SourceItem[];
  onRemoveSources: (sourceIds: number[]) => Promise<boolean>;
  onBatchReembedSources?: (sourceIds: number[]) => Promise<boolean>;
  onCreateSourceTag?: (name: string) => Promise<{ id: number } | null>;
  onAssignTagToSources?: (tagId: number, sourceIds: number[]) => Promise<boolean>;
  onRemoveTagFromSources?: (tagId: number, sourceIds: number[]) => Promise<boolean>;
  onSelectedSourceIdsChange?: (selected: Record<number, boolean>) => void;
}) {
  const [selectedSourceIds, setSelectedSourceIds] = useState<Record<number, boolean>>({});
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!sources.length) {
      setSelectedSourceIds({});
      setLastSelectedIndex(null);
      return;
    }
    setSelectedSourceIds((prev) => {
      const next: Record<number, boolean> = {};
      const hasExistingSelection = Object.values(prev).some(Boolean);
      sources.forEach((source) => {
        const isSelectable = source.statusTone === 'READY';
        next[source.id] = hasExistingSelection
          ? isSelectable
            ? (prev[source.id] ?? false)
            : false
          : isSelectable;
      });
      return next;
    });
  }, [sources]);

  useEffect(() => {
    onSelectedSourceIdsChange?.(selectedSourceIds);
  }, [onSelectedSourceIdsChange, selectedSourceIds]);

  const sourceIdToIndex = useMemo(() => {
    const map = new Map<number, number>();
    sources.forEach((source, index) => {
      map.set(source.id, index);
    });
    return map;
  }, [sources]);

  const selectableSources = useMemo(
    () => sources.filter((source) => source.statusTone === 'READY'),
    [sources],
  );
  const allSelected = useMemo(
    () =>
      selectableSources.length > 0 &&
      selectableSources.every((source) => selectedSourceIds[source.id]),
    [selectableSources, selectedSourceIds],
  );
  const selectedIds = useMemo(
    () => sources.filter((source) => selectedSourceIds[source.id]).map((source) => source.id),
    [sources, selectedSourceIds],
  );
  const selectedTagNames = useMemo(() => {
    const tagSet = new Set<string>();
    sources
      .filter((source) => selectedSourceIds[source.id])
      .forEach((source) => {
        source.tags.forEach((tag) => {
          tagSet.add(tag);
        });
      });
    return Array.from(tagSet).toSorted((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [sources, selectedSourceIds]);

  function handleToggleAll() {
    if (allSelected) {
      setSelectedSourceIds({});
      setLastSelectedIndex(null);
      return;
    }
    const next: Record<number, boolean> = {};
    selectableSources.forEach((source) => {
      next[source.id] = true;
    });
    setSelectedSourceIds(next);
    if (selectableSources.length > 0) {
      const firstIndex = sourceIdToIndex.get(selectableSources[0].id);
      setLastSelectedIndex(firstIndex ?? null);
    }
  }

  const handleToggleSource = useCallback(
    (id: number, event?: Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>) => {
      const source = sources.find((item) => item.id === id);
      if (!source || source.statusTone !== 'READY') return;

      const index = sourceIdToIndex.get(id);
      if (index == null) return;

      const shiftPressed = Boolean(event?.shiftKey);
      // intentionally || — modifier key presence check
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing
      const togglePressed = Boolean(event?.ctrlKey || event?.metaKey);

      setSelectedSourceIds((prev) => {
        const next = { ...prev };

        if (shiftPressed && lastSelectedIndex != null) {
          const start = Math.min(lastSelectedIndex, index);
          const end = Math.max(lastSelectedIndex, index);
          for (let cursor = start; cursor <= end; cursor += 1) {
            const item = sources[cursor];
            if (item?.statusTone === 'READY') {
              next[item.id] = true;
            }
          }
          return next;
        }

        if (togglePressed) {
          next[id] = !prev[id];
          return next;
        }

        next[id] = !prev[id];
        return next;
      });

      setLastSelectedIndex(index);
    },
    [sources, sourceIdToIndex, lastSelectedIndex],
  );

  const handleBatchDelete = useCallback(async () => {
    if (!selectedIds.length) return;
    const success = await onRemoveSources(selectedIds);
    if (success) {
      setSelectedSourceIds({});
      setLastSelectedIndex(null);
    }
  }, [onRemoveSources, selectedIds]);

  const handleBatchReembed = useCallback(async () => {
    if (!onBatchReembedSources || !selectedIds.length) return;
    await onBatchReembedSources(selectedIds);
  }, [onBatchReembedSources, selectedIds]);

  const handleBatchCreateAndAssignTag = useCallback(async () => {
    if (!onCreateSourceTag || !onAssignTagToSources || selectedIds.length === 0) return;
    const rawName = window.prompt('输入新标签名称（会分配给已选来源）');
    const name = rawName?.trim();
    if (!name) return;
    const tag = await onCreateSourceTag(name);
    if (!tag) return;
    await onAssignTagToSources(tag.id, selectedIds);
  }, [onCreateSourceTag, onAssignTagToSources, selectedIds]);

  const handleAssignExistingTag = useCallback(
    async (tagId: number) => {
      if (!onAssignTagToSources || selectedIds.length === 0) return;
      await onAssignTagToSources(tagId, selectedIds);
    },
    [onAssignTagToSources, selectedIds],
  );

  const handleRemoveExistingTag = useCallback(
    async (tagId: number) => {
      if (!onRemoveTagFromSources || selectedIds.length === 0) return;
      await onRemoveTagFromSources(tagId, selectedIds);
    },
    [onRemoveTagFromSources, selectedIds],
  );

  return {
    selectedSourceIds,
    sourceIdToIndex,
    allSelected,
    selectedIds,
    selectedTagNames,
    handleToggleAll,
    handleToggleSource,
    handleBatchDelete,
    handleBatchReembed,
    handleBatchCreateAndAssignTag,
    handleAssignExistingTag,
    handleRemoveExistingTag,
  };
}
