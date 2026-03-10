"use client";

import { Dispatch, PointerEvent, RefObject, SetStateAction, useCallback, useEffect, useState } from "react";
import { editableOverlayKinds } from "../model/constants";
import { DragState, OverlayResizeState, SelectedTimelineTrack, TimelineDragState, TimelineTrimState } from "../model/types";
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
  const [timelineTrimState, setTimelineTrimState] = useState<TimelineTrimState | null>(null);

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

  const beginTimelineClipTrim = useCallback(
    (event: PointerEvent<HTMLElement>, state: TimelineTrimState) => {
      event.preventDefault();
      event.stopPropagation();

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

      setTimelineTrimState(state);
    },
    [setSelectedElementKey, setSelectedTimelineTrack],
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
    const trackRowHeight = 36;
    let hasMoved = false;
    let maxRequiredDuration = 0;
    let lastAppliedStartFrame = Number.NaN;
    let lastAppliedLane = Number.NaN;
    let rafId: number | null = null;
    let pendingClientX: number | null = null;
    let pendingClientY: number | null = null;

    function applyDrag(clientX: number, clientY: number) {
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
      const laneDelta = Math.round((clientY - drag.startClientY) / trackRowHeight);
      const nextLane = Math.max(0, Math.min(drag.maxLane, drag.startLane + laneDelta));

      if (nextStartFrame === lastAppliedStartFrame && nextLane === lastAppliedLane) {
        return;
      }
      lastAppliedStartFrame = nextStartFrame;
      lastAppliedLane = nextLane;

      if (nextStartFrame !== drag.startFrame || nextLane !== drag.startLane) {
        hasMoved = true;
      }

      if (drag.kind === "scene") {
        setVideoSchema((prev) => {
          const movedScene = prev.scenes.find((scene) => scene.id === drag.sceneId);
          const movedSceneDuration = Math.max(1, movedScene?.durationInFrames ?? 1);
          const requiredDuration = nextStartFrame + movedSceneDuration;
          maxRequiredDuration = Math.max(maxRequiredDuration, requiredDuration);

          let hasChange = false;
          const nextScenes = prev.scenes.map((scene, index) => {
            const shouldMoveFrame = scene.id === drag.sceneId && scene.startFrame !== nextStartFrame;
            const shouldMoveLane = scene.id === drag.sceneId && (scene.timelineLane ?? index) !== nextLane;
            if (!shouldMoveFrame && !shouldMoveLane) {
              return scene;
            }

            hasChange = true;
            return {
              ...scene,
              startFrame: shouldMoveFrame ? nextStartFrame : scene.startFrame,
              timelineLane: shouldMoveLane ? nextLane : (scene.timelineLane ?? index),
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
        const movedElement = prev.scenes
          .find((scene) => scene.id === drag.sceneId)
          ?.elements[drag.elementIndex];
        const movedElementDuration = Math.max(1, movedElement?.durationInFrames ?? 1);
        const requiredDuration = nextStartFrame + movedElementDuration;
        maxRequiredDuration = Math.max(maxRequiredDuration, requiredDuration);

        let hasSceneChange = false;
        const nextScenes = prev.scenes.map((scene) => {
          let hasElementChange = false;
          const nextElements = scene.elements.map((element, index) => {
            if (!editableOverlayKinds.has(element.kind)) {
              return element;
            }

            const shouldMoveFrame = scene.id === drag.sceneId && index === drag.elementIndex && element.timelineStartFrame !== nextStartFrame;
            const shouldMoveLane =
              scene.id === drag.sceneId
              && index === drag.elementIndex
              && (element.timelineLane ?? 0) !== nextLane;

            if (!shouldMoveFrame && !shouldMoveLane) {
              return element;
            }

            hasElementChange = true;
            return {
              ...element,
              timelineStartFrame: shouldMoveFrame ? nextStartFrame : element.timelineStartFrame,
              timelineLane: shouldMoveLane ? nextLane : (element.timelineLane ?? 0),
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
      if (pendingClientX === null || pendingClientY === null) {
        return;
      }

      const clientX = pendingClientX;
      const clientY = pendingClientY;
      pendingClientX = null;
      pendingClientY = null;
      applyDrag(clientX, clientY);
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      pendingClientX = event.clientX;
      pendingClientY = event.clientY;
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
        applyDrag(pendingClientX, pendingClientY ?? drag.startClientY);
        pendingClientX = null;
        pendingClientY = null;
      }

      if (hasMoved) {
        suppressTrackClickUntilRef.current = Date.now() + 150;
      }
      if (maxRequiredDuration > 0) {
        setVideoSchema((prev) => ({
          ...prev,
          durationInFrames: Math.max(prev.durationInFrames, Math.ceil(maxRequiredDuration)),
        }));
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
    if (!timelineTrimState) {
      return;
    }

    const trim = timelineTrimState;
    let hasMoved = false;
    let maxRequiredDuration = 0;
    let lastAppliedStartFrame = Number.NaN;
    let lastAppliedDuration = Number.NaN;
    let rafId: number | null = null;
    let pendingClientX: number | null = null;

    function applyTrim(clientX: number) {
      const scrub = scrubZoneRef.current;
      if (!scrub) {
        return;
      }

      const scrubRect = scrub.getBoundingClientRect();
      const scrubWidth = Math.max(scrubRect.width, 1);
      const deltaFrames = Math.round(((clientX - trim.startClientX) / scrubWidth) * timelineFrameSpan);
      const currentEndFrame = trim.startFrame + trim.durationInFrames;
      let nextStartFrame = trim.startFrame;
      let nextDuration = trim.durationInFrames;
      let nextTrimStart = trim.trimStartFrames;
      let nextTrimEnd = trim.trimEndFrames;

      if (trim.edge === "left") {
        const proposedStart = trim.startFrame + deltaFrames;
        nextStartFrame = Math.max(trim.sourceStartFrame, Math.min(currentEndFrame - 1, proposedStart));
        nextDuration = currentEndFrame - nextStartFrame;
        nextTrimStart = nextStartFrame - trim.sourceStartFrame;
      } else {
        const proposedEnd = currentEndFrame + deltaFrames;
        const nextEndFrame = Math.max(trim.startFrame + 1, Math.min(trim.sourceEndFrame, proposedEnd));
        nextDuration = nextEndFrame - trim.startFrame;
        nextTrimEnd = trim.sourceEndFrame - nextEndFrame;
      }

      if (nextStartFrame === lastAppliedStartFrame && nextDuration === lastAppliedDuration) {
        return;
      }
      lastAppliedStartFrame = nextStartFrame;
      lastAppliedDuration = nextDuration;

      if (nextStartFrame !== trim.startFrame || nextDuration !== trim.durationInFrames) {
        hasMoved = true;
      }

      if (trim.kind === "scene") {
        setVideoSchema((prev) => {
          const requiredDuration = nextStartFrame + nextDuration;
          maxRequiredDuration = Math.max(maxRequiredDuration, requiredDuration);
          let hasChange = false;
          const nextScenes = prev.scenes.map((scene) => {
            if (scene.id !== trim.sceneId) {
              return scene;
            }

            const safeTrimStart = Math.max(0, nextTrimStart);
            const safeTrimEnd = Math.max(0, nextTrimEnd);
            const shouldUpdate =
              scene.startFrame !== nextStartFrame
              || scene.durationInFrames !== nextDuration
              || (scene.timelineTrimStartFrames ?? 0) !== safeTrimStart
              || (scene.timelineTrimEndFrames ?? 0) !== safeTrimEnd;

            if (!shouldUpdate) {
              return scene;
            }

            hasChange = true;
            return {
              ...scene,
              startFrame: nextStartFrame,
              durationInFrames: nextDuration,
              timelineTrimStartFrames: safeTrimStart,
              timelineTrimEndFrames: safeTrimEnd,
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
        const requiredDuration = nextStartFrame + nextDuration;
        maxRequiredDuration = Math.max(maxRequiredDuration, requiredDuration);
        let hasSceneChange = false;
        const nextScenes = prev.scenes.map((scene) => {
          if (scene.id !== trim.sceneId) {
            return scene;
          }

          let hasElementChange = false;
          const nextElements = scene.elements.map((element, index) => {
            if (index !== trim.elementIndex || !editableOverlayKinds.has(element.kind)) {
              return element;
            }

            const safeTrimStart = Math.max(0, nextTrimStart);
            const safeTrimEnd = Math.max(0, nextTrimEnd);
            const shouldUpdate =
              (element.timelineStartFrame ?? 0) !== nextStartFrame
              || element.durationInFrames !== nextDuration
              || (element.timelineTrimStartFrames ?? 0) !== safeTrimStart
              || (element.timelineTrimEndFrames ?? 0) !== safeTrimEnd;

            if (!shouldUpdate) {
              return element;
            }

            hasElementChange = true;
            return {
              ...element,
              timelineStartFrame: nextStartFrame,
              durationInFrames: nextDuration,
              timelineTrimStartFrames: safeTrimStart,
              timelineTrimEndFrames: safeTrimEnd,
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

    function flushPendingTrim() {
      rafId = null;
      if (pendingClientX === null) {
        return;
      }

      const clientX = pendingClientX;
      pendingClientX = null;
      applyTrim(clientX);
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      pendingClientX = event.clientX;
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(flushPendingTrim);
    }

    function stopTrimming() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (pendingClientX !== null) {
        applyTrim(pendingClientX);
        pendingClientX = null;
      }

      if (hasMoved) {
        suppressTrackClickUntilRef.current = Date.now() + 150;
      }
      if (maxRequiredDuration > 0) {
        setVideoSchema((prev) => ({
          ...prev,
          durationInFrames: Math.max(prev.durationInFrames, Math.ceil(maxRequiredDuration)),
        }));
      }
      setTimelineTrimState(null);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopTrimming);
    window.addEventListener("pointercancel", stopTrimming);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopTrimming);
      window.removeEventListener("pointercancel", stopTrimming);
    };
  }, [scrubZoneRef, setVideoSchema, suppressTrackClickUntilRef, timelineFrameSpan, timelineTrimState]);

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
    beginTimelineClipTrim,
    startOverlayDrag,
    startOverlayResize,
    clearOverlayInteractionState,
  };
}



