import { useCallback, useMemo, useState } from "react";

interface SelectionModifiers {
  toggle: boolean;
  range: boolean;
}

export const useTimelineSelection = (clipIdOrder: string[]) => {
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [lastSelectedClipId, setLastSelectedClipId] = useState<string | null>(null);

  const selectedClipIdSet = useMemo(
    () => new Set(selectedClipIds),
    [selectedClipIds],
  );

  const clipIndexById = useMemo(
    () => new Map(clipIdOrder.map((clipId, index) => [clipId, index] as const)),
    [clipIdOrder],
  );

  const clearSelection = useCallback(() => {
    setSelectedClipIds([]);
    setLastSelectedClipId(null);
  }, []);

  const selectSingleClip = useCallback((clipId: string) => {
    setSelectedClipIds([clipId]);
    setLastSelectedClipId(clipId);
  }, []);

  const applySelection = useCallback(
    ({ toggle, range }: SelectionModifiers, clipId: string) => {
      setSelectedClipIds((currentSelectedIds) => {
        if (range && lastSelectedClipId) {
          const currentIndex = clipIndexById.get(clipId);
          const anchorIndex = clipIndexById.get(lastSelectedClipId);

          if (currentIndex !== undefined && anchorIndex !== undefined) {
            const from = Math.min(currentIndex, anchorIndex);
            const to = Math.max(currentIndex, anchorIndex);
            return clipIdOrder.slice(from, to + 1);
          }
        }

        if (toggle) {
          if (currentSelectedIds.includes(clipId)) {
            return currentSelectedIds.filter((selectedId) => selectedId !== clipId);
          }

          return [...currentSelectedIds, clipId];
        }

        return [clipId];
      });

      setLastSelectedClipId(clipId);
      return !(toggle || range);
    },
    [clipIdOrder, clipIndexById, lastSelectedClipId],
  );

  return {
    selectedClipIds,
    selectedClipIdSet,
    clearSelection,
    selectSingleClip,
    applySelection,
  };
};
