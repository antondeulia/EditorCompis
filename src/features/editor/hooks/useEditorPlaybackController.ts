"use client";

import {
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PlayerRef } from "@remotion/player";
import {
  maxTimelineZoom,
  minTimelineZoom,
  timelineExtensionChunkSeconds,
  timelineExtensionThresholdRatio,
  timelineScaleBase,
  timelineScaleSpan,
  transportSeekStep,
  wheelZoomStep,
} from "../model/constants";
import { clamp } from "../lib/utils";
import { VideoSchema } from "../model/schema";
import { CompositionViewport } from "../model/types";

type Params = {
  playerRef: RefObject<PlayerRef | null>;
  previewCanvasRef: RefObject<HTMLDivElement | null>;
  scrubZoneRef: RefObject<HTMLButtonElement | null>;
  timelineMainRef: RefObject<HTMLDivElement | null>;
  timelineTracksRef: RefObject<HTMLDivElement | null>;
  videoSchema: VideoSchema;
};

type TimelineRulerMark = {
  frame: number;
  timeSeconds: number;
  label: string;
};

function formatTimelineRulerLabel(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function useEditorPlaybackController({
  playerRef,
  previewCanvasRef,
  scrubZoneRef,
  timelineMainRef,
  timelineTracksRef,
  videoSchema,
}: Params) {
  const pendingTimelineScrollLeftRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(38);
  const [timelineExtraFrames, setTimelineExtraFrames] = useState(0);
  const [timelinePlayheadMetrics, setTimelinePlayheadMetrics] = useState({ offsetLeft: 0, width: 1 });
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
  const [compositionViewport, setCompositionViewport] = useState<CompositionViewport>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    scale: 1,
  });

  const durationInFrames = videoSchema.durationInFrames;
  const fps = videoSchema.fps;
  const baseTimelineFrameSpan = useMemo(() => durationInFrames, [durationInFrames]);
  const timelineFrameSpan = baseTimelineFrameSpan + timelineExtraFrames;
  const timelineDurationSeconds = timelineFrameSpan / fps;
  const currentTime = currentFrame / fps;
  const progress = timelineFrameSpan > 0 ? clamp(currentFrame / timelineFrameSpan, 0, 1) : 0;
  const timelineZoomScale = timelineScaleBase + (timelineZoom / 100) * timelineScaleSpan;
  const timelineSpanRatio = durationInFrames > 0 ? timelineFrameSpan / durationInFrames : 1;
  const timelineContentWidth = `${timelineZoomScale * timelineSpanRatio * 100}%`;
  const playheadLeftPx = clamp(
    timelinePlayheadMetrics.offsetLeft + progress * timelinePlayheadMetrics.width,
    timelinePlayheadMetrics.offsetLeft,
    timelinePlayheadMetrics.offsetLeft + timelinePlayheadMetrics.width,
  );
  const timelineRulerMarks = useMemo<TimelineRulerMark[]>(() => {
    if (timelineDurationSeconds <= 0) {
      return [{ frame: 0, timeSeconds: 0, label: formatTimelineRulerLabel(0) }];
    }

    const majorStepSeconds = 5;
    const marks: TimelineRulerMark[] = [];

    for (let second = 0; second <= timelineDurationSeconds + 0.0001; second += majorStepSeconds) {
      const frame = Math.min(Math.round(second * fps), Math.max(timelineFrameSpan - 1, 0));
      marks.push({
        frame,
        timeSeconds: second,
        label: formatTimelineRulerLabel(second),
      });
    }

    if (marks.length === 0 || marks[marks.length - 1].frame !== Math.max(timelineFrameSpan - 1, 0)) {
      marks.push({
        frame: Math.max(timelineFrameSpan - 1, 0),
        timeSeconds: timelineDurationSeconds,
        label: formatTimelineRulerLabel(timelineDurationSeconds),
      });
    }

    return marks;
  }, [fps, timelineDurationSeconds, timelineFrameSpan]);

  const seekToFrame = useCallback(
    (nextFrame: number) => {
      const player = playerRef.current;
      if (!player) {
        return;
      }

      const boundedFrame = clamp(Math.floor(nextFrame), 0, Math.max(durationInFrames - 1, 0));
      player.seekTo(boundedFrame);
      setCurrentFrame(boundedFrame);
    },
    [durationInFrames, playerRef],
  );

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const deltaFrames = Math.round(deltaSeconds * fps);
      seekToFrame(currentFrame + deltaFrames);
    },
    [currentFrame, fps, seekToFrame],
  );

  const rewind = useCallback(() => {
    seekBy(-transportSeekStep);
  }, [seekBy]);

  const forward = useCallback(() => {
    seekBy(transportSeekStep);
  }, [seekBy]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    if (isPlaying) {
      player.pause();
      return;
    }

    player.play();
  }, [isPlaying, playerRef]);

  const handleSeek = useCallback(
    (nextTime: number) => {
      seekToFrame(nextTime * fps);
    },
    [fps, seekToFrame],
  );

  const handleTimelineZoomChange = useCallback((nextZoom: number) => {
    setTimelineZoom(clamp(nextZoom, minTimelineZoom, maxTimelineZoom));
  }, []);

  const adjustTimelineZoom = useCallback((delta: number) => {
    setTimelineZoom((prev) => clamp(prev + delta, minTimelineZoom, maxTimelineZoom));
  }, []);

  const applyTimelineWheelZoom = useCallback(
    (deltaY: number, clientX: number) => {
      const timelineElement = timelineTracksRef.current;
      if (!timelineElement) {
        return;
      }

      const rect = timelineElement.getBoundingClientRect();
      const mouseX = clamp(clientX - rect.left, 0, rect.width);
      const minScale = timelineScaleBase + (minTimelineZoom / 100) * timelineScaleSpan;
      const maxScale = timelineScaleBase + (maxTimelineZoom / 100) * timelineScaleSpan;
      const oldScale = timelineScaleBase + (timelineZoom / 100) * timelineScaleSpan;
      const zoomFactor = Math.exp(-deltaY * wheelZoomStep);
      const newScale = clamp(oldScale * zoomFactor, minScale, maxScale);

      if (Math.abs(newScale - oldScale) < 0.0001) {
        return;
      }

      const timeUnderCursor = (timelineElement.scrollLeft + mouseX) / oldScale;
      const nextScrollLeft = Math.max(0, timeUnderCursor * newScale - mouseX);
      pendingTimelineScrollLeftRef.current = nextScrollLeft;

      const nextZoom = ((newScale - timelineScaleBase) / timelineScaleSpan) * 100;
      setTimelineZoom(clamp(nextZoom, minTimelineZoom, maxTimelineZoom));
    },
    [timelineTracksRef, timelineZoom],
  );

  const recalcCompositionViewport = useCallback(() => {
    const container = previewCanvasRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    const aspect = videoSchema.width / videoSchema.height;

    let fittedWidth = width;
    let fittedHeight = width / aspect;

    if (fittedHeight > height) {
      fittedHeight = height;
      fittedWidth = height * aspect;
    }

    const offsetX = (width - fittedWidth) / 2;
    const offsetY = (height - fittedHeight) / 2;

    setCompositionViewport({
      left: offsetX,
      top: offsetY,
      width: fittedWidth,
      height: fittedHeight,
      scale: fittedWidth / videoSchema.width,
    });
  }, [previewCanvasRef, videoSchema.height, videoSchema.width]);

  const toCompositionCoordinates = useCallback(
    (clientX: number, clientY: number) => {
      const container = previewCanvasRef.current;
      if (!container || compositionViewport.width <= 0 || compositionViewport.height <= 0) {
        return null;
      }

      const rect = container.getBoundingClientRect();
      const x =
        (clientX - (rect.left + compositionViewport.left)) / Math.max(compositionViewport.scale, 0.0001);
      const y =
        (clientY - (rect.top + compositionViewport.top)) / Math.max(compositionViewport.scale, 0.0001);

      return { x, y };
    },
    [compositionViewport, previewCanvasRef],
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const scrubZoneElement = scrubZoneRef.current;

      if (!scrubZoneElement || timelineDurationSeconds <= 0) {
        return;
      }

      const scrubZoneRect = scrubZoneElement.getBoundingClientRect();
      const ratio = clamp((clientX - scrubZoneRect.left) / Math.max(scrubZoneRect.width, 1), 0, 1);
      handleSeek(ratio * timelineDurationSeconds);
    },
    [handleSeek, scrubZoneRef, timelineDurationSeconds],
  );

  const beginScrub = useCallback(
    (clientX: number) => {
      seekFromClientX(clientX);
      setIsScrubbing(true);
    },
    [seekFromClientX],
  );

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onFrameUpdate = ({ detail }: { detail: { frame: number } }) => setCurrentFrame(detail.frame);

    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);
    player.addEventListener("frameupdate", onFrameUpdate);

    setIsPlaying(player.isPlaying());
    setCurrentFrame(player.getCurrentFrame());

    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
      player.removeEventListener("frameupdate", onFrameUpdate);
    };
  }, [playerRef]);

  useLayoutEffect(() => {
    recalcCompositionViewport();

    const container = previewCanvasRef.current;
    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      recalcCompositionViewport();
    });

    resizeObserver.observe(container);
    window.addEventListener("resize", recalcCompositionViewport);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", recalcCompositionViewport);
    };
  }, [previewCanvasRef, recalcCompositionViewport]);

  useLayoutEffect(() => {
    const timelineElement = timelineTracksRef.current;
    const timelineMainElement = timelineMainRef.current;
    const scrubZoneElement = scrubZoneRef.current;

    if (!timelineElement || !timelineMainElement || !scrubZoneElement) {
      return;
    }

    function updatePlayheadMetrics() {
      const scrubRect = scrubZoneElement.getBoundingClientRect();
      const mainRect = timelineMainElement.getBoundingClientRect();
      const nextOffsetLeft = scrubRect.left - mainRect.left;
      const nextWidth = Math.max(scrubRect.width, 1);
      const nextScrollLeft = timelineElement.scrollLeft;

      setTimelinePlayheadMetrics((prev) => {
        if (Math.abs(prev.offsetLeft - nextOffsetLeft) < 0.5 && Math.abs(prev.width - nextWidth) < 0.5) {
          return prev;
        }

        return {
          offsetLeft: nextOffsetLeft,
          width: nextWidth,
        };
      });
      setTimelineScrollLeft((prev) => (Math.abs(prev - nextScrollLeft) < 0.5 ? prev : nextScrollLeft));
    }

    updatePlayheadMetrics();
    timelineElement.addEventListener("scroll", updatePlayheadMetrics, { passive: true });
    window.addEventListener("resize", updatePlayheadMetrics);

    return () => {
      timelineElement.removeEventListener("scroll", updatePlayheadMetrics);
      window.removeEventListener("resize", updatePlayheadMetrics);
    };
  }, [scrubZoneRef, timelineMainRef, timelineTracksRef, timelineZoom]);

  useEffect(() => {
    const timelineElement = timelineTracksRef.current;
    if (!timelineElement) {
      return;
    }

    function handleNativeWheel(event: globalThis.WheelEvent) {
      if (!event.ctrlKey) {
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
  }, [applyTimelineWheelZoom, timelineTracksRef]);

  useLayoutEffect(() => {
    const timelineElement = timelineTracksRef.current;
    const pendingScrollLeft = pendingTimelineScrollLeftRef.current;

    if (!timelineElement || pendingScrollLeft === null) {
      return;
    }

    const maxScrollLeft = Math.max(0, timelineElement.scrollWidth - timelineElement.clientWidth);
    timelineElement.scrollLeft = clamp(pendingScrollLeft, 0, maxScrollLeft);
    pendingTimelineScrollLeftRef.current = null;
  }, [timelineTracksRef, timelineZoom]);

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
  }, [fps, timelineFrameSpan, timelineTracksRef]);

  useEffect(() => {
    if (!isScrubbing) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      seekFromClientX(event.clientX);
    }

    function stopScrub() {
      setIsScrubbing(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopScrub);
    window.addEventListener("pointercancel", stopScrub);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopScrub);
      window.removeEventListener("pointercancel", stopScrub);
    };
  }, [isScrubbing, seekFromClientX]);

  return {
    isPlaying,
    currentFrame,
    timelineZoom,
    durationInFrames,
    fps,
    currentTime,
    timelineFrameSpan,
    timelineDurationSeconds,
    timelineZoomScale,
    timelineContentWidth,
    timelineScrollLeft,
    timelineRulerMarks,
    playheadLeftPx,
    compositionViewport,
    seekToFrame,
    seekBy,
    togglePlay,
    rewind,
    forward,
    handleSeek,
    handleTimelineZoomChange,
    adjustTimelineZoom,
    beginScrub,
    toCompositionCoordinates,
  };
}
