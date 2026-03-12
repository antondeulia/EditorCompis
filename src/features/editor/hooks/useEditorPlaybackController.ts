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
  timelineScaleBase,
  timelineScaleSpan,
  transportSeekStep,
  wheelZoomStep,
} from "../model/constants";
import { clamp } from "../lib/utils";
import { VideoSchema } from "../model/schema";
import { CompositionViewport } from "../model/types";
import { buildTimelineRulerMarks, TimelineRulerMark } from "./buildTimelineRulerMarks";
import { useTimelineWheelZoomHotkey } from "./useTimelineWheelZoomHotkey";
import { useTimelineAutoExtend } from "./useTimelineAutoExtend";
import { useTimelineScrubbingEffect } from "./useTimelineScrubbingEffect";

type Params = {
  playerRef: RefObject<PlayerRef | null>;
  previewCanvasRef: RefObject<HTMLDivElement | null>;
  scrubZoneRef: RefObject<HTMLButtonElement | null>;
  timelineMainRef: RefObject<HTMLDivElement | null>;
  timelineTracksRef: RefObject<HTMLDivElement | null>;
  videoSchema: VideoSchema;
};

export function useEditorPlaybackController({
  playerRef,
  previewCanvasRef,
  scrubZoneRef,
  timelineMainRef,
  timelineTracksRef,
  videoSchema,
}: Params) {
  const pendingTimelineScrollLeftRef = useRef<number | null>(null);
  const timelineDetachedFromPlayerRef = useRef(false);
  const previousDurationInFramesRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPreviewProgress, setScrubPreviewProgress] = useState<number | null>(null);
  const [scrubPreviewLeftPx, setScrubPreviewLeftPx] = useState<number | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(38);
  const [timelineAutoScaleCompensation, setTimelineAutoScaleCompensation] = useState(1);
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

  const fps = useMemo(() => {
    if (Number.isFinite(videoSchema.fps) && videoSchema.fps > 0) {
      return Math.round(videoSchema.fps);
    }

    return 30;
  }, [videoSchema.fps]);

  const inferredDurationInFrames = useMemo(() => {
    const sceneMax = (videoSchema.scenes ?? []).reduce((maxFrame, scene) => {
      const start = Number.isFinite(scene.startFrame) ? Math.max(0, Math.round(scene.startFrame)) : 0;
      const duration = Number.isFinite(scene.durationInFrames) ? Math.max(0, Math.round(scene.durationInFrames)) : 0;
      return Math.max(maxFrame, start + duration);
    }, 0);

    const masterAudioMax = (videoSchema.audioTracks ?? []).reduce((maxFrame, track) => {
      const start = Number.isFinite(track.startFrame) ? Math.max(0, Math.round(track.startFrame)) : 0;
      const duration = Number.isFinite(track.durationInFrames) ? Math.max(0, Math.round(track.durationInFrames)) : 0;
      return Math.max(maxFrame, start + duration);
    }, 0);

    return Math.max(sceneMax, masterAudioMax);
  }, [videoSchema.audioTracks, videoSchema.scenes]);

  const durationInFrames = useMemo(() => {
    if (Number.isFinite(videoSchema.durationInFrames) && videoSchema.durationInFrames > 0) {
      return Math.round(videoSchema.durationInFrames);
    }

    if (inferredDurationInFrames > 0) {
      return inferredDurationInFrames;
    }

    return fps * 5;
  }, [fps, inferredDurationInFrames, videoSchema.durationInFrames]);
  const baseTimelineFrameSpan = useMemo(() => durationInFrames, [durationInFrames]);
  const timelineFrameSpan = baseTimelineFrameSpan + timelineExtraFrames;
  const maxTimelineFrame = Math.max(timelineFrameSpan - 1, 0);
  const timelineDurationSeconds = timelineFrameSpan / fps;
  const currentTime = currentFrame / fps;
  const progress = maxTimelineFrame > 0 ? clamp(currentFrame / maxTimelineFrame, 0, 1) : 0;
  const visiblePlayheadProgress = scrubPreviewProgress ?? progress;
  const timelineManualZoomScale = timelineScaleBase + (timelineZoom / 100) * timelineScaleSpan;
  const timelineZoomScale = timelineManualZoomScale * timelineAutoScaleCompensation;
  const timelineSpanRatio = durationInFrames > 0 ? timelineFrameSpan / durationInFrames : 1;
  const timelineContentWidth = `${timelineZoomScale * timelineSpanRatio * 100}%`;
  const playheadLeftPx = clamp(
    scrubPreviewLeftPx ?? (timelinePlayheadMetrics.offsetLeft + visiblePlayheadProgress * timelinePlayheadMetrics.width),
    timelinePlayheadMetrics.offsetLeft,
    timelinePlayheadMetrics.offsetLeft + timelinePlayheadMetrics.width,
  );
  const timelineRulerMarks = useMemo<TimelineRulerMark[]>(
    () => buildTimelineRulerMarks(fps, timelineDurationSeconds, timelineFrameSpan),
    [fps, timelineDurationSeconds, timelineFrameSpan],
  );

  const seekToFrame = useCallback(
    (nextFrame: number, options?: { allowTimelineOverflow?: boolean }) => {
      const player = playerRef.current;
      if (!player) {
        return;
      }

      const maxMediaFrame = Math.max(durationInFrames - 1, 0);
      const maxAllowedTimelineFrame = Math.max(timelineFrameSpan - 1, 0);
      const boundedTimelineFrame = clamp(Math.round(nextFrame), 0, maxAllowedTimelineFrame);
      if (options?.allowTimelineOverflow && boundedTimelineFrame > maxMediaFrame) {
        // Allow manual playhead moves in the extended timeline while keeping player on the last real frame.
        timelineDetachedFromPlayerRef.current = true;
        player.seekTo(maxMediaFrame);
        setCurrentFrame(boundedTimelineFrame);
        return;
      }

      timelineDetachedFromPlayerRef.current = false;
      const boundedFrame = clamp(boundedTimelineFrame, 0, maxMediaFrame);
      player.seekTo(boundedFrame);
      setCurrentFrame(boundedFrame);
    },
    [durationInFrames, playerRef, timelineFrameSpan],
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

    timelineDetachedFromPlayerRef.current = false;
    const maxMediaFrame = Math.max(durationInFrames - 1, 0);
    if (currentFrame > maxMediaFrame) {
      player.seekTo(maxMediaFrame);
      setCurrentFrame(maxMediaFrame);
    }

    player.play();
  }, [currentFrame, durationInFrames, isPlaying, playerRef]);

  const handleSeek = useCallback((nextTime: number) => {
    if (timelineDurationSeconds <= 0) {
      seekToFrame(0, { allowTimelineOverflow: true });
      return;
    }

    const ratio = clamp(nextTime / timelineDurationSeconds, 0, 1);
    seekToFrame(ratio * maxTimelineFrame, { allowTimelineOverflow: true });
  }, [maxTimelineFrame, seekToFrame, timelineDurationSeconds]);

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
      const minManualScale = timelineScaleBase + (minTimelineZoom / 100) * timelineScaleSpan;
      const maxManualScale = timelineScaleBase + (maxTimelineZoom / 100) * timelineScaleSpan;
      const oldManualScale = timelineScaleBase + (timelineZoom / 100) * timelineScaleSpan;
      const zoomFactor = Math.exp(-deltaY * wheelZoomStep);
      const newManualScale = clamp(oldManualScale * zoomFactor, minManualScale, maxManualScale);
      const oldEffectiveScale = oldManualScale * timelineAutoScaleCompensation;
      const newEffectiveScale = newManualScale * timelineAutoScaleCompensation;

      if (Math.abs(newEffectiveScale - oldEffectiveScale) < 0.0001) {
        return;
      }

      const timeUnderCursor = (timelineElement.scrollLeft + mouseX) / oldEffectiveScale;
      const nextScrollLeft = Math.max(0, timeUnderCursor * newEffectiveScale - mouseX);
      pendingTimelineScrollLeftRef.current = nextScrollLeft;

      const nextZoom = ((newManualScale - timelineScaleBase) / timelineScaleSpan) * 100;
      setTimelineZoom(clamp(nextZoom, minTimelineZoom, maxTimelineZoom));
    },
    [timelineAutoScaleCompensation, timelineTracksRef, timelineZoom],
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

    const roundedWidth = Math.round(fittedWidth);
    const roundedHeight = Math.round(fittedHeight);
    const offsetX = Math.round((width - roundedWidth) / 2);
    const offsetY = Math.round((height - roundedHeight) / 2);

    setCompositionViewport({
      left: offsetX,
      top: offsetY,
      width: roundedWidth,
      height: roundedHeight,
      scale: roundedWidth / videoSchema.width,
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
      const timelineMainRect = timelineMainRef.current?.getBoundingClientRect();
      const ratio = clamp((clientX - scrubZoneRect.left) / Math.max(scrubZoneRect.width, 1), 0, 1);
      setScrubPreviewProgress(ratio);
      if (timelineMainRect) {
        setScrubPreviewLeftPx(clientX - timelineMainRect.left);
      }
      seekToFrame(ratio * maxTimelineFrame, { allowTimelineOverflow: true });
    },
    [maxTimelineFrame, scrubZoneRef, seekToFrame, timelineDurationSeconds, timelineMainRef],
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
    const onFrameUpdate = ({ detail }: { detail: { frame: number } }) => {
      if (timelineDetachedFromPlayerRef.current) {
        return;
      }
      setCurrentFrame(detail.frame);
    };

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
    const previousDuration = previousDurationInFramesRef.current;
    if (previousDuration === null || previousDuration <= 0) {
      previousDurationInFramesRef.current = durationInFrames;
      return;
    }

    if (previousDuration === durationInFrames) {
      return;
    }

    // Compensate schema duration deltas without touching user zoom state,
    // so dragging/releasing clips cannot cause visible zoom jumps.
    setTimelineAutoScaleCompensation((prevCompensation) => {
      return prevCompensation * (durationInFrames / previousDuration);
    });
    previousDurationInFramesRef.current = durationInFrames;
  }, [durationInFrames]);

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
  }, [scrubZoneRef, timelineMainRef, timelineTracksRef, timelineFrameSpan, timelineZoom]);

  useTimelineWheelZoomHotkey({
    timelineTracksRef,
    isScrubbing,
    applyTimelineWheelZoom,
  });

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

  useTimelineAutoExtend({
    fps,
    timelineFrameSpan,
    timelineTracksRef,
    setTimelineExtraFrames,
  });

  useTimelineScrubbingEffect({
    isScrubbing,
    seekFromClientX,
    setIsScrubbing,
    setScrubPreviewProgress,
    setScrubPreviewLeftPx,
  });

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
