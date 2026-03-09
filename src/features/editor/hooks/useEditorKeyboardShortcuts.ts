"use client";

import { useEffect } from "react";
import { keyboardSeekStep } from "../model/constants";
import { isTypingTarget } from "../lib/utils";

type Params = {
  togglePlay: () => void;
  seekBy: (deltaSeconds: number) => void;
  splitSelectedTimelineTrack: () => void;
  deleteSelectedTimelineTrack: () => void;
};

export function useEditorKeyboardShortcuts({
  togglePlay,
  seekBy,
  splitSelectedTimelineTrack,
  deleteSelectedTimelineTrack,
}: Params) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekBy(-keyboardSeekStep);
        return;
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        seekBy(keyboardSeekStep);
        return;
      }

      if (event.code === "KeyB") {
        event.preventDefault();
        splitSelectedTimelineTrack();
        return;
      }

      if (event.code === "Backspace" || event.code === "Delete") {
        event.preventDefault();
        deleteSelectedTimelineTrack();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteSelectedTimelineTrack, seekBy, splitSelectedTimelineTrack, togglePlay]);
}

