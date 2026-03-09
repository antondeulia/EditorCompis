"use client";

import { Dispatch, PointerEvent, RefObject, SetStateAction, useCallback, useEffect, useState } from "react";
import { editableOverlayKinds } from "../model/constants";
import { DragState, OverlayResizeState, SelectedTimelineTrack, TimelineDragState } from "../model/types";
import { getTextMinimumHeightForWidth, getTextMinimumWidth } from "../lib/utils";
import { VideoElement, VideoSchema } from "../model/schema";

type Params = {
  scrubZoneRef: RefObject<HTMLButtonElement | null>;
  timelineFrameSpan: number;
  compositionViewportScale: number;
  toCompositionCoordinates: (clientX: number, clientY: number) => { x: number; y: number } | null;
  suppressTrackClickUntilRef: RefObject<number>;
  setVideoSchema: Dispatch<SetStateAction<VideoSchema>>;
  setSelectedElementKey: Dispatch<SetStateAction<string | null>>;
  setSelectedTimelineTrack: Dispatch<SetStateAction<SelectedTimelineTrack | null>>;
  updateElementPosition: (sceneId: string, elementIndex: number, nextX: number, nextY: number) => void;
  updateElementBounds: (
    sceneId: string,
    elementIndex: number,
    nextX: number,
    nextY: number,
    nextWidth: number,
    nextHeight: number,
  ) => void;
};

export function useEditorInteractions({
  scrubZoneRef,
  timelineFrameSpan,
  compositionViewportScale,
  toCompositionCoordinates,
  suppressTrackClickUntilRef,
  setVideoSchema,
  setSelectedElementKey,
  setSelectedTimelineTrack,
  updateElementPosition,
  updateElementBounds,
}: Params) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [overlayResizeState, setOverlayResizeState] = useState<OverlayResizeState | null>(null);
  const [timelineDragState, setTimelineDragState] = useState<TimelineDragState | null>(null);

  const beginTimelineClipDrag = useCallback(
    (event: PointerEvent<HTMLElement>, state: TimelineDragState) => {
      event.preventDefault();
      event.stopPropagation();
      const scrubElement = scrubZoneRef.current;
      if (!scrubElement) {
        return;
      }

      const scrubRect = scrubElement.getBoundingClientRect();
      const scrubWidth = Math.max(scrubRect.width, 1);
      const pointerX = Math.max(0, event.clientX - scrubRect.left);
      const pointerFrame = (pointerX / scrubWidth) * timelineFrameSpan;
      const pointerOffsetFrames = pointerFrame - state.startFrame;

      if (state.kind === "scene") {
        setSelectedTimelineTrack({ kind: "scene", sceneId: state.sceneId });
        setSelectedElementKey(null);
      } else {
        setSelectedTimelineTrack({
          kind: "element",
          sceneId: state.sceneId,
          elementIndex: state.elementIndex,
        });
        setSelectedElementKey(`${state.sceneId}:${state.elementIndex}`);
      }

      setTimelineDragState({
        ...state,
        pointerOffsetFrames,
      });
    },
    [scrubZoneRef, setSelectedElementKey, setSelectedTimelineTrack, timelineFrameSpan],
  );

  const startOverlayDrag = useCallback(
    (
      event: PointerEvent<HTMLButtonElement>,
      sceneId: string,
      elementIndex: number,
      element: VideoElement,
      renderedX: number,
      renderedY: number,
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (!editableOverlayKinds.has(element.kind)) {
        return;
      }

      const coords = toCompositionCoordinates(event.clientX, event.clientY);
      if (!coords) {
        return;
      }

      setSelectedElementKey(`${sceneId}:${elementIndex}`);
      setSelectedTimelineTrack({
        kind: "element",
        sceneId,
        elementIndex,
      });
      setDragState({
        sceneId,
        elementIndex,
        pointerOffsetX: coords.x - renderedX,
        pointerOffsetY: coords.y - renderedY,
        renderDeltaX: renderedX - element.x,
        renderDeltaY: renderedY - element.y,
      });
    },
    [setSelectedElementKey, setSelectedTimelineTrack, toCompositionCoordinates],
  );

  const startOverlayResize = useCallback(
    (
      event: PointerEvent<HTMLElement>,
      sceneId: string,
      elementIndex: number,
      element: VideoElement,
      directionX: -1 | 0 | 1,
      directionY: -1 | 0 | 1,
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (!editableOverlayKinds.has(element.kind)) {
        return;
      }

      setSelectedElementKey(`${sceneId}:${elementIndex}`);
      setOverlayResizeState({
        sceneId,
        elementIndex,
        element,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: element.x,
        startY: element.y,
        startWidth: element.width,
        startHeight: element.height,
        directionX,
        directionY,
      });
    },
    [setSelectedElementKey],
  );

  const clearOverlayInteractionState = useCallback(() => {
    setDragState(null);
    setOverlayResizeState(null);
  }, []);

  useEffect(() => {
    if (!timelineDragState) {
      return;
    }

    const drag = timelineDragState;
    let hasMoved = false;
    let lastAppliedStartFrame = Number.NaN;
    let rafId: number | null = null;
    let pendingClientX: number | null = null;

    function applyDrag(clientX: number) {
      const scrub = scrubZoneRef.current;
      if (!scrub) {
        return;
      }

      const scrubRect = scrub.getBoundingClientRect();
      const scrubWidth = Math.max(scrubRect.width, 1);
      const pointerX = Math.max(0, clientX - scrubRect.left);
      const pointerFrame = (pointerX / scrubWidth) * timelineFrameSpan;
      const pointerOffsetFrames = drag.pointerOffsetFrames ?? 0;
      const nextStartFrame = Math.max(0, Math.round(pointerFrame - pointerOffsetFrames));

      if (nextStartFrame === lastAppliedStartFrame) {
        return;
      }
      lastAppliedStartFrame = nextStartFrame;

      if (nextStartFrame !== drag.startFrame) {
        hasMoved = true;
      }

      if (drag.kind === "scene") {
        setVideoSchema((prev) => {
          let hasChange = false;
          const nextScenes = prev.scenes.map((scene) => {
            if (scene.id !== drag.sceneId) {
              return scene;
            }

            if (scene.startFrame === nextStartFrame) {
              return scene;
            }

            hasChange = true;
            return {
              ...scene,
              startFrame: nextStartFrame,
            };
          });

          if (!hasChange) {
            return prev;
          }

          return {
            ...prev,
            scenes: nextScenes,
          };
        });

        return;
      }

      setVideoSchema((prev) => {
        let hasSceneChange = false;
        const nextScenes = prev.scenes.map((scene) => {
          if (scene.id !== drag.sceneId) {
            return scene;
          }

          let hasElementChange = false;
          const nextElements = scene.elements.map((element, index) => {
            if (index !== drag.elementIndex) {
              return element;
            }

            if (element.timelineStartFrame === nextStartFrame) {
              return element;
            }

            hasElementChange = true;

            return {
              ...element,
              timelineStartFrame: nextStartFrame,
            };
          });

          if (!hasElementChange) {
            return scene;
          }

          hasSceneChange = true;
          return {
            ...scene,
            elements: nextElements,
          };
        });

        if (!hasSceneChange) {
          return prev;
        }

        return {
          ...prev,
          scenes: nextScenes,
        };
      });
    }

    function flushPendingDrag() {
      rafId = null;
      if (pendingClientX === null) {
        return;
      }

      const clientX = pendingClientX;
      pendingClientX = null;
      applyDrag(clientX);
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      pendingClientX = event.clientX;
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(flushPendingDrag);
    }

    function stopDragging() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (pendingClientX !== null) {
        applyDrag(pendingClientX);
        pendingClientX = null;
      }

      if (hasMoved) {
        suppressTrackClickUntilRef.current = Date.now() + 150;
      }
      setTimelineDragState(null);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [scrubZoneRef, setVideoSchema, suppressTrackClickUntilRef, timelineDragState, timelineFrameSpan]);

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
  }, [dragState, toCompositionCoordinates, updateElementPosition]);

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
  }, [compositionViewportScale, overlayResizeState, updateElementBounds]);

  return {
    beginTimelineClipDrag,
    startOverlayDrag,
    startOverlayResize,
    clearOverlayInteractionState,
  };
}



