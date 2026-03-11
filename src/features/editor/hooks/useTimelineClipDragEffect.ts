"use client";

import { Dispatch, RefObject, SetStateAction, useEffect } from "react";
import { timelineTrackableKinds } from "../model/constants";
import { TimelineDragState } from "../model/types";
import { VideoSchema } from "../model/schema";

type Params = {
  timelineDragState: TimelineDragState | null;
  scrubZoneRef: RefObject<HTMLButtonElement | null>;
  timelineTracksRef: RefObject<HTMLDivElement | null>;
  timelineFrameSpan: number;
  suppressTrackClickUntilRef: RefObject<number>;
  setTimelineDragState: Dispatch<SetStateAction<TimelineDragState | null>>;
  setVideoSchema: Dispatch<SetStateAction<VideoSchema>>;
};

export function useTimelineClipDragEffect({
  timelineDragState,
  scrubZoneRef,
  timelineTracksRef,
  timelineFrameSpan,
  suppressTrackClickUntilRef,
  setTimelineDragState,
  setVideoSchema,
}: Params) {
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
    let autoScrollRafId: number | null = null;
    let lastPointerClientX: number | null = null;
    let lastPointerClientY: number | null = null;

    function getAutoScrollDelta(clientX: number) {
      const tracksElement = timelineTracksRef.current;
      if (!tracksElement) {
        return 0;
      }

      const rect = tracksElement.getBoundingClientRect();
      const edgeThreshold = 72;
      const maxSpeedPxPerFrame = 22;

      if (clientX > rect.right - edgeThreshold) {
        const proximity = Math.min(1, (clientX - (rect.right - edgeThreshold)) / edgeThreshold);
        return Math.ceil(proximity * maxSpeedPxPerFrame);
      }

      if (clientX < rect.left + edgeThreshold) {
        const proximity = Math.min(1, ((rect.left + edgeThreshold) - clientX) / edgeThreshold);
        return -Math.ceil(proximity * maxSpeedPxPerFrame);
      }

      return 0;
    }

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
            if (!timelineTrackableKinds.has(element.kind)) {
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

    function runAutoScroll() {
      autoScrollRafId = null;
      if (lastPointerClientX === null || lastPointerClientY === null) {
        return;
      }

      const tracksElement = timelineTracksRef.current;
      if (!tracksElement) {
        return;
      }

      const delta = getAutoScrollDelta(lastPointerClientX);
      if (delta === 0) {
        return;
      }

      const maxScrollLeft = Math.max(0, tracksElement.scrollWidth - tracksElement.clientWidth);
      const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, tracksElement.scrollLeft + delta));
      if (Math.abs(nextScrollLeft - tracksElement.scrollLeft) < 0.5) {
        return;
      }

      tracksElement.scrollLeft = nextScrollLeft;
      applyDrag(lastPointerClientX, lastPointerClientY);
      autoScrollRafId = window.requestAnimationFrame(runAutoScroll);
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      lastPointerClientX = event.clientX;
      lastPointerClientY = event.clientY;
      pendingClientX = event.clientX;
      pendingClientY = event.clientY;
      if (rafId !== null) {
        if (autoScrollRafId === null && getAutoScrollDelta(event.clientX) !== 0) {
          autoScrollRafId = window.requestAnimationFrame(runAutoScroll);
        }
        return;
      }

      rafId = window.requestAnimationFrame(flushPendingDrag);
      if (autoScrollRafId === null && getAutoScrollDelta(event.clientX) !== 0) {
        autoScrollRafId = window.requestAnimationFrame(runAutoScroll);
      }
    }

    function stopDragging() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (autoScrollRafId !== null) {
        window.cancelAnimationFrame(autoScrollRafId);
        autoScrollRafId = null;
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
      if (autoScrollRafId !== null) {
        window.cancelAnimationFrame(autoScrollRafId);
      }
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [scrubZoneRef, setTimelineDragState, setVideoSchema, suppressTrackClickUntilRef, timelineDragState, timelineFrameSpan, timelineTracksRef]);
}
