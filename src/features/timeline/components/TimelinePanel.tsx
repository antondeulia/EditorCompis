"use client";

import {
  DragEvent as ReactDragEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  SidebarTimelineItem,
  clearCurrentTimelineDragItem,
  parseTimelineDragItemFromDataTransfer,
} from "@/features/timeline/lib/dragTransfer";
import { TIMELINE_LAYOUT } from "@/features/timeline/constants/timelineLayout";
import {
  TimelineClip,
  TimelineSequence,
  TimelineTrack,
  TimelineTrackType,
} from "@/features/timeline/types/timeline";

import { TimelinePreview } from "./TimelinePreview";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineToolbar } from "./TimelineToolbar";
import { TimelineTrackList } from "./TimelineTrackList";
import styles from "./TimelinePanel.module.css";

interface TimelinePanelProps {
  sequence: TimelineSequence;
  onSequenceChange?: (nextSequence: TimelineSequence) => void;
}

export type TimelineInteractionMode = "move" | "resize-left" | "resize-right";

export interface TimelineDragState {
  clip: TimelineClip;
  mode: TimelineInteractionMode;
  sourceTrackId: string;
  sourceTrackIndex: number;
  targetTrackIndex: number;
  startPointerX: number;
  startPointerY: number;
  currentPointerY: number;
  pointerOffsetX: number;
  previewStartFrame: number;
  previewDurationFrames: number;
}

export interface TimelineExternalPreview {
  trackIndex: number;
  startFrame: number;
  durationFrames: number;
  label: string;
  mediaType: TimelineTrackType;
  source: "asset" | "element";
  mediaUrl?: string;
}

const MIN_CLIP_DURATION_FRAMES = 6;
const SNAP_THRESHOLD_PX = 10;
const RESIZE_HIT_ZONE_HEIGHT_PX = 8;
const MIN_TIMELINE_HEIGHT_PX = 180;
const MIN_PREVIEW_HEIGHT_PX = 120;
const DEFAULT_TIMELINE_HEIGHT_PX = 280;

const clamp = (value: number, min: number, max: number) => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const getPreviewDefaultsForItem = (item: SidebarTimelineItem) => {
  if (typeof item.previewX === "number" && typeof item.previewY === "number" && typeof item.previewWidth === "number" && typeof item.previewHeight === "number") {
    return {
      previewX: clamp(item.previewX, 0, 0.92),
      previewY: clamp(item.previewY, 0, 0.92),
      previewWidth: clamp(item.previewWidth, 0.08, 1),
      previewHeight: clamp(item.previewHeight, 0.08, 1),
    };
  }

  if (item.source === "asset" && item.mediaType === "video") {
    return {
      previewX: 0,
      previewY: 0,
      previewWidth: 1,
      previewHeight: 1,
    };
  }

  const loweredLabel = item.label.toLowerCase();

  if (loweredLabel.includes("subtitle")) {
    return {
      previewX: 0.1,
      previewY: 0.78,
      previewWidth: 0.8,
      previewHeight: 0.14,
    };
  }

  if (loweredLabel.includes("h1") || loweredLabel.includes("hero")) {
    return {
      previewX: 0.1,
      previewY: 0.08,
      previewWidth: 0.8,
      previewHeight: 0.2,
    };
  }

  return {
    previewX: 0.2,
    previewY: 0.2,
    previewWidth: 0.6,
    previewHeight: 0.22,
  };
};
const collectSnapFrames = (
  tracks: TimelineTrack[],
  sequenceDurationFrames: number,
  excludedClipIds: Set<string>,
): number[] => {
  const frames = new Set<number>([0, sequenceDurationFrames]);

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (excludedClipIds.has(clip.id)) {
        continue;
      }

      frames.add(clip.startFrame);
      frames.add(clip.startFrame + clip.durationFrames);
    }
  }

  return Array.from(frames);
};

const getBestSnap = (
  anchors: number[],
  candidates: number[],
  thresholdFrames: number,
): { offsetFrames: number; guideFrame: number | null } => {
  let bestOffset: number | null = null;
  let bestGuideFrame: number | null = null;

  for (const anchor of anchors) {
    for (const candidate of candidates) {
      const offsetFrames = candidate - anchor;
      if (Math.abs(offsetFrames) > thresholdFrames) {
        continue;
      }

      if (bestOffset === null || Math.abs(offsetFrames) < Math.abs(bestOffset)) {
        bestOffset = offsetFrames;
        bestGuideFrame = candidate;
      }
    }
  }

  return {
    offsetFrames: bestOffset ?? 0,
    guideFrame: bestGuideFrame,
  };
};

const updateTracksForDrop = (
  tracks: TimelineTrack[],
  dragState: TimelineDragState,
): TimelineTrack[] => {
  const droppedClip: TimelineClip = {
    ...dragState.clip,
    startFrame: dragState.previewStartFrame,
    durationFrames: dragState.previewDurationFrames,
  };

  const tracksWithoutClip = tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((clip) => clip.id !== dragState.clip.id),
  }));

  return tracksWithoutClip.map((track, trackIndex) => {
    if (trackIndex !== dragState.targetTrackIndex) {
      return track;
    }

    return {
      ...track,
      clips: [...track.clips, droppedClip].sort((a, b) => a.startFrame - b.startFrame),
    };
  });
};

const parseExternalDropItem = (
  event: ReactDragEvent<HTMLDivElement>,
): SidebarTimelineItem | null => parseTimelineDragItemFromDataTransfer(event.dataTransfer);

export const TimelinePanel = ({ sequence, onSequenceChange }: TimelinePanelProps) => {
  const [tracks, setTracks] = useState<TimelineTrack[]>(sequence.tracks);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [lastSelectedClipId, setLastSelectedClipId] = useState<string | null>(null);
  const [dropTargetTrackIndex, setDropTargetTrackIndex] = useState<number | null>(null);
  const [externalPreview, setExternalPreview] = useState<TimelineExternalPreview | null>(null);
  const [snapGuideFrame, setSnapGuideFrame] = useState<number | null>(null);
  const [dragState, setDragState] = useState<TimelineDragState | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [timelineHeightPx, setTimelineHeightPx] = useState(DEFAULT_TIMELINE_HEIGHT_PX);

  const timelinePanelRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
  const trackListRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const playbackStartPerfRef = useRef<number>(0);
  const currentTimeMsRef = useRef<number>(0);

  useEffect(() => {
    currentTimeMsRef.current = currentTimeMs;
  }, [currentTimeMs] );
  useEffect(() => {
    if (!onSequenceChange) {
      return;
    }

    onSequenceChange({
      ...sequence,
      tracks,
    });
  }, [onSequenceChange, sequence, tracks]);

  const totalDurationMs = useMemo(
    () => (sequence.durationFrames / sequence.frameRate) * 1000,
    [sequence.durationFrames, sequence.frameRate],
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

  useEffect(() => {
    const clearSelectionOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest("[data-clip-block=\"true\"]")) {
        return;
      }

      setSelectedClipIds([]);
      setLastSelectedClipId(null);
    };

    window.addEventListener("pointerdown", clearSelectionOnOutsideClick);

    return () => {
      window.removeEventListener("pointerdown", clearSelectionOnOutsideClick);
    };
  }, []);

  useEffect(() => {
    if (!viewportRef.current) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setViewportWidth(entry.contentRect.width);
    });

    observer.observe(viewportRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    const panelElement = timelinePanelRef.current;
    if (!panelElement) {
      return;
    }

    const syncTimelineHeight = () => {
      const panelRect = panelElement.getBoundingClientRect();
      const maxTimelineHeightPx = Math.max(
        panelRect.height - MIN_PREVIEW_HEIGHT_PX,
        MIN_TIMELINE_HEIGHT_PX,
      );

      setTimelineHeightPx((current) =>
        clamp(current, MIN_TIMELINE_HEIGHT_PX, maxTimelineHeightPx),
      );
    };

    syncTimelineHeight();

    const observer = new ResizeObserver(() => {
      syncTimelineHeight();
    });

    observer.observe(panelElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  const maxTrackIndex = useMemo(() => Math.max(tracks.length - 1, 0), [tracks.length]);

  const clipIdOrder = useMemo(() => {
    return tracks.flatMap((track) =>
      [...track.clips]
        .sort((a, b) => a.startFrame - b.startFrame)
        .map((clip) => clip.id),
    );
  }, [tracks]);

  const framePixelRatio = useMemo(() => {
    const baseLaneWidth = sequence.durationFrames * TIMELINE_LAYOUT.framePixelRatio;
    const laneWidthFromViewport = Math.max(
      viewportWidth - TIMELINE_LAYOUT.labelColumnWidth,
      baseLaneWidth,
    );

    if (sequence.durationFrames <= 0) {
      return TIMELINE_LAYOUT.framePixelRatio;
    }

    return laneWidthFromViewport / sequence.durationFrames;
  }, [sequence.durationFrames, viewportWidth]);

  const timelineCanvasWidth = useMemo(() => {
    const laneWidth = framePixelRatio * sequence.durationFrames;
    return TIMELINE_LAYOUT.labelColumnWidth + laneWidth;
  }, [framePixelRatio, sequence.durationFrames]);

  const currentFrame = useMemo(() => {
    if (totalDurationMs <= 0) {
      return 0;
    }

    return (currentTimeMs / totalDurationMs) * sequence.durationFrames;
  }, [currentTimeMs, sequence.durationFrames, totalDurationMs]);

  const playheadOffsetPx = useMemo(
    () => clamp(currentFrame * framePixelRatio, 0, sequence.durationFrames * framePixelRatio),
    [currentFrame, framePixelRatio, sequence.durationFrames],
  );

  const updateTimeFromClientX = useCallback(
    (clientX: number) => {
      const canvasRect = timelineCanvasRef.current?.getBoundingClientRect();

      if (!canvasRect) {
        return;
      }

      const laneX = clamp(
        clientX - canvasRect.left - TIMELINE_LAYOUT.labelColumnWidth,
        0,
        sequence.durationFrames * framePixelRatio,
      );

      const nextFrame = laneX / framePixelRatio;
      const nextTimeMs = (nextFrame / sequence.frameRate) * 1000;
      setCurrentTimeMs(nextTimeMs);
    },
    [framePixelRatio, sequence.durationFrames, sequence.frameRate],
  );

  const startScrubbing = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragState) {
        return;
      }

      event.preventDefault();
      setIsPlaying(false);
      setIsScrubbing(true);
      setSelectedClipIds([]);
      setLastSelectedClipId(null);
      updateTimeFromClientX(event.clientX);
    },
    [dragState, updateTimeFromClientX],
  );

  const frameStepMs = useMemo(() => 1000 / sequence.frameRate, [sequence.frameRate]);

  const handleTogglePlayback = useCallback(() => {
    setIsPlaying((current) => {
      if (current) {
        return false;
      }

      setCurrentTimeMs((timeMs) => (timeMs >= totalDurationMs ? 0 : timeMs));
      return true;
    });
  }, [totalDurationMs]);

  const handlePanelSplitterPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const toolbarRect = event.currentTarget.getBoundingClientRect();
      const isInResizeHitZone = event.clientY - toolbarRect.top <= RESIZE_HIT_ZONE_HEIGHT_PX;

      if (!isInResizeHitZone) {
        return;
      }
      event.preventDefault();

      const panelElement = timelinePanelRef.current;
      if (!panelElement) {
        return;
      }

      const startY = event.clientY;
      const startTimelineHeightPx = timelineHeightPx;

      const handlePanelResizeMove = (moveEvent: PointerEvent) => {
        const panelRect = panelElement.getBoundingClientRect();
        const deltaY = moveEvent.clientY - startY;
        const maxTimelineHeightPx = Math.max(
          panelRect.height - MIN_PREVIEW_HEIGHT_PX,
          MIN_TIMELINE_HEIGHT_PX,
        );

        setTimelineHeightPx(
          clamp(
            Math.round(startTimelineHeightPx - deltaY),
            MIN_TIMELINE_HEIGHT_PX,
            maxTimelineHeightPx,
          ),
        );
      };

      const handlePanelResizeEnd = () => {
        window.removeEventListener("pointermove", handlePanelResizeMove);
        window.removeEventListener("pointerup", handlePanelResizeEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      window.addEventListener("pointermove", handlePanelResizeMove);
      window.addEventListener("pointerup", handlePanelResizeEnd);

      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [timelineHeightPx],
  );

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.code === "Delete" || event.code === "Backspace") {
        if (selectedClipIds.length === 0) {
          return;
        }

        event.preventDefault();
        const selectedSet = new Set(selectedClipIds);

        setTracks((currentTracks) =>
          currentTracks.map((track) => ({
            ...track,
            clips: track.clips.filter((clip) => !selectedSet.has(clip.id)),
          })),
        );

        setSelectedClipIds([]);
        setLastSelectedClipId(null);
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        setIsPlaying((current) => {
          if (current) {
            return false;
          }

          setCurrentTimeMs((timeMs) => (timeMs >= totalDurationMs ? 0 : timeMs));
          return true;
        });
        return;
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        setIsPlaying(false);
        setCurrentTimeMs((timeMs) => clamp(timeMs - frameStepMs, 0, totalDurationMs));
        return;
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        setIsPlaying(false);
        setCurrentTimeMs((timeMs) => clamp(timeMs + frameStepMs, 0, totalDurationMs));
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [frameStepMs, selectedClipIds, totalDurationMs]);

  const applySelection = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, clipId: string) => {
      const isToggle = event.metaKey || event.ctrlKey;
      const isRange = event.shiftKey;

      setSelectedClipIds((currentSelectedIds) => {
        if (isRange && lastSelectedClipId) {
          const currentIndex = clipIdOrder.indexOf(clipId);
          const anchorIndex = clipIdOrder.indexOf(lastSelectedClipId);

          if (currentIndex >= 0 && anchorIndex >= 0) {
            const from = Math.min(currentIndex, anchorIndex);
            const to = Math.max(currentIndex, anchorIndex);
            return clipIdOrder.slice(from, to + 1);
          }
        }

        if (isToggle) {
          if (currentSelectedIds.includes(clipId)) {
            return currentSelectedIds.filter((id) => id !== clipId);
          }

          return [...currentSelectedIds, clipId];
        }

        return [clipId];
      });

      setLastSelectedClipId(clipId);
      return !(isToggle || isRange);
    },
    [clipIdOrder, lastSelectedClipId],
  );

  const startInteraction = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      clip: TimelineClip,
      trackId: string,
      trackIndex: number,
      mode: TimelineInteractionMode,
    ) => {
      event.preventDefault();

      const clipRect = event.currentTarget.getBoundingClientRect();

      setDragState({
        clip,
        mode,
        sourceTrackId: trackId,
        sourceTrackIndex: trackIndex,
        targetTrackIndex: trackIndex,
        startPointerX: event.clientX,
        startPointerY: event.clientY,
        currentPointerY: event.clientY,
        pointerOffsetX: event.clientX - clipRect.left,
        previewStartFrame: clip.startFrame,
        previewDurationFrames: clip.durationFrames,
      });
    },
    [],
  );

  const handleClipPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      clip: TimelineClip,
      trackId: string,
      trackIndex: number,
    ) => {
      const canStartDrag = applySelection(event, clip.id);

      if (!canStartDrag) {
        return;
      }

      startInteraction(event, clip, trackId, trackIndex, "move");
    },
    [applySelection, startInteraction],
  );

  const handleResizeLeftPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      clip: TimelineClip,
      trackId: string,
      trackIndex: number,
    ) => {
      setSelectedClipIds([clip.id]);
      setLastSelectedClipId(clip.id);
      startInteraction(event, clip, trackId, trackIndex, "resize-left");
    },
    [startInteraction],
  );

  const handleResizeRightPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      clip: TimelineClip,
      trackId: string,
      trackIndex: number,
    ) => {
      setSelectedClipIds([clip.id]);
      setLastSelectedClipId(clip.id);
      startInteraction(event, clip, trackId, trackIndex, "resize-right");
    },
    [startInteraction],
  );

  const handleTrackDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, trackIndex: number) => {
      const draggedItem = parseExternalDropItem(event);
      const track = tracks[trackIndex];

      if (!draggedItem || !track || track.type !== draggedItem.mediaType) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDropTargetTrackIndex(trackIndex);

      const laneRect = event.currentTarget.getBoundingClientRect();
      const laneX = clamp(event.clientX - laneRect.left, 0, sequence.durationFrames * framePixelRatio);
      const clipDurationFrames = clamp(
        Math.round(draggedItem.durationFrames),
        MIN_CLIP_DURATION_FRAMES,
        sequence.durationFrames,
      );
      const maxStartFrame = Math.max(sequence.durationFrames - clipDurationFrames, 0);
      const rawStartFrame = clamp(Math.round(laneX / framePixelRatio), 0, maxStartFrame);

      const snapFrames = collectSnapFrames(tracks, sequence.durationFrames, new Set());
      const thresholdFrames = SNAP_THRESHOLD_PX / framePixelRatio;
      const snap = getBestSnap(
        [rawStartFrame, rawStartFrame + clipDurationFrames],
        snapFrames,
        thresholdFrames,
      );
      const previewStartFrame = clamp(rawStartFrame + snap.offsetFrames, 0, maxStartFrame);

      setExternalPreview({
        trackIndex,
        startFrame: previewStartFrame,
        durationFrames: clipDurationFrames,
        label: draggedItem.label,
        mediaType: draggedItem.mediaType,
        source: draggedItem.source,
        mediaUrl: draggedItem.mediaUrl,
      });

      setSnapGuideFrame(snap.guideFrame);
    },
    [framePixelRatio, sequence.durationFrames, tracks],
  );

  const handleTrackDragLeave = useCallback(
    (trackIndex: number) => {
      setDropTargetTrackIndex((current) => (current === trackIndex ? null : current));
      setExternalPreview((current) => (current?.trackIndex === trackIndex ? null : current));

      if (!dragState) {
        setSnapGuideFrame(null);
      }
    },
    [dragState],
  );

  const handleTrackDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, trackIndex: number) => {
      const draggedItem = parseExternalDropItem(event);
      event.preventDefault();

      if (!draggedItem) {
        setDropTargetTrackIndex(null);
        setExternalPreview(null);
        setSnapGuideFrame(null);
        clearCurrentTimelineDragItem();
        return;
      }

      const clipDurationFrames = clamp(
        Math.round(draggedItem.durationFrames),
        MIN_CLIP_DURATION_FRAMES,
        sequence.durationFrames,
      );

      const laneRect = event.currentTarget.getBoundingClientRect();
      const laneX = clamp(event.clientX - laneRect.left, 0, sequence.durationFrames * framePixelRatio);
      const maxStartFrame = Math.max(sequence.durationFrames - clipDurationFrames, 0);
      const rawStartFrame = clamp(Math.round(laneX / framePixelRatio), 0, maxStartFrame);

      const snapFrames = collectSnapFrames(tracks, sequence.durationFrames, new Set());
      const thresholdFrames = SNAP_THRESHOLD_PX / framePixelRatio;
      const snap = getBestSnap(
        [rawStartFrame, rawStartFrame + clipDurationFrames],
        snapFrames,
        thresholdFrames,
      );
      const startFrame = clamp(rawStartFrame + snap.offsetFrames, 0, maxStartFrame);

      const previewDefaults = getPreviewDefaultsForItem(draggedItem);

      const droppedClip: TimelineClip = {
        id: `clip-drop-${crypto.randomUUID()}`,
        name: draggedItem.label,
        startFrame,
        durationFrames: clipDurationFrames,
        source: draggedItem.source,
        mediaUrl: draggedItem.mediaUrl,
        previewX: previewDefaults.previewX,
        previewY: previewDefaults.previewY,
        previewWidth: previewDefaults.previewWidth,
        previewHeight: previewDefaults.previewHeight,
      };

      setTracks((currentTracks) => {
        const track = currentTracks[trackIndex];
        if (!track || track.type !== draggedItem.mediaType) {
          return currentTracks;
        }

        return currentTracks.map((candidateTrack, candidateIndex) => {
          if (candidateIndex !== trackIndex) {
            return candidateTrack;
          }

          return {
            ...candidateTrack,
            clips: [...candidateTrack.clips, droppedClip].sort((a, b) => a.startFrame - b.startFrame),
          };
        });
      });

      setSelectedClipIds([droppedClip.id]);
      setLastSelectedClipId(droppedClip.id);
      setDropTargetTrackIndex(null);
      setExternalPreview(null);
      setSnapGuideFrame(null);
      clearCurrentTimelineDragItem();
    },
    [framePixelRatio, sequence.durationFrames, tracks],
  );

  const handlePreviewClipSelect = useCallback((clipId: string | null) => {
    if (!clipId) {
      setSelectedClipIds([]);
      setLastSelectedClipId(null);
      return;
    }

    setSelectedClipIds([clipId]);
    setLastSelectedClipId(clipId);
  }, []);

  const handlePreviewClipTransformChange = useCallback(
    (
      clipId: string,
      nextTransform: Pick<TimelineClip, "previewX" | "previewY" | "previewWidth" | "previewHeight">,
    ) => {
      setTracks((currentTracks) =>
        currentTracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId
              ? {
                  ...clip,
                  previewX: clamp(nextTransform.previewX ?? clip.previewX ?? 0, 0, 0.92),
                  previewY: clamp(nextTransform.previewY ?? clip.previewY ?? 0, 0, 0.92),
                  previewWidth: clamp(nextTransform.previewWidth ?? clip.previewWidth ?? 0.6, 0.08, 1),
                  previewHeight: clamp(nextTransform.previewHeight ?? clip.previewHeight ?? 0.22, 0.08, 1),
                }
              : clip,
          ),
        })),
      );
    },
    [],
  );

  const handlePreviewExternalDrop = useCallback(
    (draggedItem: SidebarTimelineItem) => {
      const targetTrackIndex = tracks.findIndex((track) => track.type === draggedItem.mediaType);
      if (targetTrackIndex < 0) {
        clearCurrentTimelineDragItem();
        return;
      }

      const clipDurationFrames = clamp(
        Math.round(draggedItem.durationFrames),
        MIN_CLIP_DURATION_FRAMES,
        sequence.durationFrames,
      );
      const maxStartFrame = Math.max(sequence.durationFrames - clipDurationFrames, 0);
      const rawStartFrame = clamp(Math.round(currentFrame), 0, maxStartFrame);
      const snapFrames = collectSnapFrames(tracks, sequence.durationFrames, new Set());
      const thresholdFrames = SNAP_THRESHOLD_PX / framePixelRatio;
      const snap = getBestSnap(
        [rawStartFrame, rawStartFrame + clipDurationFrames],
        snapFrames,
        thresholdFrames,
      );
      const startFrame = clamp(rawStartFrame + snap.offsetFrames, 0, maxStartFrame);
      const previewDefaults = getPreviewDefaultsForItem(draggedItem);

      const droppedClip: TimelineClip = {
        id: `clip-drop-${crypto.randomUUID()}`,
        name: draggedItem.label,
        startFrame,
        durationFrames: clipDurationFrames,
        source: draggedItem.source,
        mediaUrl: draggedItem.mediaUrl,
        previewX: previewDefaults.previewX,
        previewY: previewDefaults.previewY,
        previewWidth: previewDefaults.previewWidth,
        previewHeight: previewDefaults.previewHeight,
      };

      setTracks((currentTracks) =>
        currentTracks.map((track, index) => {
          if (index !== targetTrackIndex) {
            return track;
          }

          return {
            ...track,
            clips: [...track.clips, droppedClip].sort((a, b) => a.startFrame - b.startFrame),
          };
        }),
      );

      setSelectedClipIds([droppedClip.id]);
      setLastSelectedClipId(droppedClip.id);
      clearCurrentTimelineDragItem();
    },
    [currentFrame, framePixelRatio, sequence.durationFrames, tracks],
  );
  const handleWindowPointerMove = useCallback(
    (event: PointerEvent) => {
      if (isScrubbing) {
        updateTimeFromClientX(event.clientX);
      }

      setDragState((currentDragState) => {
        if (!currentDragState) {
          return null;
        }

        const thresholdFrames = SNAP_THRESHOLD_PX / framePixelRatio;
        const excludedIds = new Set<string>([currentDragState.clip.id]);
        const snapFrames = collectSnapFrames(tracks, sequence.durationFrames, excludedIds);

        if (currentDragState.mode === "move") {
          const trackListRect = trackListRef.current?.getBoundingClientRect();

          if (!trackListRect) {
            return currentDragState;
          }

          const rawTrackIndex = Math.floor(
            (event.clientY - trackListRect.top) / TIMELINE_LAYOUT.trackHeight,
          );
          const nextTrackIndex = clamp(rawTrackIndex, 0, maxTrackIndex);

          const laneX =
            event.clientX -
            trackListRect.left -
            TIMELINE_LAYOUT.labelColumnWidth -
            currentDragState.pointerOffsetX;

          const maxStartFrame = sequence.durationFrames - currentDragState.previewDurationFrames;
          const rawStartFrame = clamp(
            Math.round(laneX / framePixelRatio),
            0,
            Math.max(maxStartFrame, 0),
          );

          const snap = getBestSnap(
            [rawStartFrame, rawStartFrame + currentDragState.previewDurationFrames],
            snapFrames,
            thresholdFrames,
          );

          const nextStartFrame = clamp(
            rawStartFrame + snap.offsetFrames,
            0,
            Math.max(maxStartFrame, 0),
          );

          setSnapGuideFrame(snap.guideFrame);

          return {
            ...currentDragState,
            targetTrackIndex: nextTrackIndex,
            currentPointerY: event.clientY,
            previewStartFrame: nextStartFrame,
          };
        }

        const deltaFrames = Math.round(
          (event.clientX - currentDragState.startPointerX) / framePixelRatio,
        );

        if (currentDragState.mode === "resize-left") {
          const originalClipEnd =
            currentDragState.clip.startFrame + currentDragState.clip.durationFrames;
          const maxStartFrame = originalClipEnd - MIN_CLIP_DURATION_FRAMES;
          const rawStartFrame = clamp(
            currentDragState.clip.startFrame + deltaFrames,
            0,
            maxStartFrame,
          );

          const snap = getBestSnap([rawStartFrame], snapFrames, thresholdFrames);
          const nextStartFrame = clamp(rawStartFrame + snap.offsetFrames, 0, maxStartFrame);
          const nextDurationFrames = originalClipEnd - nextStartFrame;

          setSnapGuideFrame(snap.guideFrame);

          return {
            ...currentDragState,
            targetTrackIndex: currentDragState.sourceTrackIndex,
            previewStartFrame: nextStartFrame,
            previewDurationFrames: nextDurationFrames,
          };
        }

        const maxDurationFrames = sequence.durationFrames - currentDragState.clip.startFrame;
        const rawDurationFrames = clamp(
          currentDragState.clip.durationFrames + deltaFrames,
          MIN_CLIP_DURATION_FRAMES,
          Math.max(maxDurationFrames, MIN_CLIP_DURATION_FRAMES),
        );
        const rawEndFrame = currentDragState.clip.startFrame + rawDurationFrames;
        const snap = getBestSnap([rawEndFrame], snapFrames, thresholdFrames);
        const snappedEndFrame = clamp(
          rawEndFrame + snap.offsetFrames,
          currentDragState.clip.startFrame + MIN_CLIP_DURATION_FRAMES,
          sequence.durationFrames,
        );

        setSnapGuideFrame(snap.guideFrame);

        return {
          ...currentDragState,
          targetTrackIndex: currentDragState.sourceTrackIndex,
          previewDurationFrames: snappedEndFrame - currentDragState.clip.startFrame,
        };
      });
    },
    [framePixelRatio, isScrubbing, maxTrackIndex, sequence.durationFrames, tracks, updateTimeFromClientX],
  );

  const handleWindowPointerUp = useCallback(() => {
    setIsScrubbing(false);

    setDragState((currentDragState) => {
      if (!currentDragState) {
        return null;
      }

      setTracks((currentTracks) => updateTracksForDrop(currentTracks, currentDragState));
      setSelectedClipIds([currentDragState.clip.id]);
      setLastSelectedClipId(currentDragState.clip.id);

      return null;
    });

    setSnapGuideFrame(null);
  }, []);

  useEffect(() => {
    if (!dragState && !isScrubbing) {
      return;
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);

    if (dragState) {
      document.body.style.cursor = dragState.mode === "move" ? "grabbing" : "ew-resize";
    } else if (isScrubbing) {
      document.body.style.cursor = "ew-resize";
    }

    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragState, handleWindowPointerMove, handleWindowPointerUp, isScrubbing]);

  return (
    <section
      ref={timelinePanelRef}
      className={styles.timelinePanel}
      aria-label="Timeline panel"
      style={{ gridTemplateRows: `minmax(${MIN_PREVIEW_HEIGHT_PX}px, 1fr) auto ${timelineHeightPx}px` }}
    >
      <TimelinePreview
        tracks={tracks}
        currentFrame={currentFrame}
        frameRate={sequence.frameRate}
        isPlaying={isPlaying}
        selectedClipIds={selectedClipIds}
        onSelectClip={handlePreviewClipSelect}
        onClipTransformChange={handlePreviewClipTransformChange}
        onDropExternalItem={handlePreviewExternalDrop}
      />

      <TimelineToolbar
        durationFrames={sequence.durationFrames}
        frameRate={sequence.frameRate}
        currentTimeMs={currentTimeMs}
        isPlaying={isPlaying}
        onTogglePlayback={handleTogglePlayback}
        onResizePointerDown={handlePanelSplitterPointerDown}
      />

      <div className={styles.timelineViewport} ref={viewportRef}>
        <div
          ref={timelineCanvasRef}
          className={styles.timelineCanvas}
          style={{ width: `${timelineCanvasWidth}px`, minWidth: "100%" }}
        >
          <div className={styles.rulerRow}>
            <div className={styles.trackLabelSpacer} aria-hidden="true" />
            <TimelineRuler
              durationFrames={sequence.durationFrames}
              frameRate={sequence.frameRate}
              framePixelRatio={framePixelRatio}
              onPointerDown={startScrubbing}
            />
          </div>

          <TimelineTrackList
            tracks={tracks}
            dragState={dragState}
            framePixelRatio={framePixelRatio}
            selectedClipIds={selectedClipIds}
            dropTargetTrackIndex={dropTargetTrackIndex}
            externalPreview={externalPreview}
            trackListRef={trackListRef}
            onTrackDragOver={handleTrackDragOver}
            onTrackDragLeave={handleTrackDragLeave}
            onTrackDrop={handleTrackDrop}
            onLanePointerDown={startScrubbing}
            onClipPointerDown={handleClipPointerDown}
            onResizeLeftPointerDown={handleResizeLeftPointerDown}
            onResizeRightPointerDown={handleResizeRightPointerDown}
          />

          {snapGuideFrame !== null ? (
            <div
              className={styles.snapGuide}
              style={{ left: `${TIMELINE_LAYOUT.labelColumnWidth + snapGuideFrame * framePixelRatio}px` }}
              aria-hidden="true"
            />
          ) : null}

          <div
            className={styles.playhead}
            style={{ left: `${TIMELINE_LAYOUT.labelColumnWidth + playheadOffsetPx}px` }}
            aria-hidden="true"
          >
            <div className={styles.playheadLine} />
            <div className={styles.playheadHandle} onPointerDown={startScrubbing} />
          </div>
        </div>
      </div>
    </section>
  );
};







