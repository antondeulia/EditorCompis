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
  safeAreaInsets?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
};

export type VideoSchema = {
  id: string;
  title: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  backgroundColor: string;
  format?: VideoFormat;
  globalTransitions?: {
    sceneDefaultIn?: TimelineTransition;
    sceneDefaultOut?: TimelineTransition;
  };
  audioTracks?: AudioTrack[];
  scenes: VideoScene[];
};

export function createEmptyVideoSchema(): VideoSchema {
  return {
    id: `schema-${Date.now()}`,
    title: "untitled-video",
    fps: 30,
    width: 1080,
    height: 1920,
    durationInFrames: 300,
    backgroundColor: "#ffffff",
    format: {
      preset: "youtube-shorts-9-16",
      width: 1080,
      height: 1920,
      fps: 30,
    },
    scenes: [],
  };
}

export const demoVideoSchema: VideoSchema = {
  id: "schema-education-whiteboard",
  title: "educational-whiteboard-demo",
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 720,
  backgroundColor: "#ffffff",
  scenes: [
    {
      id: "scene-intro",
      name: "Intro",
      startFrame: 0,
      durationInFrames: 210,
      backgroundColor: "#ffffff",
      elements: [
        {
          id: "intro-accent-top",
          kind: "shape",
          shape: "rect",
          startFrame: 0,
          durationInFrames: 210,
          x: 88,
          y: 218,
          width: 160,
          height: 14,
          fill: "#2563eb",
          borderRadius: 999,
          opacity: 0.95,
          animations: [
            {
              type: "fade",
              from: 0,
              to: 0.95,
              startFrame: 0,
              durationInFrames: 22,
              easing: "ease-out",
            },
          ],
        },
        {
          id: "intro-title",
          kind: "text",
          text: "How video\nediting works",
          startFrame: 10,
          durationInFrames: 190,
          x: 88,
          y: 262,
          width: 904,
          height: 320,
          color: "#0f172a",
          fontSize: 96,
          fontWeight: 800,
          fontFamily: "Manrope, Inter, sans-serif",
          lineHeight: 1.03,
          letterSpacing: -1.1,
          textAlign: "left",
          animations: [
            {
              type: "fade",
              from: 0,
              to: 1,
              startFrame: 0,
              durationInFrames: 26,
              easing: "ease-out",
            },
            {
              type: "move",
              from: { x: 88, y: 300 },
              to: { x: 88, y: 262 },
              startFrame: 0,
              durationInFrames: 30,
              easing: "ease-out",
            },
          ],
        },
        {
          id: "intro-subtitle",
          kind: "text",
          text: "A simple educational clip:\nscenes, text, and edit rhythm",
          startFrame: 48,
          durationInFrames: 142,
          x: 92,
          y: 644,
          width: 760,
          height: 170,
          color: "#334155",
          fontSize: 44,
          fontWeight: 500,
          fontFamily: "Inter, system-ui, sans-serif",
          lineHeight: 1.24,
          textAlign: "left",
          animations: [
            {
              type: "fade",
              from: 0,
              to: 1,
              startFrame: 0,
              durationInFrames: 18,
              easing: "ease-out",
            },
          ],
        },
      ],
    },
    {
      id: "scene-steps",
      name: "Key steps",
      startFrame: 210,
      durationInFrames: 300,
      backgroundColor: "#ffffff",
      elements: [
        {
          id: "steps-title",
          kind: "text",
          text: "3 steps to clean editing",
          startFrame: 0,
          durationInFrames: 300,
          x: 92,
          y: 164,
          width: 890,
          height: 120,
          color: "#111827",
          fontSize: 66,
          fontWeight: 800,
          fontFamily: "Manrope, Inter, sans-serif",
          lineHeight: 1.06,
          textAlign: "left",
          animations: [
            {
              type: "fade",
              from: 0,
              to: 1,
              startFrame: 0,
              durationInFrames: 20,
              easing: "ease-out",
            },
          ],
        },
        {
          id: "step-1",
          kind: "text",
          text: "1. Define your video goal",
          startFrame: 22,
          durationInFrames: 240,
          x: 124,
          y: 390,
          width: 830,
          height: 90,
          color: "#0f172a",
          fontSize: 52,
          fontWeight: 600,
          fontFamily: "Inter, system-ui, sans-serif",
          lineHeight: 1.16,
          textAlign: "left",
          animations: [
            {
              type: "fade",
              from: 0,
              to: 1,
              startFrame: 0,
              durationInFrames: 16,
              easing: "ease-out",
            },
            {
              type: "move",
              from: { x: 164, y: 390 },
              to: { x: 124, y: 390 },
              startFrame: 0,
              durationInFrames: 18,
              easing: "ease-out",
            },
          ],
        },
        {
          id: "step-2",
          kind: "text",
          text: "2. Build a clear timeline structure",
          startFrame: 96,
          durationInFrames: 176,
          x: 124,
          y: 506,
          width: 880,
          height: 90,
          color: "#0f172a",
          fontSize: 52,
          fontWeight: 600,
          fontFamily: "Inter, system-ui, sans-serif",
          lineHeight: 1.16,
          textAlign: "left",
          animations: [
            {
              type: "fade",
              from: 0,
              to: 1,
              startFrame: 0,
              durationInFrames: 16,
              easing: "ease-out",
            },
            {
              type: "move",
              from: { x: 164, y: 506 },
              to: { x: 124, y: 506 },
              startFrame: 0,
              durationInFrames: 18,
              easing: "ease-out",
            },
          ],
        },
        {
          id: "step-3",
          kind: "text",
          text: "3. Add highlights and check readability",
          startFrame: 168,
          durationInFrames: 132,
          x: 124,
          y: 622,
          width: 900,
          height: 100,
          color: "#0f172a",
          fontSize: 52,
          fontWeight: 600,
          fontFamily: "Inter, system-ui, sans-serif",
          lineHeight: 1.16,
          textAlign: "left",
          animations: [
            {
              type: "fade",
              from: 0,
              to: 1,
              startFrame: 0,
              durationInFrames: 16,
              easing: "ease-out",
            },
            {
              type: "move",
              from: { x: 164, y: 622 },
              to: { x: 124, y: 622 },
              startFrame: 0,
              durationInFrames: 18,
              easing: "ease-out",
            },
          ],
        },
      ],
    },
    {
      id: "scene-outro",
      name: "Outro",
      startFrame: 510,
      durationInFrames: 210,
      backgroundColor: "#ffffff",
      elements: [
        {
          id: "outro-circle",
          kind: "shape",
          shape: "circle",
          startFrame: 0,
          durationInFrames: 210,
          x: 780,
          y: 220,
          width: 220,
          height: 220,
          fill: "#dbeafe",
          opacity: 0.9,
          animations: [
            {
              type: "scale",
              from: 0.72,
              to: 1,
              startFrame: 0,
              durationInFrames: 26,
              easing: "ease-out",
            },
            {
              type: "fade",
              from: 0,
              to: 0.9,
              startFrame: 0,
              durationInFrames: 22,
              easing: "ease-out",
            },
          ],
        },
        {
          id: "outro-title",
          kind: "text",
          text: "Done!\nNow build\nyour lessons",
          startFrame: 12,
          durationInFrames: 190,
          x: 88,
          y: 354,
          width: 760,
          height: 340,
          color: "#0f172a",
          fontSize: 86,
          fontWeight: 800,
          fontFamily: "Manrope, Inter, sans-serif",
          lineHeight: 1.04,
          letterSpacing: -0.9,
          textAlign: "left",
          animations: [
            {
              type: "fade",
              from: 0,
              to: 1,
              startFrame: 0,
              durationInFrames: 20,
              easing: "ease-out",
            },
            {
              type: "move",
              from: { x: 88, y: 402 },
              to: { x: 88, y: 354 },
              startFrame: 0,
              durationInFrames: 24,
              easing: "ease-out",
            },
          ],
        },
        {
          id: "outro-note",
          kind: "text",
          text: "White background + high contrast text = better readability",
          startFrame: 86,
          durationInFrames: 112,
          x: 92,
          y: 760,
          width: 920,
          height: 90,
          color: "#475569",
          fontSize: 38,
          fontWeight: 500,
          fontFamily: "Inter, system-ui, sans-serif",
          textAlign: "left",
          animations: [
            {
              type: "fade",
              from: 0,
              to: 1,
              startFrame: 0,
              durationInFrames: 14,
              easing: "ease-out",
            },
          ],
        },
      ],
    },
  ],
};
