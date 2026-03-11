"use client";

import { Dispatch, SetStateAction, useEffect } from "react";
import { DragState } from "../model/types";

type Params = {
  dragState: DragState | null;
  toCompositionCoordinates: (clientX: number, clientY: number) => { x: number; y: number } | null;
  setDragState: Dispatch<SetStateAction<DragState | null>>;
  updateElementPosition: (sceneId: string, elementIndex: number, nextX: number, nextY: number) => void;
};

export function useOverlayDragEffect({
  dragState,
  toCompositionCoordinates,
  setDragState,
  updateElementPosition,
}: Params) {
  useEffect(() => {
    if (!dragState) {
      return;
    }

    const activeDrag = dragState;

    function handlePointerMove(event: globalThis.PointerEvent) {
      const coords = toCompositionCoordinates(event.clientX, event.clientY);
      if (!coords) {
        return;
      }

      updateElementPosition(
        activeDrag.sceneId,
        activeDrag.elementIndex,
        coords.x - activeDrag.pointerOffsetX - activeDrag.renderDeltaX,
        coords.y - activeDrag.pointerOffsetY - activeDrag.renderDeltaY,
      );
    }

    function stopDragging() {
      setDragState(null);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [dragState, setDragState, toCompositionCoordinates, updateElementPosition]);
}
