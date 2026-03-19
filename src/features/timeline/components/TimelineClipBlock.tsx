import { PointerEvent } from "react";

import { TimelineTrackType, TimelineClip } from "@/features/timeline/types/timeline";

import { TimelineInteractionMode } from "./TimelinePanel";
import styles from "./TimelinePanel.module.css";

interface TimelineClipBlockProps {
  clip: TimelineClip;
  leftOffsetPx: number;
  widthPx: number;
  trackType: TimelineTrackType;
  isInteracting: boolean;
  isSelected: boolean;
  isGhost?: boolean;
  interactionMode?: TimelineInteractionMode;
  dragOffsetYPx?: number;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onResizeLeftPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onResizeRightPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
}

const sourceBadgeText: Record<NonNullable<TimelineClip["source"]>, string> = {
  timeline: "TL",
  asset: "AS",
  element: "EL",
};

export const TimelineClipBlock = ({
  clip,
  leftOffsetPx,
  widthPx,
  trackType,
  isInteracting,
  isSelected,
  isGhost = false,
  interactionMode,
  dragOffsetYPx = 0,
  onPointerDown,
  onResizeLeftPointerDown,
  onResizeRightPointerDown,
}: TimelineClipBlockProps) => {
  const clipColorClass =
    trackType === "video" ? styles.clipBlockVideo : trackType === "audio" ? styles.clipBlockAudio : styles.clipBlockSubtitle;
  const interactingClass = isInteracting ? styles.clipBlockDragging : "";
  const selectedClass = isSelected ? styles.clipBlockSelected : "";
  const ghostClass = isGhost ? styles.clipBlockGhost : "";

  return (
    <div
      className={`${styles.clipBlock} ${clipColorClass} ${interactingClass} ${selectedClass} ${ghostClass}`}
      style={{
        left: `${leftOffsetPx}px`,
        width: `${widthPx}px`,
        transform: `translateY(${dragOffsetYPx}px)`,
        cursor:
          interactionMode === "resize-left" || interactionMode === "resize-right"
            ? "ew-resize"
            : undefined,
      }}
      title={clip.name}
      data-clip-block="true"
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(event);
      }}
    >
      {!isGhost ? (
        <div
          className={`${styles.clipResizeHandle} ${styles.clipResizeHandleLeft}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            onResizeLeftPointerDown?.(event);
          }}
          aria-hidden="true"
        />
      ) : null}

      {clip.source ? <span className={styles.clipSourceBadge}>{sourceBadgeText[clip.source]}</span> : null}
      <span className={styles.clipName}>{clip.name}</span>

      {!isGhost ? (
        <div
          className={`${styles.clipResizeHandle} ${styles.clipResizeHandleRight}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            onResizeRightPointerDown?.(event);
          }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
};
