import { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from "react";

import { TimelineClip, TimelineTrack } from "@/features/timeline/types/timeline";

import { TimelineDragState, TimelineExternalPreview } from "./TimelinePanel";
import { TimelineClipBlock } from "./TimelineClipBlock";
import styles from "./TimelinePanel.module.css";

interface TimelineTrackRowProps {
  track: TimelineTrack;
  trackIndex: number;
  dragState: TimelineDragState | null;
  framePixelRatio: number;
  selectedClipIds: string[];
  isDropTarget: boolean;
  externalPreview: TimelineExternalPreview | null;
  onTrackDragOver: (event: ReactDragEvent<HTMLDivElement>, trackIndex: number) => void;
  onTrackDragLeave: (trackIndex: number) => void;
  onTrackDrop: (event: ReactDragEvent<HTMLDivElement>, trackIndex: number) => void;
  onLanePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onClipPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    clip: TimelineClip,
    trackId: string,
    trackIndex: number,
  ) => void;
  onResizeLeftPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    clip: TimelineClip,
    trackId: string,
    trackIndex: number,
  ) => void;
  onResizeRightPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    clip: TimelineClip,
    trackId: string,
    trackIndex: number,
  ) => void;
}

export const TimelineTrackRow = ({
  track,
  trackIndex,
  dragState,
  framePixelRatio,
  selectedClipIds,
  isDropTarget,
  externalPreview,
  onTrackDragOver,
  onTrackDragLeave,
  onTrackDrop,
  onLanePointerDown,
  onClipPointerDown,
  onResizeLeftPointerDown,
  onResizeRightPointerDown,
}: TimelineTrackRowProps) => {
  const trackLaneClassName = `${styles.trackLane} ${isDropTarget ? styles.trackLaneDropTarget : ""}`;

  return (
    <div className={styles.trackRow} data-track-row="true">
      <div className={styles.trackLabel}>{track.name}</div>
      <div
        className={trackLaneClassName}
        onPointerDown={onLanePointerDown}
        onDragOver={(event) => onTrackDragOver(event, trackIndex)}
        onDragLeave={() => onTrackDragLeave(trackIndex)}
        onDrop={(event) => onTrackDrop(event, trackIndex)}
      >
        {track.clips.map((clip) => {
          const activeDragState = dragState?.clip.id === clip.id ? dragState : null;
          const isInteracting = activeDragState !== null;
          const leftOffsetPx = isInteracting
            ? activeDragState.previewStartFrame * framePixelRatio
            : clip.startFrame * framePixelRatio;
          const widthPx = isInteracting
            ? Math.max(activeDragState.previewDurationFrames * framePixelRatio, 32)
            : Math.max(clip.durationFrames * framePixelRatio, 32);
          const dragOffsetYPx =
            isInteracting && activeDragState.mode === "move"
              ? activeDragState.currentPointerY - activeDragState.startPointerY
              : 0;

          return (
            <TimelineClipBlock
              key={clip.id}
              clip={clip}
              leftOffsetPx={leftOffsetPx}
              widthPx={widthPx}
              trackType={track.type}
              isInteracting={isInteracting}
              isSelected={selectedClipIds.includes(clip.id)}
              interactionMode={activeDragState?.mode}
              dragOffsetYPx={dragOffsetYPx}
              onPointerDown={(event) => onClipPointerDown(event, clip, track.id, trackIndex)}
              onResizeLeftPointerDown={(event) =>
                onResizeLeftPointerDown(event, clip, track.id, trackIndex)
              }
              onResizeRightPointerDown={(event) =>
                onResizeRightPointerDown(event, clip, track.id, trackIndex)
              }
            />
          );
        })}

        {externalPreview && externalPreview.trackIndex === trackIndex ? (
          <TimelineClipBlock
            clip={{
              id: "preview",
              name: externalPreview.label,
              startFrame: externalPreview.startFrame,
              durationFrames: externalPreview.durationFrames,
              source: externalPreview.source,
            }}
            leftOffsetPx={externalPreview.startFrame * framePixelRatio}
            widthPx={Math.max(externalPreview.durationFrames * framePixelRatio, 32)}
            trackType={externalPreview.mediaType}
            isInteracting
            isSelected={false}
            isGhost
          />
        ) : null}
      </div>
    </div>
  );
};
