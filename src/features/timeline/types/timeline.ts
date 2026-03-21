export type TimelineTrackType = "video" | "audio" | "subtitle";

export type TimelineTextAlign = "left" | "center" | "right";

export interface TimelineClipContent {
  displayText?: string;
  narrationText?: string;
  designIntent?: string;
}

export interface TimelineElementStyle {
  fillColor?: string;
  accentColor?: string;
  textColor?: string;
  strokeColor?: string;
  strokeWidthPx?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  opacity?: number;
  borderRadiusPx?: number;
  textAlign?: TimelineTextAlign;
  fontFamily?: string;
  fontSizePx?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacingEm?: number;
  paddingXPx?: number;
  paddingYPx?: number;
}

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
  elementPreset?: string;
  content?: TimelineClipContent;
  elementStyle?: TimelineElementStyle;
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
  aspectRatio?: number;
  tracks: TimelineTrack[];
}



