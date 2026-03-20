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

import { TIMELINE_LAYOUT } from "@/features/timeline/constants/timelineLayout";
import {
  SidebarTimelineItem,
  clearCurrentTimelineDragItem,
  parseTimelineDragItemFromDataTransfer,
} from "@/features/timeline/lib/dragTransfer";
import {
  MIN_CLIP_DURATION_FRAMES,
  collectSnapFrames,
  createTimelineClipFromSidebarItem,
  getBestSnap,
  insertClipIntoTrack,
  moveClipToTrack,
} from "@/features/timeline/lib/clipPlacement";
import { clamp } from "@/features/timeline/lib/clamp";
import { useTimelinePlayback } from "@/features/timeline/hooks/useTimelinePlayback";
import { useTimelineSelection } from "@/features/timeline/hooks/useTimelineSelection";
import { TimelineClip, TimelineSequence, TimelineTrack } from "@/features/timeline/types/timeline";

import { TimelineDragState, TimelineExternalPreview, TimelineInteractionMode } from "./timelineSharedTypes";
import { TimelinePreview } from "./TimelinePreview";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineToolbar } from "./TimelineToolbar";
import { TimelineTrackList } from "./TimelineTrackList";
import styles from "./TimelinePanel.module.css";

interface TimelinePanelProps {
  sequence: TimelineSequence;
  onSequenceChange?: (nextSequence: TimelineSequence) => void;
}

const SNAP_THRESHOLD_PX = 10;
const RESIZE_HIT_ZONE_HEIGHT_PX = 8;
const MIN_TIMELINE_HEIGHT_PX = 180;
const MIN_PREVIEW_HEIGHT_PX = 120;
const DEFAULT_TIMELINE_HEIGHT_PX = 280;

const parseExternalDropItem = (
  event: ReactDragEvent<HTMLDivElement>,
): SidebarTimelineItem | null => parseTimelineDragItemFromDataTransfer(event.dataTransfer);

const buildDroppedClipFromDragState = (dragState: TimelineDragState): TimelineClip => ({
  ...dragState.clip,
  startFrame: dragState.previewStartFrame,
  durationFrames: dragState.previewDurationFrames,
});

export const TimelinePanel = ({ sequence, onSequenceChange }: TimelinePanelProps) => {
  const [tracks, setTracks] = useState<TimelineTrack[]>(sequence.tracks);
  const [dropTargetTrackIndex, setDropTargetTrackIndex] = useState<number | null>(null);
  const [externalPreview, setExternalPreview] = useState<TimelineExternalPreview | null>(null);
  const [snapGuideFrame, setSnapGuideFrame] = useState<number | null>(null);
  const [dragState, setDragState] = useState<TimelineDragState | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [timelineHeightPx, setTimelineHeightPx] = useState(DEFAULT_TIMELINE_HEIGHT_PX);

  const timelinePanelRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
  const trackListRef = useRef<HTMLDivElement | null>(null);

  const clipIdOrder = useMemo(
    () =>
      tracks.flatMap((track) =>
        [...track.clips]
          .sort((left, right) => left.startFrame - right.startFrame)
          .map((clip) => clip.id),
      ),
    [tracks],
  );

  const {
    selectedClipIds,
    selectedClipIdSet,
    clearSelection,
    selectSingleClip,
    applySelection,
  } = useTimelineSelection(clipIdOrder);

  const {
    currentFrame,
    currentTimeMs,
    frameStepMs,
    isPlaying,
    setCurrentTimeMs,
    setIsPlaying,
    togglePlayback,
    totalDurationMs,
  } = useTimelinePlayback({
    durationFrames: sequence.durationFrames,
    frameRate: sequence.frameRate,
    isScrubbing,
  });

  useEffect(() => {
    if (!onSequenceChange) {
      return;
    }

    onSequenceChange({
      ...sequence,
      tracks,
    });
  }, [onSequenceChange, sequence, tracks]);

  useEffect(() => {
    const clearSelectionOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest("[data-clip-block=\"true\"]")) {
        return;
      }

      clearSelection();
    };

    window.addEventListener("pointerdown", clearSelectionOnOutsideClick);

    return () => {
      window.removeEventListener("pointerdown", clearSelectionOnOutsideClick);
    };
  }, [clearSelection]);

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

      setTimelineHeightPx((currentHeightPx) =>
        clamp(currentHeightPx, MIN_TIMELINE_HEIGHT_PX, maxTimelineHeightPx),
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
    [framePixelRatio, sequence.durationFrames, sequence.frameRate, setCurrentTimeMs],
  );

  const startScrubbing = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragState) {
        return;
      }

      event.preventDefault();
      setIsPlaying(false);
      setIsScrubbing(true);
      clearSelection();
      updateTimeFromClientX(event.clientX);
    },
    [clearSelection, dragState, setIsPlaying, updateTimeFromClientX],
  );

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
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
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
        clearSelection();
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
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
  }, [clearSelection, frameStepMs, selectedClipIds, setCurrentTimeMs, setIsPlaying, togglePlayback, totalDurationMs]);

  const startInteraction = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      clip: TimelineClip,
      trackIndex: number,
      mode: TimelineInteractionMode,
    ) => {
      event.preventDefault();

      const clipRect = event.currentTarget.getBoundingClientRect();
      setDragState({
        clip,
        mode,
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
    (event: ReactPointerEvent<HTMLDivElement>, clip: TimelineClip, trackIndex: number) => {
      const canStartDrag = applySelection(
        { toggle: event.metaKey || event.ctrlKey, range: event.shiftKey },
        clip.id,
      );

      if (!canStartDrag) {
        return;
      }

      startInteraction(event, clip, trackIndex, "move");
    },
    [applySelection, startInteraction],
  );

  const handleResizeLeftPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, clip: TimelineClip, trackIndex: number) => {
      selectSingleClip(clip.id);
      startInteraction(event, clip, trackIndex, "resize-left");
    },
    [selectSingleClip, startInteraction],
  );

  const handleResizeRightPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, clip: TimelineClip, trackIndex: number) => {
      selectSingleClip(clip.id);
      startInteraction(event, clip, trackIndex, "resize-right");
    },
    [selectSingleClip, startInteraction],
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
      setDropTargetTrackIndex((currentTrackIndex) =>
        currentTrackIndex === trackIndex ? null : currentTrackIndex,
      );
      setExternalPreview((currentPreview) =>
        currentPreview?.trackIndex === trackIndex ? null : currentPreview,
      );

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
      const droppedClip = createTimelineClipFromSidebarItem({
        id: `clip-drop-${crypto.randomUUID()}`,
        item: draggedItem,
        startFrame,
        durationFrames: clipDurationFrames,
      });

      setTracks((currentTracks) => {
        const track = currentTracks[trackIndex];
        if (!track || track.type !== draggedItem.mediaType) {
          return currentTracks;
        }

        return insertClipIntoTrack(currentTracks, trackIndex, droppedClip);
      });

      selectSingleClip(droppedClip.id);
      setDropTargetTrackIndex(null);
      setExternalPreview(null);
      setSnapGuideFrame(null);
      clearCurrentTimelineDragItem();
    },
    [framePixelRatio, selectSingleClip, sequence.durationFrames, tracks],
  );

  const handlePreviewExternalDrop = useCallback(
    (draggedItem: SidebarTimelineItem, dropPoint?: { x: number; y: number }) => {
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
      const baseClip = createTimelineClipFromSidebarItem({
        id: `clip-drop-${crypto.randomUUID()}`,
        item: draggedItem,
        startFrame,
        durationFrames: clipDurationFrames,
      });

      const droppedClip =
        dropPoint && draggedItem.source === "element"
          ? {
              ...baseClip,
              previewX: clamp(
                dropPoint.x - (baseClip.previewWidth ?? 0.34) / 2,
                0,
                Math.max(1 - (baseClip.previewWidth ?? 0.34), 0),
              ),
              previewY: clamp(
                dropPoint.y - (baseClip.previewHeight ?? 0.2) / 2,
                0,
                Math.max(1 - (baseClip.previewHeight ?? 0.2), 0),
              ),
            }
          : baseClip;

      setTracks((currentTracks) => insertClipIntoTrack(currentTracks, targetTrackIndex, droppedClip));
      selectSingleClip(droppedClip.id);
      clearCurrentTimelineDragItem();
    },
    [currentFrame, framePixelRatio, selectSingleClip, sequence.durationFrames, tracks],
  );

  const handlePreviewClipSelect = useCallback(
    (clipId: string | null) => {
      if (!clipId) {
        clearSelection();
        return;
      }

      selectSingleClip(clipId);
    },
    [clearSelection, selectSingleClip],
  );

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

          setSnapGuideFrame(snap.guideFrame);

          return {
            ...currentDragState,
            targetTrackIndex: currentDragState.sourceTrackIndex,
            previewStartFrame: nextStartFrame,
            previewDurationFrames: originalClipEnd - nextStartFrame,
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

      const droppedClip = buildDroppedClipFromDragState(currentDragState);
      setTracks((currentTracks) =>
        moveClipToTrack({
          tracks: currentTracks,
          clipId: currentDragState.clip.id,
          targetTrackIndex: currentDragState.targetTrackIndex,
          clip: droppedClip,
        }),
      );
      selectSingleClip(currentDragState.clip.id);
      return null;
    });

    setSnapGuideFrame(null);
  }, [selectSingleClip]);

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
      style={{
        gridTemplateRows: `minmax(${MIN_PREVIEW_HEIGHT_PX}px, 1fr) auto ${timelineHeightPx}px`,
      }}
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
        onTogglePlayback={togglePlayback}
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
            selectedClipIdSet={selectedClipIdSet}
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
              style={{
                left: `${TIMELINE_LAYOUT.labelColumnWidth + snapGuideFrame * framePixelRatio}px`,
              }}
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


