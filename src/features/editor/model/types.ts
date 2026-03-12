import { VideoElement } from "./schema";

export type EditorProps = {
  slug: string;
};

export type AssetKind = "video" | "audio" | "image" | "other";

export type AssetItem = {
  id: string;
  name: string;
  kind: AssetKind;
  src?: string;
  source?: "server" | "local";
  mimeType?: string;
  durationInSeconds?: number;
  width?: number;
  height?: number;
  sizeLabel: string;
  mediaLabel?: string;
  revokeOnDispose?: boolean;
};

export type CompositionViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
};

export type OverlayTrack = {
  trackType: "element" | "audio";
  sceneId: string;
  sceneName: string;
  elementId: string;
  elementIndex: number;
  lane: number;
  elementKind: VideoElement["kind"] | "audio";
  elementName: string;
  startFrame: number;
  durationInFrames: number;
  trimStartFrames: number;
  trimEndFrames: number;
  start: number;
  width: number;
  meta: string;
  visualKind: TrackVisualKind;
  previewSrc?: string;
  readonly?: boolean;
};

export type TrackVisualKind = "video" | "audio" | "text" | "shape" | "image";

export type DragState = {
  sceneId: string;
  elementIndex: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  renderDeltaX: number;
  renderDeltaY: number;
};

export type OverlayResizeState = {
  sceneId: string;
  elementIndex: number;
  element: VideoElement;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  directionX: -1 | 0 | 1;
  directionY: -1 | 0 | 1;
};

export type TimelineDragState =
  | {
      kind: "scene";
      sceneId: string;
      startFrame: number;
      startLane: number;
      maxLane: number;
      pointerOffsetFrames?: number;
      startClientX: number;
      startClientY: number;
    }
  | {
      kind: "element";
      sceneId: string;
      elementIndex: number;
      startFrame: number;
      startLane: number;
      maxLane: number;
      pointerOffsetFrames?: number;
      startClientX: number;
      startClientY: number;
    };

export type TimelineTrimState =
  | {
      kind: "scene";
      sceneId: string;
      edge: "left" | "right";
      startFrame: number;
      durationInFrames: number;
      trimStartFrames: number;
      trimEndFrames: number;
      sourceStartFrame: number;
      sourceEndFrame: number;
      startClientX: number;
    }
  | {
      kind: "element";
      sceneId: string;
      elementIndex: number;
      edge: "left" | "right";
      startFrame: number;
      durationInFrames: number;
      trimStartFrames: number;
      trimEndFrames: number;
      sourceStartFrame: number;
      sourceEndFrame: number;
      startClientX: number;
    };

export type SelectedTimelineTrack =
  | {
      kind: "scene";
      sceneId: string;
    }
  | {
      kind: "element";
      sceneId: string;
      elementIndex: number;
    };

export type ElementsLibraryIcon =
  | "triangle-outline"
  | "circle-outline"
  | "square-outline"
  | "star-outline"
  | "triangle-solid"
  | "circle-solid"
  | "square-solid"
  | "star-solid"
  | "arrow-right"
  | "slash"
  | "media"
  | "screen"
  | "camera"
  | "timer"
  | "compose"
  | "marker"
  | "speaker"
  | "wave-lines"
  | "ring"
  | "rings"
  | "wave"
  | "bar"
  | "spinner"
  | "pie";

export type ElementsLibrarySection = {
  title: string;
  showInfo?: boolean;
  items: Array<{
    label: string;
    icon?: ElementsLibraryIcon;
    emphasis?: boolean;
  }>;
};

export type ActiveOverlayElement = {
  sceneId: string;
  sceneName: string;
  elementIndex: number;
  renderedX: number;
  renderedY: number;
  element: VideoElement;
};





