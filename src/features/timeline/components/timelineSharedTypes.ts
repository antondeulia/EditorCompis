import { TimelineClip, TimelineTrackType } from "@/features/timeline/types/timeline";

export type TimelineInteractionMode = "move" | "resize-left" | "resize-right";

export interface TimelineDragState {
  clip: TimelineClip;
  mode: TimelineInteractionMode;
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
