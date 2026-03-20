import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const useTimelinePlayback = ({
  durationFrames,
  frameRate,
  isScrubbing,
}: {
  durationFrames: number;
  frameRate: number;
  isScrubbing: boolean;
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  const rafIdRef = useRef<number | null>(null);
  const playbackStartPerfRef = useRef(0);
  const currentTimeMsRef = useRef(currentTimeMs);

  useEffect(() => {
    currentTimeMsRef.current = currentTimeMs;
  }, [currentTimeMs]);

  const totalDurationMs = useMemo(
    () => (durationFrames / frameRate) * 1000,
    [durationFrames, frameRate],
  );

  useEffect(() => {
    if (!isPlaying || isScrubbing) {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    playbackStartPerfRef.current = performance.now() - currentTimeMsRef.current;

    const updatePlayback = (now: number) => {
      const nextTimeMs = Math.min(now - playbackStartPerfRef.current, totalDurationMs);
      setCurrentTimeMs(nextTimeMs);

      if (nextTimeMs >= totalDurationMs) {
        setIsPlaying(false);
        return;
      }

      rafIdRef.current = window.requestAnimationFrame(updatePlayback);
    };

    rafIdRef.current = window.requestAnimationFrame(updatePlayback);

    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isPlaying, isScrubbing, totalDurationMs]);

  const currentFrame = useMemo(() => {
    if (totalDurationMs <= 0) {
      return 0;
    }

    return (currentTimeMs / totalDurationMs) * durationFrames;
  }, [currentTimeMs, durationFrames, totalDurationMs]);

  const frameStepMs = useMemo(() => 1000 / frameRate, [frameRate]);

  const togglePlayback = useCallback(() => {
    setIsPlaying((current) => {
      if (current) {
        return false;
      }

      setCurrentTimeMs((timeMs) => (timeMs >= totalDurationMs ? 0 : timeMs));
      return true;
    });
  }, [totalDurationMs]);

  return {
    currentFrame,
    currentTimeMs,
    frameStepMs,
    isPlaying,
    setCurrentTimeMs,
    setIsPlaying,
    togglePlayback,
    totalDurationMs,
  };
};
