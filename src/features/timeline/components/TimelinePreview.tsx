import {
  DragEvent as ReactDragEvent,
  PointerEvent as ReactPointerEvent,
  SyntheticEvent,
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
import {
  getPreviewElementVariant,
  getPreviewTextLabel,
} from "@/features/timeline/lib/previewLayout";
import { TimelineClip, TimelineTrack } from "@/features/timeline/types/timeline";

import styles from "./TimelinePanel.module.css";

interface TimelinePreviewProps {
  tracks: TimelineTrack[];
  currentFrame: number;
  frameRate: number;
  sequenceAspectRatio?: number;
  isPlaying: boolean;
  selectedClipIds: string[];
  onSelectClip: (clipId: string | null) => void;
  onClipTransformChange: (
    clipId: string,
    nextTransform: Pick<TimelineClip, "previewX" | "previewY" | "previewWidth" | "previewHeight">,
  ) => void;
  onDropExternalItem: (item: SidebarTimelineItem, dropPoint?: { x: number; y: number }) => void;
}

interface ActivePreviewClip {
  clip: TimelineClip;
  trackIndex: number;
  trackType: TimelineTrack["type"];
}

interface PreviewLayout {
  previewX: number;
  previewY: number;
  previewWidth: number;
  previewHeight: number;
}

type PreviewInteractionMode = "move" | "resize";
type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

interface PreviewInteractionState {
  clipId: string;
  mode: PreviewInteractionMode;
  resizeHandle?: ResizeHandle;
  startClientX: number;
  startClientY: number;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
}

const RESIZE_HANDLES: ResizeHandle[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];


const clamp = (value: number, min: number, max: number) => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const getResizeCursor = (handle?: ResizeHandle) => {
  switch (handle) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    default:
      return "nwse-resize";
  }
};

const getPreviewLayout = (clip: TimelineClip): PreviewLayout => {
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
    if (track.type !== "video" && track.type !== "subtitle") {
      return;
    }

    for (const clip of track.clips) {
      if (frame >= clip.startFrame && frame < clip.startFrame + clip.durationFrames) {
        activeClips.push({ clip, trackIndex, trackType: track.type });
      }
    }
  });

  return activeClips;
};

const isFullFrameLayout = (layout: PreviewLayout) => {
  return (
    layout.previewX <= 0.001 &&
    layout.previewY <= 0.001 &&
    layout.previewWidth >= 0.999 &&
    layout.previewHeight >= 0.999
  );
};

export const TimelinePreview = ({
  tracks,
  currentFrame,
  frameRate,
  sequenceAspectRatio,
  isPlaying,
  selectedClipIds,
  onSelectClip,
  onClipTransformChange,
  onDropExternalItem,
}: TimelinePreviewProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);

  const [isExternalDragOver, setIsExternalDragOver] = useState(false);
  const [interactionState, setInteractionState] = useState<PreviewInteractionState | null>(null);
  const [viewportAspect, setViewportAspect] = useState(16 / 9);
  const canvasAspectRatio = sequenceAspectRatio && sequenceAspectRatio > 0 ? sequenceAspectRatio : 16 / 9;
  const [activeVideoAspect, setActiveVideoAspect] = useState<number | null>(null);

  const activePreviewClips = useMemo(
    () => collectActivePreviewClips(tracks, currentFrame),
    [tracks, currentFrame],
  );

  const activeVideo = useMemo(
    () => activePreviewClips.find((item) => Boolean(item.clip.mediaUrl)) ?? null,
    [activePreviewClips],
  );

  const hasActiveVideo = Boolean(activeVideo?.clip.mediaUrl);

  const relativeSeconds = useMemo(() => {
    if (!activeVideo) {
      return 0;
    }

    return Math.max((currentFrame - activeVideo.clip.startFrame) / frameRate, 0);
  }, [activeVideo, currentFrame, frameRate]);

  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) {
      return;
    }

    const updateViewportAspect = () => {
      const rect = viewportElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportAspect(rect.width / rect.height);
      }
    };

    updateViewportAspect();

    const observer = new ResizeObserver(() => {
      updateViewportAspect();
    });

    observer.observe(viewportElement);

    return () => {
      observer.disconnect();
    };
  }, [] );
  useEffect(() => {
    const videoElements = [mainVideoRef.current].filter(
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
    const videoElements = [mainVideoRef.current].filter(
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

      const minSize = 0.08;
      const handle = interactionState.resizeHandle ?? "se";

      let left = interactionState.initialX;
      let top = interactionState.initialY;
      let right = interactionState.initialX + interactionState.initialWidth;
      let bottom = interactionState.initialY + interactionState.initialHeight;

      if (handle.includes("w")) {
        left = clamp(interactionState.initialX + deltaX, 0, right - minSize);
      }

      if (handle.includes("e")) {
        right = clamp(
          interactionState.initialX + interactionState.initialWidth + deltaX,
          left + minSize,
          1,
        );
      }

      if (handle.includes("n")) {
        top = clamp(interactionState.initialY + deltaY, 0, bottom - minSize);
      }

      if (handle.includes("s")) {
        bottom = clamp(
          interactionState.initialY + interactionState.initialHeight + deltaY,
          top + minSize,
          1,
        );
      }

      onClipTransformChange(interactionState.clipId, {
        previewX: left,
        previewY: top,
        previewWidth: clamp(right - left, minSize, 1),
        previewHeight: clamp(bottom - top, minSize, 1),
      });
    };

    const handlePointerUp = () => {
      setInteractionState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    document.body.style.userSelect = "none";
    document.body.style.cursor =
      interactionState.mode === "move" ? "grabbing" : getResizeCursor(interactionState.resizeHandle);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [interactionState, onClipTransformChange]);

  const previewFrameStyle = useMemo(() => {
    if (viewportAspect <= 0 || canvasAspectRatio <= 0) {
      return undefined;
    }

    return canvasAspectRatio >= viewportAspect
      ? { aspectRatio: `${canvasAspectRatio}`, width: "100%", height: "auto" }
      : { aspectRatio: `${canvasAspectRatio}`, width: "auto", height: "100%" };
  }, [canvasAspectRatio, viewportAspect]);

  const handleMainVideoMetadata = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = event.currentTarget;
    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      setActiveVideoAspect(videoElement.videoWidth / videoElement.videoHeight);
    }
  }, []);

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

      const viewportRect = event.currentTarget.getBoundingClientRect();
      const dropPoint = {
        x: clamp((event.clientX - viewportRect.left) / viewportRect.width, 0, 1),
        y: clamp((event.clientY - viewportRect.top) / viewportRect.height, 0, 1),
      };

      onDropExternalItem(draggedItem, dropPoint);
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
    (event: ReactPointerEvent<HTMLElement>, clip: TimelineClip, handle: ResizeHandle) => {
      event.stopPropagation();
      event.preventDefault();

      const layout = getPreviewLayout(clip);
      onSelectClip(clip.id);

      setInteractionState({
        clipId: clip.id,
        mode: "resize",
        resizeHandle: handle,
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
      const target = event.target;

      if (target instanceof Element && target.closest(`.${styles.previewOverlayItem}`)) {
        return;
      }

      onSelectClip(null);
    },
    [onSelectClip],
  );

  const renderElementContent = useCallback((clip: TimelineClip, trackType: TimelineTrack["type"]) => {
    if (clip.source !== "element") {
      return null;
    }

    const displayText = clip.content?.displayText?.trim() || "";
    const variant = getPreviewElementVariant(clip);
    const style = clip.elementStyle;
    const textStyle = {
      color: style?.textColor,
      textAlign: style?.textAlign,
      backgroundColor: style?.backgroundColor,
      borderRadius: typeof style?.borderRadiusPx === "number" ? `${style.borderRadiusPx}px` : undefined,
      padding:
        style?.backgroundColor || typeof style?.borderRadiusPx === "number"
          ? "0.2em 0.4em"
          : undefined,
    };

    if (trackType === "subtitle") {
      return (
        <span className={styles.previewSubtitleText} style={textStyle}>
          {getPreviewTextLabel(clip)}
        </span>
      );
    }

    if (displayText || variant === "text") {
      return (
        <span className={styles.previewElementText} style={textStyle}>
          {displayText || getPreviewTextLabel(clip)}
        </span>
      );
    }

    if (variant === "background") {
      return (
        <div
          className={styles.previewElementBackground}
          aria-hidden="true"
          style={{
            background: style?.backgroundColor ?? style?.fillColor ?? undefined,
            opacity:
              typeof style?.backgroundOpacity === "number"
                ? clamp(style.backgroundOpacity, 0, 1)
                : undefined,
          }}
        />
      );
    }

    if (variant === "circle") {
      return (
        <div
          className={styles.previewElementCircle}
          aria-hidden="true"
          style={{ background: style?.fillColor ?? undefined }}
        />
      );
    }

    if (variant === "triangle") {
      return (
        <div
          className={styles.previewElementTriangle}
          aria-hidden="true"
          style={{ background: style?.fillColor ?? undefined }}
        />
      );
    }

    if (variant === "line") {
      return (
        <div
          className={styles.previewElementLine}
          aria-hidden="true"
          style={{ background: style?.backgroundColor ?? style?.fillColor ?? undefined }}
        />
      );
    }

    return (
      <div
        className={styles.previewElementContent}
        style={{
          justifyContent:
            style?.textAlign === "left"
              ? "flex-start"
              : style?.textAlign === "right"
                ? "flex-end"
                : "center",
          textAlign: style?.textAlign ?? "center",
        }}
      >
        <div
          className={styles.previewElementShape}
          aria-hidden="true"
          style={{
            background: style?.backgroundColor ?? style?.fillColor ?? undefined,
            opacity:
              typeof style?.backgroundOpacity === "number"
                ? clamp(style.backgroundOpacity, 0, 1)
                : undefined,
            borderRadius:
              typeof style?.borderRadiusPx === "number" ? `${style.borderRadiusPx}px` : undefined,
          }}
        />
        {displayText ? (
          <span className={styles.previewElementText} style={textStyle}>
            {displayText}
          </span>
        ) : null}
      </div>
    );
  }, []);

  

  const getRenderedLayout = useCallback(
    (clip: TimelineClip, baseLayout: PreviewLayout): PreviewLayout => {
      if (!clip.mediaUrl || !activeVideo || clip.id !== activeVideo.clip.id || !activeVideoAspect) {
        return baseLayout;
      }

      if (!isFullFrameLayout(baseLayout) || canvasAspectRatio <= 0) {
        return baseLayout;
      }

      if (activeVideoAspect > canvasAspectRatio) {
        const fittedHeight = canvasAspectRatio / activeVideoAspect;
        return {
          previewX: 0,
          previewY: (1 - fittedHeight) / 2,
          previewWidth: 1,
          previewHeight: fittedHeight,
        };
      }

      const fittedWidth = activeVideoAspect / canvasAspectRatio;
      return {
        previewX: (1 - fittedWidth) / 2,
        previewY: 0,
        previewWidth: fittedWidth,
        previewHeight: 1,
      };
    },
    [activeVideo, activeVideoAspect, canvasAspectRatio],
  );

  const renderOverlayItem = useCallback(
    ({ clip, trackIndex, trackType }: ActivePreviewClip) => {
      const baseLayout = getPreviewLayout(clip);
      const layout = getRenderedLayout(clip, baseLayout);
      const isSelected = selectedClipIds.includes(clip.id);
      const isInteractive = interactionState?.clipId === clip.id;

      return (
        <div
          key={clip.id}
          className={`${styles.previewOverlayItem} ${isSelected ? styles.previewOverlayItemSelected : ""} ${isInteractive ? styles.previewOverlayItemInteractive : ""} ${styles.previewOverlayItemDropIn}`}
          style={{
            left: `${layout.previewX * 100}%`,
            top: `${layout.previewY * 100}%`,
            width: `${layout.previewWidth * 100}%`,
            height: `${layout.previewHeight * 100}%`,
            zIndex: isSelected ? 120 : 30 + trackIndex,
          }}
          onPointerDown={(event) => startMoveInteraction(event, clip)}
        >
          <div className={styles.previewElementContent}>{renderElementContent(clip, trackType)}</div>

          {isSelected
            ? RESIZE_HANDLES.map((handle) => (
                <button
                  key={`${clip.id}-${handle}`}
                  type="button"
                  className={`${styles.previewOverlayResizeHandle} ${styles[`previewOverlayResizeHandle${handle.toUpperCase()}`]}`}
                  aria-label={`Resize ${clip.name} from ${handle}`}
                  onPointerDown={(event) => startResizeInteraction(event, clip, handle)}
                />
              ))
            : null}
        </div>
      );
    },
    [getRenderedLayout, interactionState, renderElementContent, selectedClipIds, startMoveInteraction, startResizeInteraction],
  );

  return (
    <section
      className={`${styles.previewPanel} ${hasActiveVideo ? "" : styles.previewPanelEmpty}`}
      aria-label="Program preview"
    >
      <div
        ref={viewportRef}
        className={`${styles.previewViewport} ${styles.previewViewportCheckerboard} ${isExternalDragOver ? styles.previewViewportDropTarget : ""}`}
        onPointerDown={handleViewportPointerDown}
        onDragOver={handlePreviewDragOver}
        onDragLeave={handlePreviewDragLeave}
        onDrop={handlePreviewDrop}
      >
        {activeVideo?.clip.mediaUrl ? (
          <div className={styles.previewVideoFrame} style={previewFrameStyle}>
            <video
              key={`${activeVideo.clip.id}-main`}
              ref={mainVideoRef}
              src={activeVideo.clip.mediaUrl}
              className={styles.previewVideo}
              playsInline
              preload="metadata"
              onLoadedMetadata={handleMainVideoMetadata}
            />
            <div className={styles.previewOverlayLayer}>{activePreviewClips.map(renderOverlayItem)}</div>
          </div>
        ) : (
          <div className={styles.previewVideoFrame} style={previewFrameStyle}>
            <div className={styles.previewOverlayLayer}>{activePreviewClips.map(renderOverlayItem)}</div>
          </div>
        )}
      </div>
    </section>
  );
};















