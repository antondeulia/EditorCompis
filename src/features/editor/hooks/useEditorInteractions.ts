"use client";

import { Dispatch, PointerEvent, RefObject, SetStateAction, useCallback, useState } from "react";
import { editableOverlayKinds } from "../model/constants";
import { DragState, OverlayResizeState, SelectedTimelineTrack, TimelineDragState, TimelineTrimState } from "../model/types";
import { VideoElement, VideoSchema } from "../model/schema";
import { useOverlayDragEffect } from "./useOverlayDragEffect";
import { useOverlayResizeEffect } from "./useOverlayResizeEffect";
import { useTimelineClipDragEffect } from "./useTimelineClipDragEffect";
import { useTimelineClipTrimEffect } from "./useTimelineClipTrimEffect";

type Params = {
  scrubZoneRef: RefObject<HTMLButtonElement | null>;
  timelineTracksRef: RefObject<HTMLDivElement | null>;
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
  timelineTracksRef,
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

  useTimelineClipDragEffect({
    timelineDragState,
    scrubZoneRef,
    timelineTracksRef,
    timelineFrameSpan,
    suppressTrackClickUntilRef,
    setTimelineDragState,
    setVideoSchema,
  });

  useTimelineClipTrimEffect({
    timelineTrimState,
    scrubZoneRef,
    timelineFrameSpan,
    suppressTrackClickUntilRef,
    setTimelineTrimState,
    setVideoSchema,
  });

  useOverlayDragEffect({
    dragState,
    toCompositionCoordinates,
    setDragState,
    updateElementPosition,
  });

  useOverlayResizeEffect({
    overlayResizeState,
    compositionViewportScale,
    setOverlayResizeState,
    updateElementBounds,
  });

  return {
    beginTimelineClipDrag,
    beginTimelineClipTrim,
    startOverlayDrag,
    startOverlayResize,
    clearOverlayInteractionState,
  };
}



