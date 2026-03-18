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
import { TimelineClip, TimelineTrack } from "@/features/timeline/types/timeline";

import styles from "./TimelinePanel.module.css";

interface TimelinePreviewProps {
  tracks: TimelineTrack[];
  currentFrame: number;
  frameRate: number;
  isPlaying: boolean;
  selectedClipIds: string[];
  onSelectClip: (clipId: string | null) => void;
  onClipTransformChange: (
    clipId: string,
    nextTransform: Pick<TimelineClip, "previewX" | "previewY" | "previewWidth" | "previewHeight">,
  ) => void;
  onDropExternalItem: (item: SidebarTimelineItem) => void;
}

interface ActivePreviewClip {
  clip: TimelineClip;
  trackIndex: number;
}

type PreviewInteractionMode = "move" | "resize";

interface PreviewInteractionState {
  clipId: string;
  mode: PreviewInteractionMode;
  startClientX: number;
  startClientY: number;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
}

const clamp = (value: number, min: number, max: number) => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const getPreviewLayout = (clip: TimelineClip) => {
  const hasExplicitLayout =
    typeof clip.previewX === "number" &&
    typeof clip.previewY === "number" &&
    typeof clip.previewWidth === "number" &&
    typeof clip.previewHeight === "number";

  if (hasExplicitLayout) {
    return {
      previewX: clamp(clip.previewX ?? 0, 0, 0.92),
      previewY: clamp(clip.previewY ?? 0, 0, 0.92),
      previewWidth: clamp(clip.previewWidth ?? 0.6, 0.08, 1),
      previewHeight: clamp(clip.previewHeight ?? 0.22, 0.08, 1),
    };
  }

  if (clip.source === "asset" && clip.mediaUrl) {
    return {
      previewX: 0,
      previewY: 0,
      previewWidth: 1,
      previewHeight: 1,
    };
  }

  return {
    previewX: 0.2,
    previewY: 0.2,
    previewWidth: 0.6,
    previewHeight: 0.22,
  };
};

const collectActivePreviewClips = (tracks: TimelineTrack[], frame: number): ActivePreviewClip[] => {
  const activeClips: ActivePreviewClip[] = [];

  tracks.forEach((track, trackIndex) => {
    if (track.type !== "video") {
      return;
    }

    for (const clip of track.clips) {
      if (frame >= clip.startFrame && frame < clip.startFrame + clip.durationFrames) {
        activeClips.push({ clip, trackIndex });
      }
    }
  });

  return activeClips;
};

export const TimelinePreview = ({
  tracks,
  currentFrame,
  frameRate,
  isPlaying,
  selectedClipIds,
  onSelectClip,
  onClipTransformChange,
  onDropExternalItem,
}: TimelinePreviewProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const backdropVideoRef = useRef<HTMLVideoElement | null>(null);

  const [isExternalDragOver, setIsExternalDragOver] = useState(false);
  const [interactionState, setInteractionState] = useState<PreviewInteractionState | null>(null);

  const activePreviewClips = useMemo(
    () => collectActivePreviewClips(tracks, currentFrame),
    [tracks, currentFrame],
  );

  const activeVideo = useMemo(
    () => activePreviewClips.find((item) => Boolean(item.clip.mediaUrl)) ?? null,
    [activePreviewClips],
  );

  const hasActiveVideo = Boolean(activeVideo?.clip.mediaUrl);
  const hasFullFrameBackground = useMemo(() => {
    return activePreviewClips.some(({ clip }) => {
      if (!clip.mediaUrl) {
        return false;
      }

      const layout = getPreviewLayout(clip);
      return (
        layout.previewX <= 0.001 &&
        layout.previewY <= 0.001 &&
        layout.previewWidth >= 0.999 &&
        layout.previewHeight >= 0.999
      );
    });
  }, [activePreviewClips]);

  const relativeSeconds = useMemo(() => {
    if (!activeVideo) {
      return 0;
    }

    return Math.max((currentFrame - activeVideo.clip.startFrame) / frameRate, 0);
  }, [activeVideo, currentFrame, frameRate]);

  useEffect(() => {
    const videoElements = [mainVideoRef.current, backdropVideoRef.current].filter(
      (video): video is HTMLVideoElement => video !== null,
    );

    if (videoElements.length === 0 || !activeVideo?.clip.mediaUrl) {
      return;
    }

    for (const video of videoElements) {
      if (isPlaying) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            // Ignore autoplay restrictions in preview.
          });
        }
      } else {
        video.pause();
      }
    }
  }, [activeVideo?.clip.id, activeVideo?.clip.mediaUrl, isPlaying]);

  useEffect(() => {
    const videoElements = [mainVideoRef.current, backdropVideoRef.current].filter(
      (video): video is HTMLVideoElement => video !== null,
    );

    if (videoElements.length === 0 || !activeVideo?.clip.mediaUrl || !Number.isFinite(relativeSeconds)) {
      return;
    }

    const driftThreshold = isPlaying ? 0.25 : 0.05;

    for (const video of videoElements) {
      if (Math.abs(video.currentTime - relativeSeconds) > driftThreshold) {
        try {
          video.currentTime = relativeSeconds;
        } catch {
          // Ignore seeking errors while metadata is loading.
        }
      }
    }
  }, [activeVideo?.clip.id, activeVideo?.clip.mediaUrl, isPlaying, relativeSeconds]);

  useEffect(() => {
    if (!interactionState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const viewportRect = viewportRef.current?.getBoundingClientRect();
      if (!viewportRect) {
        return;
      }

      const deltaX = (event.clientX - interactionState.startClientX) / viewportRect.width;
      const deltaY = (event.clientY - interactionState.startClientY) / viewportRect.height;

      if (interactionState.mode === "move") {
        const nextWidth = interactionState.initialWidth;
        const nextHeight = interactionState.initialHeight;

        onClipTransformChange(interactionState.clipId, {
          previewX: clamp(interactionState.initialX + deltaX, 0, Math.max(1 - nextWidth, 0)),
          previewY: clamp(interactionState.initialY + deltaY, 0, Math.max(1 - nextHeight, 0)),
          previewWidth: nextWidth,
          previewHeight: nextHeight,
        });

        return;
      }

      const nextWidth = clamp(
        interactionState.initialWidth + deltaX,
        0.08,
        Math.max(1 - interactionState.initialX, 0.08),
      );
      const nextHeight = clamp(
        interactionState.initialHeight + deltaY,
        0.08,
        Math.max(1 - interactionState.initialY, 0.08),
      );

      onClipTransformChange(interactionState.clipId, {
        previewX: interactionState.initialX,
        previewY: interactionState.initialY,
        previewWidth: nextWidth,
        previewHeight: nextHeight,
      });
    };

    const handlePointerUp = () => {
      setInteractionState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    document.body.style.userSelect = "none";
    document.body.style.cursor = interactionState.mode === "move" ? "grabbing" : "nwse-resize";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [interactionState, onClipTransformChange]);

  const handlePreviewDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    const draggedItem = parseTimelineDragItemFromDataTransfer(event.dataTransfer);
    if (!draggedItem) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsExternalDragOver(true);
  }, []);

  const handlePreviewDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsExternalDragOver(false);

      const draggedItem = parseTimelineDragItemFromDataTransfer(event.dataTransfer);
      if (!draggedItem) {
        clearCurrentTimelineDragItem();
        return;
      }

      onDropExternalItem(draggedItem);
    },
    [onDropExternalItem],
  );

  const handlePreviewDragLeave = useCallback(() => {
    setIsExternalDragOver(false);
  }, []);

  const startMoveInteraction = useCallback(
    (event: ReactPointerEvent<HTMLElement>, clip: TimelineClip) => {
      event.stopPropagation();
      event.preventDefault();

      const layout = getPreviewLayout(clip);
      onSelectClip(clip.id);

      setInteractionState({
        clipId: clip.id,
        mode: "move",
        startClientX: event.clientX,
        startClientY: event.clientY,
        initialX: layout.previewX,
        initialY: layout.previewY,
        initialWidth: layout.previewWidth,
        initialHeight: layout.previewHeight,
      });
    },
    [onSelectClip],
  );

  const startResizeInteraction = useCallback(
    (event: ReactPointerEvent<HTMLElement>, clip: TimelineClip) => {
      event.stopPropagation();
      event.preventDefault();

      const layout = getPreviewLayout(clip);
      onSelectClip(clip.id);

      setInteractionState({
        clipId: clip.id,
        mode: "resize",
        startClientX: event.clientX,
        startClientY: event.clientY,
        initialX: layout.previewX,
        initialY: layout.previewY,
        initialWidth: layout.previewWidth,
        initialHeight: layout.previewHeight,
      });
    },
    [onSelectClip],
  );

  const handleViewportPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onSelectClip(null);
      }
    },
    [onSelectClip],
  );

  return (
    <section
      className={`${styles.previewPanel} ${hasActiveVideo ? "" : styles.previewPanelEmpty}`}
      aria-label="Program preview"
    >
      <div
        ref={viewportRef}
        className={`${styles.previewViewport} ${!hasFullFrameBackground ? styles.previewViewportCheckerboard : ""} ${isExternalDragOver ? styles.previewViewportDropTarget : ""}`}
        onPointerDown={handleViewportPointerDown}
        onDragOver={handlePreviewDragOver}
        onDragLeave={handlePreviewDragLeave}
        onDrop={handlePreviewDrop}
      >
        {activeVideo?.clip.mediaUrl ? (
          <>
            <video
              key={`${activeVideo.clip.id}-backdrop`}
              ref={backdropVideoRef}
              src={activeVideo.clip.mediaUrl}
              className={styles.previewBackdropVideo}
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
            />
            <div className={styles.previewVideoFrame}>
              <video
                key={`${activeVideo.clip.id}-main`}
                ref={mainVideoRef}
                src={activeVideo.clip.mediaUrl}
                className={styles.previewVideo}
                playsInline
                preload="metadata"
              />
              <div className={styles.previewOverlayLayer}>
                {activePreviewClips.map(({ clip, trackIndex }) => {
                  const layout = getPreviewLayout(clip);
                  const isSelected = selectedClipIds.includes(clip.id);

                  return (
                    <div
                      key={clip.id}
                      className={`${styles.previewOverlayItem} ${isSelected ? styles.previewOverlayItemSelected : ""}`}
                      style={{
                        left: `${layout.previewX * 100}%`,
                        top: `${layout.previewY * 100}%`,
                        width: `${layout.previewWidth * 100}%`,
                        height: `${layout.previewHeight * 100}%`,
                        zIndex: isSelected ? 120 : 30 + trackIndex,
                      }}
                      onPointerDown={(event) => startMoveInteraction(event, clip)}
                    >
                      <span className={styles.previewOverlayLabel}>{clip.name}</span>
                      <button
                        type="button"
                        className={styles.previewOverlayResizeHandle}
                        aria-label={`Resize ${clip.name}`}
                        onPointerDown={(event) => startResizeInteraction(event, clip)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.previewVideoFrame}>
            <div className={styles.previewOverlayLayer}>
              {activePreviewClips.map(({ clip, trackIndex }) => {
                const layout = getPreviewLayout(clip);
                const isSelected = selectedClipIds.includes(clip.id);

                return (
                  <div
                    key={clip.id}
                    className={`${styles.previewOverlayItem} ${isSelected ? styles.previewOverlayItemSelected : ""}`}
                    style={{
                      left: `${layout.previewX * 100}%`,
                      top: `${layout.previewY * 100}%`,
                      width: `${layout.previewWidth * 100}%`,
                      height: `${layout.previewHeight * 100}%`,
                      zIndex: isSelected ? 120 : 30 + trackIndex,
                    }}
                    onPointerDown={(event) => startMoveInteraction(event, clip)}
                  >
                    <span className={styles.previewOverlayLabel}>{clip.name}</span>
                    <button
                      type="button"
                      className={styles.previewOverlayResizeHandle}
                      aria-label={`Resize ${clip.name}`}
                      onPointerDown={(event) => startResizeInteraction(event, clip)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
