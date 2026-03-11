"use client";

import { RefObject, useEffect, useRef } from "react";

type Params = {
  timelineTracksRef: RefObject<HTMLDivElement | null>;
  isScrubbing: boolean;
  applyTimelineWheelZoom: (deltaY: number, clientX: number) => void;
};

export function useTimelineWheelZoomHotkey({
  timelineTracksRef,
  isScrubbing,
  applyTimelineWheelZoom,
}: Params) {
  const ctrlPressedRef = useRef(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Control") {
        ctrlPressedRef.current = true;
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Control") {
        ctrlPressedRef.current = false;
      }
    }

    function handleWindowBlur() {
      ctrlPressedRef.current = false;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  useEffect(() => {
    const timelineElement = timelineTracksRef.current;
    if (!timelineElement) {
      return;
    }

    function handleNativeWheel(event: globalThis.WheelEvent) {
      const isExplicitCtrlZoom = event.ctrlKey && ctrlPressedRef.current;
      if (!isExplicitCtrlZoom || isScrubbing || event.buttons !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      applyTimelineWheelZoom(event.deltaY, event.clientX);
    }

    timelineElement.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      timelineElement.removeEventListener("wheel", handleNativeWheel);
    };
  }, [applyTimelineWheelZoom, isScrubbing, timelineTracksRef]);
}
