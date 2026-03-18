import { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";

import { TimelineClip, TimelineTrack } from "@/features/timeline/types/timeline";

import { TimelineDragState, TimelineExternalPreview } from "./TimelinePanel";
import { TimelineTrackRow } from "./TimelineTrackRow";

interface TimelineTrackListProps {
  tracks: TimelineTrack[];
  dragState: TimelineDragState | null;
  framePixelRatio: number;
  selectedClipIds: string[];
  dropTargetTrackIndex: number | null;
  externalPreview: TimelineExternalPreview | null;
  trackListRef: RefObject<HTMLDivElement | null>;
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

export const TimelineTrackList = ({
  tracks,
  dragState,
  framePixelRatio,
  selectedClipIds,
  dropTargetTrackIndex,
  externalPreview,
  trackListRef,
  onTrackDragOver,
  onTrackDragLeave,
  onTrackDrop,
  onLanePointerDown,
  onClipPointerDown,
  onResizeLeftPointerDown,
  onResizeRightPointerDown,
}: TimelineTrackListProps) => {
  return (
    <div ref={trackListRef}>
      {tracks.map((track, trackIndex) => (
        <TimelineTrackRow
          key={track.id}
          track={track}
          trackIndex={trackIndex}
          dragState={dragState}
          framePixelRatio={framePixelRatio}
          selectedClipIds={selectedClipIds}
          isDropTarget={trackIndex === dropTargetTrackIndex}
          externalPreview={externalPreview}
          onTrackDragOver={onTrackDragOver}
          onTrackDragLeave={onTrackDragLeave}
          onTrackDrop={onTrackDrop}
          onLanePointerDown={onLanePointerDown}
          onClipPointerDown={onClipPointerDown}
          onResizeLeftPointerDown={onResizeLeftPointerDown}
          onResizeRightPointerDown={onResizeRightPointerDown}
        />
      ))}
    </div>
  );
};
