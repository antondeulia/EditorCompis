"use client";

import { Dispatch, SetStateAction, useEffect } from "react";

type Params = {
  isScrubbing: boolean;
  seekFromClientX: (clientX: number) => void;
  setIsScrubbing: Dispatch<SetStateAction<boolean>>;
  setScrubPreviewProgress: Dispatch<SetStateAction<number | null>>;
  setScrubPreviewLeftPx: Dispatch<SetStateAction<number | null>>;
};

export function useTimelineScrubbingEffect({
  isScrubbing,
  seekFromClientX,
  setIsScrubbing,
  setScrubPreviewProgress,
  setScrubPreviewLeftPx,
}: Params) {
  useEffect(() => {
    if (!isScrubbing) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      seekFromClientX(event.clientX);
    }

    function stopScrub() {
      setIsScrubbing(false);
      setScrubPreviewProgress(null);
      setScrubPreviewLeftPx(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopScrub);
    window.addEventListener("pointercancel", stopScrub);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopScrub);
      window.removeEventListener("pointercancel", stopScrub);
    };
  }, [isScrubbing, seekFromClientX, setIsScrubbing, setScrubPreviewLeftPx, setScrubPreviewProgress]);
}
