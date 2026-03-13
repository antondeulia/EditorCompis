export type EasingName = "linear" | "ease-in-out" | "ease-out";
export type PlatformPreset =
  | "youtube-16-9"
  | "youtube-shorts-9-16"
  | "tiktok-9-16"
  | "instagram-reels-9-16"
  | "instagram-feed-1-1"
  | "facebook-16-9"
  | "custom";

export type ObjectFit = "cover" | "contain" | "fill";
export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
export type TransitionType =
  | "cut"
  | "fade"
  | "dissolve"
  | "wipe-left"
  | "wipe-right"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "zoom-out"
  | "blur";

export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type VideoSchemaVersion = 1;

export type TimelineTransition = {
  type: TransitionType;
  durationInFrames: number;
  easing?: EasingName;
};

export type SceneCameraKeyframe = {
  frame: number;
  zoom?: number;
  panX?: number;
  panY?: number;
  rotation?: number;
  easing?: EasingName;
};

export type SceneEffect =
  | { type: "blur"; amount: number }
  | { type: "brightness"; value: number }
  | { type: "contrast"; value: number }
  | { type: "saturation"; value: number }
  | { type: "hue-rotate"; degrees: number }
  | { type: "vignette"; amount: number };

export type AudioTrack = {
  id: string;
  kind: "voiceover" | "music" | "sfx";
  src: string;
  assetId?: string;
  source?: "library" | "user-upload" | "generated";
  startFrame: number;
  durationInFrames: number;
  volume?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
};

export type ElementAnimation =
  | {
      type: "fade";
      from: number;
      to: number;
      startFrame: number;
      durationInFrames: number;
      easing?: EasingName;
    }
  | {
      type: "move";
      from: { x: number; y: number };
      to: { x: number; y: number };
      startFrame: number;
      durationInFrames: number;
      easing?: EasingName;
    }
  | {
      type: "scale";
      from: number;
      to: number;
      startFrame: number;
      durationInFrames: number;
      easing?: EasingName;
    }
  | {
      type: "rotate";
      from: number;
      to: number;
      startFrame: number;
      durationInFrames: number;
      easing?: EasingName;
    }
  | {
      type: "zoom-in";
      from: number;
      to: number;
      startFrame: number;
      durationInFrames: number;
      easing?: EasingName;
    }
  | {
      type: "zoom-out";
      from: number;
      to: number;
      startFrame: number;
      durationInFrames: number;
      easing?: EasingName;
    }
  | {
      type: "pan";
      from: { x: number; y: number };
      to: { x: number; y: number };
      startFrame: number;
      durationInFrames: number;
      easing?: EasingName;
    };

type BaseElement = {
  id: string;
  startFrame: number;
  timelineStartFrame?: number;
  timelineTrimStartFrames?: number;
  timelineTrimEndFrames?: number;
  timelineLane?: number;
  durationInFrames: number;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  rotation?: number;
  scale?: number;
  blendMode?: BlendMode;
  objectFit?: ObjectFit;
  transformOrigin?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  zIndex?: number;
  animations?: ElementAnimation[];
  effects?: SceneEffect[];
  transitionIn?: TimelineTransition;
  transitionOut?: TimelineTransition;
};

export type VideoElement =
  | (BaseElement & {
      kind: "text";
      text: string;
      color?: string;
      fontSize?: number;
      fontWeight?: number;
      fontFamily?: string;
      letterSpacing?: number;
      lineHeight?: number;
      textAlign?: "left" | "center" | "right";
      backgroundColor?: string;
      borderRadius?: number;
      padding?: number;
    })
  | (BaseElement & {
      kind: "shape";
      shape: "rect" | "circle";
      fill: string;
      borderRadius?: number;
    })
  | (BaseElement & {
      kind: "video";
      src: string;
      assetId?: string;
      source?: "library" | "user-upload" | "generated";
      playbackRate?: number;
      muted?: boolean;
    })
  | (BaseElement & {
      kind: "image";
      src: string;
      assetId?: string;
      source?: "library" | "user-upload" | "generated";
      borderRadius?: number;
    });

export type VideoScene = {
  id: string;
  name: string;
  startFrame: number;
  timelineTrimStartFrames?: number;
  timelineTrimEndFrames?: number;
  timelineLane?: number;
  durationInFrames: number;
  backgroundColor?: string;
  transitionIn?: TimelineTransition;
  transitionOut?: TimelineTransition;
  cameraKeyframes?: SceneCameraKeyframe[];
  effects?: SceneEffect[];
  audioTracks?: AudioTrack[];
  elements: VideoElement[];
};

export type VideoFormat = {
  preset: PlatformPreset;
  width: number;
  height: number;
  fps: number;
  safeAreaInsets?: SafeAreaInsets;
};

export type VideoSchema = {
  id: string;
  version: VideoSchemaVersion;
  title: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  backgroundColor: string;
  format: VideoFormat;
  globalTransitions?: {
    sceneDefaultIn?: TimelineTransition;
    sceneDefaultOut?: TimelineTransition;
  };
  audioTracks?: AudioTrack[];
  scenes: VideoScene[];
};

type LegacyVideoSchema = Omit<VideoSchema, "version" | "format"> & {
  version?: VideoSchemaVersion;
  format?: Partial<VideoFormat>;
};

type CreateVideoSchemaOptions = Partial<Pick<VideoSchema, "id" | "title" | "durationInFrames" | "backgroundColor">> & {
  format?: Partial<VideoFormat>;
  audioTracks?: AudioTrack[];
  scenes?: VideoScene[];
};

export const DEFAULT_VIDEO_FORMAT: VideoFormat = {
  preset: "youtube-shorts-9-16",
  width: 1080,
  height: 1920,
  fps: 30,
};

export function createVideoFormat(overrides?: Partial<VideoFormat>): VideoFormat {
  return {
    ...DEFAULT_VIDEO_FORMAT,
    ...overrides,
    safeAreaInsets: overrides?.safeAreaInsets,
  };
}

export function createEmptyVideoSchema(options?: CreateVideoSchemaOptions): VideoSchema {
  const format = createVideoFormat(options?.format);

  return {
    id: options?.id ?? `schema-${Date.now()}`,
    version: 1,
    title: options?.title ?? "",
    fps: format.fps,
    width: format.width,
    height: format.height,
    durationInFrames: options?.durationInFrames ?? format.fps * 10,
    backgroundColor: options?.backgroundColor ?? "#ffffff",
    format,
    audioTracks: options?.audioTracks,
    scenes: options?.scenes ?? [],
  };
}

export function hydrateVideoSchema(schema: LegacyVideoSchema): VideoSchema {
  const format = createVideoFormat({
    ...schema.format,
    width: schema.format?.width ?? schema.width,
    height: schema.format?.height ?? schema.height,
    fps: schema.format?.fps ?? schema.fps,
  });

  return {
    ...schema,
    version: 1,
    fps: format.fps,
    width: format.width,
    height: format.height,
    format,
  };
}
