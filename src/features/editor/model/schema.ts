export type EasingName = "linear" | "ease-in-out" | "ease-out";

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
  zIndex?: number;
  animations?: ElementAnimation[];
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
      objectFit?: "cover" | "contain";
    })
  | (BaseElement & {
      kind: "image";
      src: string;
      objectFit?: "cover" | "contain";
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
  elements: VideoElement[];
};

export type VideoSchema = {
  id: string;
  title: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  backgroundColor: string;
  scenes: VideoScene[];
};

export const demoVideoSchema: VideoSchema = {
  id: "schema-empty",
  title: "new-project",
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 300,
  backgroundColor: "#0e1420",
  scenes: [],
};
