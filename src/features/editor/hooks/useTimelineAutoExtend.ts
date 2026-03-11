"use client";

import { Dispatch, RefObject, SetStateAction, useEffect } from "react";
import { timelineExtensionChunkSeconds, timelineExtensionThresholdRatio } from "../model/constants";

type Params = {
  fps: number;
  timelineFrameSpan: number;
  timelineTracksRef: RefObject<HTMLDivElement | null>;
  setTimelineExtraFrames: Dispatch<SetStateAction<number>>;
};

export function useTimelineAutoExtend({
  fps,
  timelineFrameSpan,
  timelineTracksRef,
  setTimelineExtraFrames,
}: Params) {
  useEffect(() => {
    const timelineElement = timelineTracksRef.current;
    if (!timelineElement) {
      return;
    }

    const chunkFrames = Math.max(Math.round(fps * timelineExtensionChunkSeconds), fps);

    function maybeExtendTimeline() {
      const remaining = timelineElement.scrollWidth - (timelineElement.scrollLeft + timelineElement.clientWidth);
      const threshold = Math.max(timelineElement.clientWidth * timelineExtensionThresholdRatio, 120);

      if (remaining > threshold) {
        return;
      }

      setTimelineExtraFrames((prev) => prev + chunkFrames);
    }

    maybeExtendTimeline();
    timelineElement.addEventListener("scroll", maybeExtendTimeline, { passive: true });
    window.addEventListener("resize", maybeExtendTimeline);

    return () => {
      timelineElement.removeEventListener("scroll", maybeExtendTimeline);
      window.removeEventListener("resize", maybeExtendTimeline);
    };
  }, [fps, timelineFrameSpan, timelineTracksRef, setTimelineExtraFrames]);
}
