"use client";

import { Dispatch, SetStateAction, useEffect } from "react";
import { getTextMinimumHeightForWidth, getTextMinimumWidth } from "../lib/utils";
import { OverlayResizeState } from "../model/types";

type Params = {
  overlayResizeState: OverlayResizeState | null;
  compositionViewportScale: number;
  setOverlayResizeState: Dispatch<SetStateAction<OverlayResizeState | null>>;
  updateElementBounds: (
    sceneId: string,
    elementIndex: number,
    nextX: number,
    nextY: number,
    nextWidth: number,
    nextHeight: number,
  ) => void;
};

export function useOverlayResizeEffect({
  overlayResizeState,
  compositionViewportScale,
  setOverlayResizeState,
  updateElementBounds,
}: Params) {
  useEffect(() => {
    if (!overlayResizeState) {
      return;
    }

    const activeResize = overlayResizeState;

    function handlePointerMove(event: globalThis.PointerEvent) {
      const scale = Math.max(compositionViewportScale, 0.0001);
      const deltaX = (event.clientX - activeResize.startClientX) / scale;
      const deltaY = (event.clientY - activeResize.startClientY) / scale;
      const minWidth = activeResize.element.kind === "text" ? getTextMinimumWidth(activeResize.element) : 36;
      let left = activeResize.startX;
      let right = activeResize.startX + activeResize.startWidth;
      let top = activeResize.startY;
      let bottom = activeResize.startY + activeResize.startHeight;

      if (activeResize.directionX === -1) {
        left += deltaX;
      } else if (activeResize.directionX === 1) {
        right += deltaX;
      }

      if (activeResize.directionY === -1) {
        top += deltaY;
      } else if (activeResize.directionY === 1) {
        bottom += deltaY;
      }

      if (right - left < minWidth) {
        if (activeResize.directionX === -1) {
          left = right - minWidth;
        } else if (activeResize.directionX === 1) {
          right = left + minWidth;
        }
      }

      const minHeight =
        activeResize.element.kind === "text"
          ? getTextMinimumHeightForWidth(activeResize.element, right - left)
          : 24;

      if (bottom - top < minHeight) {
        if (activeResize.directionY === -1) {
          top = bottom - minHeight;
        } else if (activeResize.directionY === 1) {
          bottom = top + minHeight;
        }
      }

      updateElementBounds(
        activeResize.sceneId,
        activeResize.elementIndex,
        left,
        top,
        right - left,
        bottom - top,
      );
    }

    function stopResizing() {
      setOverlayResizeState(null);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [compositionViewportScale, overlayResizeState, setOverlayResizeState, updateElementBounds]);
}
