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
  id: "schema-hero-cut",
  title: "hero-cut",
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 1380,
  backgroundColor: "#0e1420",
  scenes: [
    {
      id: "scene-intro",
      name: "Intro",
      startFrame: 0,
      durationInFrames: 390,
      backgroundColor: "#0f1a2a",
      elements: [
        {
          id: "intro-video",
          kind: "video",
          src: "/videos/IMG_1507.MP4",
          startFrame: 0,
          durationInFrames: 390,
          x: 0,
          y: 0,
          width: 1080,
          height: 1920,
          objectFit: "cover",
          animations: [
            { type: "scale", from: 1.06, to: 1, startFrame: 0, durationInFrames: 390, easing: "ease-out" },
          ],
        },
        {
          id: "intro-title",
          kind: "text",
          text: "Build faster with Compis",
          startFrame: 24,
          durationInFrames: 250,
          x: 64,
          y: 150,
          width: 952,
          height: 110,
          color: "#ffffff",
          fontSize: 74,
          fontWeight: 700,
          lineHeight: 1.05,
          textAlign: "left",
          animations: [
            { type: "fade", from: 0, to: 1, startFrame: 0, durationInFrames: 24, easing: "ease-out" },
            { type: "move", from: { x: 64, y: 185 }, to: { x: 64, y: 150 }, startFrame: 0, durationInFrames: 24, easing: "ease-out" },
          ],
        },
      ],
    },
    {
      id: "scene-middle",
      name: "Highlights",
      startFrame: 390,
      durationInFrames: 540,
      backgroundColor: "#0a1320",
      elements: [
        {
          id: "middle-video",
          kind: "video",
          src: "/videos/IMG_1507.MP4",
          startFrame: 0,
          durationInFrames: 540,
          x: 0,
          y: 0,
          width: 1080,
          height: 1920,
          objectFit: "cover",
          opacity: 0.82,
        },
        {
          id: "middle-card",
          kind: "shape",
          shape: "rect",
          fill: "rgba(13, 21, 35, 0.65)",
          startFrame: 18,
          durationInFrames: 470,
          x: 54,
          y: 1110,
          width: 972,
          height: 620,
          borderRadius: 34,
          animations: [{ type: "fade", from: 0, to: 1, startFrame: 0, durationInFrames: 18 }],
        },
        {
          id: "middle-copy",
          kind: "text",
          text: "JSON -> Scenes -> Elements -> Render",
          startFrame: 44,
          durationInFrames: 390,
          x: 88,
          y: 1184,
          width: 904,
          height: 220,
          color: "#ffffff",
          fontSize: 62,
          fontWeight: 700,
          lineHeight: 1.12,
          textAlign: "left",
          animations: [
            { type: "fade", from: 0, to: 1, startFrame: 0, durationInFrames: 18 },
            { type: "move", from: { x: 88, y: 1218 }, to: { x: 88, y: 1184 }, startFrame: 0, durationInFrames: 18 },
          ],
        },
      ],
    },
    {
      id: "scene-outro",
      name: "Outro",
      startFrame: 930,
      durationInFrames: 450,
      backgroundColor: "#101a2b",
      elements: [
        {
          id: "outro-background",
          kind: "shape",
          shape: "rect",
          fill: "#101a2b",
          startFrame: 0,
          durationInFrames: 450,
          x: 0,
          y: 0,
          width: 1080,
          height: 1920,
        },
        {
          id: "outro-logo",
          kind: "text",
          text: "Compis",
          startFrame: 24,
          durationInFrames: 340,
          x: 0,
          y: 730,
          width: 1080,
          height: 170,
          color: "#ffffff",
          fontSize: 126,
          fontWeight: 800,
          letterSpacing: 1.2,
          textAlign: "center",
          animations: [
            { type: "fade", from: 0, to: 1, startFrame: 0, durationInFrames: 26, easing: "ease-out" },
            { type: "scale", from: 0.82, to: 1, startFrame: 0, durationInFrames: 26, easing: "ease-out" },
          ],
        },
        {
          id: "outro-caption",
          kind: "text",
          text: "AI video editor powered by Remotion",
          startFrame: 72,
          durationInFrames: 300,
          x: 0,
          y: 920,
          width: 1080,
          height: 72,
          color: "#8ca2c2",
          fontSize: 42,
          fontWeight: 500,
          textAlign: "center",
          animations: [{ type: "fade", from: 0, to: 1, startFrame: 0, durationInFrames: 18 }],
        },
      ],
    },
  ],
};
