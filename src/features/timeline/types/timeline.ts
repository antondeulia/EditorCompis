export type TimelineTrackType = "video" | "audio";

export interface TimelineClip {
  id: string;
  name: string;
  startFrame: number;
  durationFrames: number;
  source?: "timeline" | "asset" | "element";
  mediaUrl?: string;
  previewX?: number;
  previewY?: number;
  previewWidth?: number;
  previewHeight?: number;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: TimelineTrackType;
  clips: TimelineClip[];
}

export interface TimelineSequence {
  id: string;
  name: string;
  frameRate: number;
  durationFrames: number;
  tracks: TimelineTrack[];
}