"use client";

import { Dispatch, RefObject, SetStateAction, useEffect } from "react";
import { timelineTrackableKinds } from "../model/constants";
import { TimelineTrimState } from "../model/types";
import { VideoSchema } from "../model/schema";

type Params = {
  timelineTrimState: TimelineTrimState | null;
  scrubZoneRef: RefObject<HTMLButtonElement | null>;
  timelineFrameSpan: number;
  suppressTrackClickUntilRef: RefObject<number>;
  setTimelineTrimState: Dispatch<SetStateAction<TimelineTrimState | null>>;
  setVideoSchema: Dispatch<SetStateAction<VideoSchema>>;
};

export function useTimelineClipTrimEffect({
  timelineTrimState,
  scrubZoneRef,
  timelineFrameSpan,
  suppressTrackClickUntilRef,
  setTimelineTrimState,
  setVideoSchema,
}: Params) {
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
            if (index !== trim.elementIndex || !timelineTrackableKinds.has(element.kind)) {
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
  }, [scrubZoneRef, setTimelineTrimState, setVideoSchema, suppressTrackClickUntilRef, timelineFrameSpan, timelineTrimState]);
}
