export type TimelineTrackType = "video" | "audio" | "subtitle";

export interface TimelineSubtitleStyle {
  subtitleTextColor?: string;
  subtitleOutlineColor?: string;
  subtitleOutlineWidth?: number;
  subtitleBackgroundColor?: string;
  subtitleBackgroundOpacity?: number;
  subtitleFontWeight?: number;
  subtitleFontSizePx?: number;
  subtitleBorderRadiusPx?: number;
  subtitlePaddingXPx?: number;
  subtitlePaddingYPx?: number;
}

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
  subtitleStyle?: TimelineSubtitleStyle;
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



