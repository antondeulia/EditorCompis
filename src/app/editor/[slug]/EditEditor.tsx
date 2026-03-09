"use client";

import Link from "next/link";
import {
  CSSProperties,
  ChangeEvent,
  ReactNode,
  PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Player, PlayerRef } from "@remotion/player";
import { PlaybackToolbar } from "./components/PlaybackToolbar/PlaybackToolbar";
import { TimelineInspector } from "./components/TimelineInspector/TimelineInspector";
import { VideoComposition } from "./remotion/VideoComposition";
import { demoVideoSchema, ElementAnimation, VideoElement, VideoSchema } from "./video-schema";
import styles from "./page.module.css";

type EditEditorProps = {
  slug: string;
};

type AssetKind = "video" | "audio" | "image" | "other";

type AssetItem = {
  id: string;
  name: string;
  kind: AssetKind;
  src?: string;
  sizeLabel: string;
  revokeOnDispose?: boolean;
};

type CompositionViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
};

type OverlayTrack = {
  sceneId: string;
  sceneName: string;
  elementId: string;
  elementIndex: number;
  elementKind: VideoElement["kind"];
  elementName: string;
  startFrame: number;
  durationInFrames: number;
  start: number;
  width: number;
  meta: string;
  visualKind: TrackVisualKind;
  previewSrc?: string;
};

type TrackVisualKind = "video" | "audio" | "text" | "shape" | "image";

type DragState = {
  sceneId: string;
  elementIndex: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  renderDeltaX: number;
  renderDeltaY: number;
};

type OverlayResizeState = {
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

type TimelineDragState =
  | {
      kind: "scene";
      sceneId: string;
      startFrame: number;
      pointerOffsetFrames?: number;
      startClientX: number;
    }
  | {
      kind: "element";
      sceneId: string;
      elementIndex: number;
      startFrame: number;
      pointerOffsetFrames?: number;
      startClientX: number;
    };

type SelectedTimelineTrack =
  | {
      kind: "scene";
      sceneId: string;
    }
  | {
      kind: "element";
      sceneId: string;
      elementIndex: number;
    };

const transportSeekStep = 5;
const keyboardSeekStep = 1;
const minTimelineZoom = 0;
const maxTimelineZoom = 100;
const timelineScaleBase = 0.5;
const timelineScaleSpan = 2.5;
const wheelZoomStep = 0.0018;
const timelineExtensionChunkSeconds = 30;
const timelineExtensionThresholdRatio = 0.4;
const rightSidebarSections = ["Project", "AI Tools", "Properties", "Elements", "Captions", "Media"] as const;
type RightSidebarSection = (typeof rightSidebarSections)[number];
type ElementsLibraryIcon =
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
type ElementsLibrarySection = {
  title: string;
  showInfo?: boolean;
  items: Array<{
    label: string;
    icon?: ElementsLibraryIcon;
    emphasis?: boolean;
  }>;
};
const editableOverlayKinds = new Set<VideoElement["kind"]>(["text", "shape", "image"]);
const overlayResizeHandles = [
  { key: "n", directionX: 0 as const, directionY: -1 as const },
  { key: "ne", directionX: 1 as const, directionY: -1 as const },
  { key: "e", directionX: 1 as const, directionY: 0 as const },
  { key: "se", directionX: 1 as const, directionY: 1 as const },
  { key: "s", directionX: 0 as const, directionY: 1 as const },
  { key: "sw", directionX: -1 as const, directionY: 1 as const },
  { key: "w", directionX: -1 as const, directionY: 0 as const },
  { key: "nw", directionX: -1 as const, directionY: -1 as const },
];
let textMeasureContext: CanvasRenderingContext2D | null = null;
const elementsLibrarySections: ElementsLibrarySection[] = [
  {
    title: "Text",
    items: [
      { label: "Text" },
      { label: "Subtitle" },
      { label: "Title", emphasis: true },
    ],
  },
  {
    title: "Basic",
    items: [
      { label: "", icon: "triangle-outline" },
      { label: "", icon: "circle-outline" },
      { label: "", icon: "square-outline" },
      { label: "", icon: "star-outline" },
      { label: "", icon: "triangle-solid" },
      { label: "", icon: "circle-solid" },
      { label: "", icon: "square-solid" },
      { label: "", icon: "star-solid" },
      { label: "", icon: "arrow-right" },
      { label: "", icon: "slash" },
    ],
  },
  {
    title: "Placeholder",
    items: [
      { label: "Media", icon: "media" },
      { label: "Screen", icon: "screen" },
      { label: "Camera", icon: "camera" },
    ],
  },
  {
    title: "Dynamic text",
    showInfo: true,
    items: [
      { label: "Timer", icon: "timer" },
      { label: "Compo...", icon: "compose" },
      { label: "Marker", icon: "marker" },
      { label: "Speaker", icon: "speaker" },
    ],
  },
  {
    title: "Waveforms",
    items: [
      { label: "Lines", icon: "wave-lines" },
      { label: "Circle", icon: "ring" },
      { label: "Rings", icon: "rings" },
      { label: "Wave", icon: "wave" },
    ],
  },
  {
    title: "Playback progress",
    items: [
      { label: "Bar", icon: "bar" },
      { label: "Spinner", icon: "spinner" },
      { label: "Pie", icon: "pie" },
    ],
  },
];

function renderElementsLibraryIcon(icon: ElementsLibraryIcon) {
  switch (icon) {
    case "triangle-outline":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3.5 3.7 15h12.6L10 3.5Z" />
        </svg>
      );
    case "circle-outline":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="6.3" />
        </svg>
      );
    case "square-outline":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="4.2" y="4.2" width="11.6" height="11.6" />
        </svg>
      );
    case "star-outline":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3.2 12 7.4l4.6.7-3.3 3.2.8 4.7-4.1-2.2-4.1 2.2.8-4.7-3.3-3.2 4.6-.7L10 3.2Z" />
        </svg>
      );
    case "triangle-solid":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3.5 3.7 15h12.6L10 3.5Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "circle-solid":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="6.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "square-solid":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="4.2" y="4.2" width="11.6" height="11.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "star-solid":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3.2 12 7.4l4.6.7-3.3 3.2.8 4.7-4.1-2.2-4.1 2.2.8-4.7-3.3-3.2 4.6-.7L10 3.2Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "arrow-right":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3.5 10h11M11 5.8l4.5 4.2-4.5 4.2" />
        </svg>
      );
    case "slash":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4.5 15.5 15.5 4.5" />
        </svg>
      );
    case "media":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3" y="5" width="8.8" height="10" rx="1.4" />
          <path d="M6.5 8.4 9.2 10l-2.7 1.6V8.4Z" />
          <rect x="9.8" y="8.2" width="7.2" height="7" rx="1.2" />
        </svg>
      );
    case "screen":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2.8" y="4.2" width="14.4" height="10" rx="1.4" />
          <path d="M8 16.3h4" />
          <circle cx="5.4" cy="6.8" r="0.7" fill="currentColor" stroke="none" />
          <circle cx="7.3" cy="6.8" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      );
    case "camera":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3" y="6" width="14" height="9" rx="1.6" />
          <circle cx="10" cy="10.5" r="2.2" />
          <path d="M6 6 7.2 4.8h5.6L14 6" />
        </svg>
      );
    case "timer":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M8 3.8h4M10 3.8v2" />
          <circle cx="10" cy="11" r="5.2" />
          <path d="M10 11 12.3 9.5" />
        </svg>
      );
    case "compose":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2.8" y="5" width="14.4" height="10" rx="1.7" />
          <path d="M5.5 8h3.5M5.5 11h5.2M11.8 10.8l2.4-2.4M12.8 8.4l1.4 1.4" />
        </svg>
      );
    case "marker":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6 3.8h8v12.4l-4-2.6-4 2.6V3.8Z" />
        </svg>
      );
    case "speaker":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="6.2" cy="10.2" r="2" />
          <path d="M10.5 8.2c1.2.6 2 1.8 2 3.1M12.5 6.5c2 .9 3.3 2.8 3.3 5" />
        </svg>
      );
    case "wave-lines":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 10v2M7 7v6M10 5v10M13 7v6M16 9v2" />
        </svg>
      );
    case "ring":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="5.3" />
        </svg>
      );
    case "rings":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8" cy="9.4" r="4.5" />
          <circle cx="12.2" cy="11.2" r="4.5" />
        </svg>
      );
    case "wave":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3.5 10c1.2 0 1.2-2 2.4-2s1.2 4 2.4 4 1.2-4 2.4-4 1.2 4 2.4 4 1.2-2 2.4-2" />
        </svg>
      );
    case "bar":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3.2" y="7.2" width="13.6" height="5.6" rx="1.2" />
          <rect x="3.2" y="7.2" width="5.3" height="5.6" rx="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "spinner":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 4.2a5.8 5.8 0 1 0 5.8 5.8" />
          <circle cx="15.8" cy="10" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "pie":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="6.2" />
          <path d="M10 10V3.8a6.2 6.2 0 0 1 6.2 6.2H10Z" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

function getTextContext() {
  if (textMeasureContext) {
    return textMeasureContext;
  }

  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  textMeasureContext = canvas.getContext("2d");
  return textMeasureContext;
}

function measureTextWidth(ctx: CanvasRenderingContext2D, text: string, letterSpacing: number) {
  if (!text) {
    return 0;
  }

  return ctx.measureText(text).width + Math.max(0, text.length - 1) * letterSpacing;
}

function getTextMinimumWidth(element: Extract<VideoElement, { kind: "text" }>) {
  const ctx = getTextContext();
  const fontSize = element.fontSize ?? 44;
  const fontWeight = element.fontWeight ?? 600;
  const fontFamily = element.fontFamily ?? "sans-serif";
  const letterSpacing = element.letterSpacing ?? 0;
  const padding = element.padding ?? 0;

  if (!ctx) {
    return Math.max(36, Math.round(fontSize * 1.2 + padding * 2));
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const tokens = element.text.split(/\s+/).filter(Boolean);
  const longestTokenWidth = tokens.reduce((maxWidth, token) => {
    return Math.max(maxWidth, measureTextWidth(ctx, token, letterSpacing));
  }, 0);
  const fallbackWidth = measureTextWidth(ctx, "MM", letterSpacing);

  return Math.max(36, Math.ceil(Math.max(longestTokenWidth, fallbackWidth) + padding * 2));
}

function getTextMinimumHeightForWidth(element: Extract<VideoElement, { kind: "text" }>, width: number) {
  const ctx = getTextContext();
  const fontSize = element.fontSize ?? 44;
  const fontWeight = element.fontWeight ?? 600;
  const fontFamily = element.fontFamily ?? "sans-serif";
  const letterSpacing = element.letterSpacing ?? 0;
  const lineHeightPx = fontSize * (element.lineHeight ?? 1.2);
  const padding = element.padding ?? 0;
  const minWidth = getTextMinimumWidth(element);
  const innerWidth = Math.max(1, Math.max(width, minWidth) - padding * 2);

  if (!ctx) {
    return Math.max(24, Math.ceil(lineHeightPx + padding * 2));
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const paragraphs = element.text.split(/\r?\n/);
  const spaceWidth = measureTextWidth(ctx, " ", letterSpacing);
  let lineCount = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lineCount += 1;
      continue;
    }

    let currentLineWidth = 0;
    let paragraphLineCount = 1;
    for (const word of words) {
      const wordWidth = measureTextWidth(ctx, word, letterSpacing);
      if (currentLineWidth === 0) {
        currentLineWidth = wordWidth;
        continue;
      }

      const nextLineWidth = currentLineWidth + spaceWidth + wordWidth;
      if (nextLineWidth <= innerWidth) {
        currentLineWidth = nextLineWidth;
      } else {
        paragraphLineCount += 1;
        currentLineWidth = wordWidth;
      }
    }

    lineCount += paragraphLineCount;
  }

  return Math.max(24, Math.ceil(lineCount * lineHeightPx + padding * 2));
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "File";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00.00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function resolveAnimationEasing(name?: ElementAnimation["easing"]) {
  if (name === "ease-in-out") {
    return (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
  }

  if (name === "ease-out") {
    return (t: number) => 1 - (1 - t) ** 3;
  }

  return (t: number) => t;
}

function getRenderedElementPosition(element: VideoElement, localFrame: number) {
  let x = element.x;
  let y = element.y;

  for (const animation of element.animations ?? []) {
    if (animation.type !== "move") {
      continue;
    }

    const durationInFrames = Math.max(1, animation.durationInFrames);
    const progress = clamp01((localFrame - animation.startFrame) / durationInFrames);
    const eased = resolveAnimationEasing(animation.easing)(progress);
    x = animation.from.x + (animation.to.x - animation.from.x) * eased;
    y = animation.from.y + (animation.to.y - animation.from.y) * eased;
  }

  return { x, y };
}

function collectAssetsFromSchema(schema: VideoSchema): AssetItem[] {
  const assets: AssetItem[] = [];

  for (const scene of schema.scenes) {
    for (const element of scene.elements) {
      if (element.kind !== "video" && element.kind !== "image") {
        continue;
      }

      assets.push({
        id: `${scene.id}-${element.id}`,
        name: element.src.split("/").pop() ?? element.id,
        kind: element.kind,
        src: element.src,
        sizeLabel: element.kind === "video" ? "Video" : "Image",
      });
    }
  }

  return assets;
}

function getElementLabel(element: VideoElement) {
  if (element.kind === "text") {
    return element.text.slice(0, 26) || "Text";
  }

  if (element.kind === "shape") {
    return element.shape === "circle" ? "Circle" : "Rectangle";
  }

  if (element.kind === "image") {
    return element.src.split("/").pop() ?? "Image";
  }

  return element.src.split("/").pop() ?? "Video";
}

function getScenePrimaryElement(scene: VideoSchema["scenes"][number]) {
  return scene.elements.find((element) => element.kind === "video")
    ?? scene.elements.find((element) => element.kind === "image")
    ?? scene.elements.find((element) => element.kind === "text")
    ?? scene.elements.find((element) => element.kind === "shape")
    ?? null;
}

function getWaveformSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildWaveformBars(seedInput: string, barsCount: number) {
  const seed = getWaveformSeed(seedInput);
  return Array.from({ length: barsCount }, (_, index) => {
    const noise = Math.abs(Math.sin(seed * 0.013 + index * 0.77));
    return 20 + Math.round(noise * 72);
  });
}

const waveformBarsCache = new Map<string, number[]>();

function getWaveformBars(seedInput: string, barsCount: number) {
  const cacheKey = `${seedInput}:${barsCount}`;
  const cached = waveformBarsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const nextBars = buildWaveformBars(seedInput, barsCount);
  waveformBarsCache.set(cacheKey, nextBars);
  return nextBars;
}

function renderTrackVisual(params: {
  kind: TrackVisualKind;
  title: string;
  src?: string;
  waveformSeed?: string;
  durationInFrames?: number;
  fps?: number;
}): ReactNode {
  if (params.kind === "video" || params.kind === "image") {
    const frameCount = 6;

    return (
      <div className={styles.clipFrames}>
        {Array.from({ length: frameCount }, (_, index) => (
          <span key={index} className={styles.clipFrame}>
            {params.src ? (
              params.kind === "video" ? (
                <video
                  className={styles.clipFrameVideo}
                  src={
                    params.durationInFrames && params.fps
                      ? `${params.src}#t=${(((index + 0.5) / frameCount) * (params.durationInFrames / params.fps)).toFixed(2)}`
                      : params.src
                  }
                  muted
                  preload="none"
                  playsInline
                />
              ) : (
                <span className={styles.clipFrameImage} style={{ backgroundImage: `url("${params.src}")` }} />
              )
            ) : (
              <span className={styles.clipFrameFallback} />
            )}
          </span>
        ))}
      </div>
    );
  }

  if (params.kind === "audio") {
    const bars = getWaveformBars(params.waveformSeed ?? params.title, 42);
    return (
      <div className={styles.audioWave}>
        {bars.map((height, index) => (
          <span key={index} className={styles.audioWaveBar} style={{ height: `${height}%` }} />
        ))}
      </div>
    );
  }

  return <div className={styles.textTrackFill} aria-hidden="true" />;
}

function getElementTimelineStart(sceneStartFrame: number, element: VideoElement) {
  if (editableOverlayKinds.has(element.kind)) {
    return element.timelineStartFrame ?? sceneStartFrame + element.startFrame;
  }

  return sceneStartFrame + element.startFrame;
}

function normalizeOverlayTimeline(schema: VideoSchema): VideoSchema {
  return {
    ...schema,
    scenes: schema.scenes.map((scene) => ({
      ...scene,
      elements: scene.elements.map((element) => {
        if (!editableOverlayKinds.has(element.kind) || element.timelineStartFrame !== undefined) {
          return element;
        }

        return {
          ...element,
          timelineStartFrame: scene.startFrame + element.startFrame,
        };
      }),
    })),
  };
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

export function EditEditor({ slug }: EditEditorProps) {
  const defaultSidebarWidth = 400;
  const defaultTimelineHeight = 290;
  const playerRef = useRef<PlayerRef>(null);
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const scrubZoneRef = useRef<HTMLButtonElement | null>(null);
  const timelineMainRef = useRef<HTMLDivElement | null>(null);
  const timelineTracksRef = useRef<HTMLDivElement | null>(null);
  const pendingTimelineScrollLeftRef = useRef<number | null>(null);
  const suppressTrackClickUntilRef = useRef(0);
  const assetUploadInputRef = useRef<HTMLInputElement | null>(null);
  const assetsRef = useRef<AssetItem[]>([]);
  const leftRailResizeStateRef = useRef({ startX: 0, startWidth: defaultSidebarWidth });
  const resizeStateRef = useRef({ startX: 0, startWidth: defaultSidebarWidth });
  const timelineResizeStateRef = useRef({ startY: 0, startHeight: defaultTimelineHeight });
  const chatScrollbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [videoSchema, setVideoSchema] = useState<VideoSchema>(() => normalizeOverlayTimeline(demoVideoSchema));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [selectedTimelineTrack, setSelectedTimelineTrack] = useState<SelectedTimelineTrack | null>(null);
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [overlayResizeState, setOverlayResizeState] = useState<OverlayResizeState | null>(null);
  const [timelineDragState, setTimelineDragState] = useState<TimelineDragState | null>(null);
  const [timelineHeight, setTimelineHeight] = useState(defaultTimelineHeight);
  const [timelineZoom, setTimelineZoom] = useState(38);
  const [timelineExtraFrames, setTimelineExtraFrames] = useState(0);
  const [isTimelineResizing, setIsTimelineResizing] = useState(false);
  const [timelinePlayheadMetrics, setTimelinePlayheadMetrics] = useState({ offsetLeft: 0, width: 1 });
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
  const [compositionViewport, setCompositionViewport] = useState<CompositionViewport>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    scale: 1,
  });
  const [isLeftRailResizing, setIsLeftRailResizing] = useState(false);
  const [leftRailWidth, setLeftRailWidth] = useState(defaultSidebarWidth);
  const [isInspectorResizing, setIsInspectorResizing] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(defaultSidebarWidth);
  const [isLeftRailCollapsed, setIsLeftRailCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [activeRightSidebarSection, setActiveRightSidebarSection] = useState<RightSidebarSection>("Properties");
  const [isRightSidebarPanelOpen, setIsRightSidebarPanelOpen] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState<"chat" | "assets">("chat");
  const [isChatScrollbarVisible, setIsChatScrollbarVisible] = useState(false);
  const [assets, setAssets] = useState<AssetItem[]>(() => [
    ...collectAssetsFromSchema(demoVideoSchema),
    { id: "audio-bed", name: "music-track.wav", kind: "audio", sizeLabel: "Audio" },
    { id: "captions", name: "captions.srt", kind: "other", sizeLabel: "Subtitle" },
  ]);

  const durationInFrames = videoSchema.durationInFrames;
  const fps = videoSchema.fps;
  const durationSeconds = durationInFrames / fps;
  const baseTimelineFrameSpan = useMemo(() => {
    // Ruler base length should be stable and not depend on dragged clip positions.
    return durationInFrames;
  }, [durationInFrames]);
  const timelineFrameSpan = baseTimelineFrameSpan + timelineExtraFrames;
  const timelineDurationSeconds = timelineFrameSpan / fps;
  const currentTime = currentFrame / fps;
  const maxTimelineFrame = Math.max(durationInFrames - 1, 0);
  const progress = maxTimelineFrame > 0 ? clamp(currentFrame / maxTimelineFrame, 0, 1) : 0;
  const boundedInspectorWidth = Math.max(inspectorWidth, 250);
  const timelineZoomScale = timelineScaleBase + (timelineZoom / 100) * timelineScaleSpan;
  const timelineSpanRatio = durationInFrames > 0 ? timelineFrameSpan / durationInFrames : 1;
  const timelineContentWidth = `${timelineZoomScale * timelineSpanRatio * 100}%`;
  const playheadLeftPx = clamp(
    timelinePlayheadMetrics.offsetLeft + progress * timelinePlayheadMetrics.width,
    timelinePlayheadMetrics.offsetLeft,
    timelinePlayheadMetrics.offsetLeft + timelinePlayheadMetrics.width,
  );

  const timelineMarks = useMemo(
    () => Array.from({ length: 6 }, (_, i) => formatTime((timelineDurationSeconds * i) / 5)),
    [timelineDurationSeconds],
  );

  const getSceneClipKindClassName = useCallback((kind: TrackVisualKind) => {
    switch (kind) {
      case "text":
        return styles.sceneClipText;
      case "shape":
        return styles.sceneClipShape;
      case "audio":
        return styles.sceneClipAudio;
      default:
        return styles.sceneClipVideo;
    }
  }, []);

  const getElementClipKindClassName = useCallback((kind: TrackVisualKind) => {
    switch (kind) {
      case "text":
        return styles.elementClipText;
      case "shape":
        return styles.elementClipShape;
      case "audio":
        return styles.elementClipAudio;
      default:
        return styles.elementClipVideo;
    }
  }, []);

  const sceneTracks = useMemo(() => {
    return videoSchema.scenes.map((scene) => {
      const primaryElement = getScenePrimaryElement(scene);
      const visualKind: TrackVisualKind =
        primaryElement?.kind === "video" || primaryElement?.kind === "image"
          ? primaryElement.kind
          : primaryElement?.kind === "text"
            ? "text"
            : "shape";
      const previewSrc =
        primaryElement?.kind === "video" || primaryElement?.kind === "image" ? primaryElement.src : undefined;
      return {
        id: scene.id,
        name: scene.name,
        startFrame: scene.startFrame,
        durationInFrames: scene.durationInFrames,
        start: (scene.startFrame / timelineFrameSpan) * 100,
        width: (scene.durationInFrames / timelineFrameSpan) * 100,
        meta: `${(scene.durationInFrames / fps).toFixed(1)}s`,
        visualKind,
        previewSrc,
      };
    });
  }, [fps, timelineFrameSpan, videoSchema.scenes]);

  const overlayTracks = useMemo(() => {
    const tracks: OverlayTrack[] = [];

    for (const scene of videoSchema.scenes) {
      scene.elements.forEach((element, elementIndex) => {
        if (!editableOverlayKinds.has(element.kind)) {
          return;
        }

        const globalStartFrame = getElementTimelineStart(scene.startFrame, element);
        const globalDuration = Math.max(1, element.durationInFrames);
        tracks.push({
          sceneId: scene.id,
          sceneName: scene.name,
          elementId: element.id,
          elementIndex,
          elementKind: element.kind,
          elementName: getElementLabel(element),
          startFrame: globalStartFrame,
          durationInFrames: globalDuration,
          start: (globalStartFrame / timelineFrameSpan) * 100,
          width: (globalDuration / timelineFrameSpan) * 100,
          meta: `${(globalDuration / fps).toFixed(1)}s`,
          visualKind:
            element.kind === "video" || element.kind === "image"
              ? element.kind
              : element.kind === "text"
                ? "text"
                : "shape",
          previewSrc: element.kind === "video" || element.kind === "image" ? element.src : undefined,
        });
      });
    }

    return tracks;
  }, [fps, timelineFrameSpan, videoSchema.scenes]);

  const activeOverlayElements = useMemo(() => {
    const overlays: Array<{
      sceneId: string;
      sceneName: string;
      elementIndex: number;
      renderedX: number;
      renderedY: number;
      element: VideoElement;
    }> = [];

    for (const scene of videoSchema.scenes) {
      scene.elements.forEach((element, elementIndex) => {
        if (!editableOverlayKinds.has(element.kind)) {
          return;
        }

        const timelineStartFrame = getElementTimelineStart(scene.startFrame, element);
        if (currentFrame < timelineStartFrame || currentFrame >= timelineStartFrame + element.durationInFrames) {
          return;
        }
        const localFrame = currentFrame - timelineStartFrame;
        const renderedPosition = getRenderedElementPosition(element, localFrame);

        overlays.push({
          sceneId: scene.id,
          sceneName: scene.name,
          elementIndex,
          renderedX: renderedPosition.x,
          renderedY: renderedPosition.y,
          element,
        });
      });
    }

    return overlays;
  }, [currentFrame, videoSchema.scenes]);

  const selectedOverlayElement = useMemo(() => {
    if (!selectedElementKey) {
      return null;
    }

    const [sceneId, elementIndexToken] = selectedElementKey.split(":");
    const elementIndex = Number(elementIndexToken);
    if (!Number.isInteger(elementIndex)) {
      return null;
    }

    const scene = videoSchema.scenes.find((item) => item.id === sceneId);
    if (!scene) {
      return null;
    }

    const element = scene.elements[elementIndex];
    if (!element || !editableOverlayKinds.has(element.kind)) {
      return null;
    }

    return {
      sceneId,
      elementIndex,
      element,
    };
  }, [selectedElementKey, videoSchema.scenes]);

  const inspectorRows = useMemo(
    () => [
      ...videoSchema.scenes.map((scene) => ({
        id: scene.id,
        label: "<Scene>",
        meta: `${scene.name} - ${(scene.durationInFrames / fps).toFixed(1)}s`,
      })),
      ...overlayTracks.map((track) => ({
        id: `${track.sceneId}:${track.elementIndex}`,
        label: `<${track.elementKind}>`,
        meta: `${track.sceneName} / ${track.elementName}`,
      })),
    ],
    [fps, overlayTracks, videoSchema.scenes],
  );

  const seekToFrame = useCallback(
    (nextFrame: number) => {
      const player = playerRef.current;
      if (!player) {
        return;
      }

      const boundedFrame = clamp(Math.round(nextFrame), 0, Math.max(durationInFrames - 1, 0));
      player.seekTo(boundedFrame);
      setCurrentFrame(boundedFrame);
    },
    [durationInFrames],
  );

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const deltaFrames = Math.round(deltaSeconds * fps);
      seekToFrame(currentFrame + deltaFrames);
    },
    [currentFrame, fps, seekToFrame],
  );

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    if (isPlaying) {
      player.pause();
      return;
    }

    player.play();
  }, [isPlaying]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onFrameUpdate = ({ detail }: { detail: { frame: number } }) => setCurrentFrame(detail.frame);

    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);
    player.addEventListener("frameupdate", onFrameUpdate);

    setIsPlaying(player.isPlaying());
    setCurrentFrame(player.getCurrentFrame());

    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
      player.removeEventListener("frameupdate", onFrameUpdate);
    };
  }, []);

  const recalcCompositionViewport = useCallback(() => {
    const container = previewCanvasRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    const aspect = videoSchema.width / videoSchema.height;

    let fittedWidth = width;
    let fittedHeight = width / aspect;

    if (fittedHeight > height) {
      fittedHeight = height;
      fittedWidth = height * aspect;
    }

    const offsetX = (width - fittedWidth) / 2;
    const offsetY = (height - fittedHeight) / 2;

    setCompositionViewport({
      left: offsetX,
      top: offsetY,
      width: fittedWidth,
      height: fittedHeight,
      scale: fittedWidth / videoSchema.width,
    });
  }, [videoSchema.height, videoSchema.width]);

  useLayoutEffect(() => {
    recalcCompositionViewport();

    const container = previewCanvasRef.current;
    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      recalcCompositionViewport();
    });

    resizeObserver.observe(container);
    window.addEventListener("resize", recalcCompositionViewport);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", recalcCompositionViewport);
    };
  }, [recalcCompositionViewport]);

  const toCompositionCoordinates = useCallback(
    (clientX: number, clientY: number) => {
      const container = previewCanvasRef.current;
      if (!container) {
        return null;
      }

      if (compositionViewport.width <= 0 || compositionViewport.height <= 0) {
        return null;
      }

      const rect = container.getBoundingClientRect();
      const x =
        (clientX - (rect.left + compositionViewport.left)) / Math.max(compositionViewport.scale, 0.0001);
      const y =
        (clientY - (rect.top + compositionViewport.top)) / Math.max(compositionViewport.scale, 0.0001);

      return {
        x,
        y,
      };
    },
    [compositionViewport],
  );

  const updateElementPosition = useCallback(
    (sceneId: string, elementIndex: number, nextX: number, nextY: number) => {
      setVideoSchema((prev) => ({
        ...prev,
        scenes: prev.scenes.map((scene) => {
          if (scene.id !== sceneId) {
            return scene;
          }

          return {
            ...scene,
            elements: scene.elements.map((element, index) => {
              if (index !== elementIndex) {
                return element;
              }

              const minX = editableOverlayKinds.has(element.kind) ? -element.width : 0;
              const minY = editableOverlayKinds.has(element.kind) ? -element.height : 0;
              const maxX = editableOverlayKinds.has(element.kind) ? prev.width : Math.max(0, prev.width - element.width);
              const maxY =
                editableOverlayKinds.has(element.kind) ? prev.height : Math.max(0, prev.height - element.height);
              const boundedX = clamp(nextX, minX, maxX);
              const boundedY = clamp(nextY, minY, maxY);
              const deltaX = boundedX - element.x;
              const deltaY = boundedY - element.y;

              return {
                ...element,
                x: boundedX,
                y: boundedY,
                animations: element.animations?.map((animation) => {
                  if (animation.type !== "move") {
                    return animation;
                  }

                  return {
                    ...animation,
                    from: {
                      x: animation.from.x + deltaX,
                      y: animation.from.y + deltaY,
                    },
                    to: {
                      x: animation.to.x + deltaX,
                      y: animation.to.y + deltaY,
                    },
                  };
                }),
              };
            }),
          };
        }),
      }));
    },
    [],
  );

  const updateElementBounds = useCallback(
    (
      sceneId: string,
      elementIndex: number,
      nextX: number,
      nextY: number,
      nextWidth: number,
      nextHeight: number,
    ) => {
      setVideoSchema((prev) => ({
        ...prev,
        scenes: prev.scenes.map((scene) => {
          if (scene.id !== sceneId) {
            return scene;
          }

          return {
            ...scene,
            elements: scene.elements.map((element, index) => {
              if (index !== elementIndex || !editableOverlayKinds.has(element.kind)) {
                return element;
              }

              const minWidth = element.kind === "text" ? getTextMinimumWidth(element) : 36;
              const boundedWidth = clamp(Math.round(nextWidth), minWidth, prev.width * 2);
              const minHeight = element.kind === "text" ? getTextMinimumHeightForWidth(element, boundedWidth) : 24;
              const boundedHeight = clamp(Math.round(nextHeight), minHeight, prev.height * 2);
              const minX = -boundedWidth;
              const minY = -boundedHeight;
              const maxX = prev.width;
              const maxY = prev.height;

              return {
                ...element,
                x: clamp(Math.round(nextX), minX, maxX),
                y: clamp(Math.round(nextY), minY, maxY),
                width: boundedWidth,
                height: boundedHeight,
              };
            }),
          };
        }),
      }));
    },
    [],
  );

  const addTextTrack = useCallback(() => {
    let nextSelected: string | null = null;

    setVideoSchema((prev) => {
      if (prev.scenes.length === 0) {
        return prev;
      }

      const targetScene = prev.scenes[0];
      const globalStart = clamp(currentFrame, 0, Math.max(0, prev.durationInFrames - 1));
      const duration = Math.max(30, Math.min(180, prev.durationInFrames - globalStart));
      const id = `text-${Date.now().toString(36)}`;

      return {
        ...prev,
        scenes: prev.scenes.map((scene) => {
          if (scene.id !== targetScene.id) {
            return scene;
          }
          nextSelected = `${scene.id}:${scene.elements.length}`;

          return {
            ...scene,
            elements: [
              ...scene.elements,
              {
                id,
                kind: "text",
                text: "New text",
                startFrame: 0,
                timelineStartFrame: globalStart,
                durationInFrames: duration,
                x: 120,
                y: 180,
                width: 560,
                height: 120,
                color: "#ffffff",
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1.05,
                textAlign: "left",
              },
            ],
          };
        }),
      };
    });

    if (nextSelected) {
      setSelectedElementKey(nextSelected);
    }
  }, [currentFrame]);

  const deleteSceneTrack = useCallback((sceneId: string) => {
    setVideoSchema((prev) => ({
      ...prev,
      scenes: prev.scenes.filter((scene) => scene.id !== sceneId),
    }));
    setSelectedElementKey((prev) => (prev?.startsWith(`${sceneId}:`) ? null : prev));
    setSelectedTimelineTrack((prev) => {
      if (!prev) {
        return prev;
      }

      if (prev.sceneId !== sceneId) {
        return prev;
      }

      return null;
    });
  }, []);

  const deleteElementTrack = useCallback((sceneId: string, elementIndex: number) => {
    setVideoSchema((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => {
        if (scene.id !== sceneId) {
          return scene;
        }

        return {
          ...scene,
          elements: scene.elements.filter((_, index) => index !== elementIndex),
        };
      }),
    }));
    setSelectedElementKey((prev) => {
      if (!prev) {
        return prev;
      }

      const [selectedSceneId, selectedIndexToken] = prev.split(":");
      const selectedIndex = Number(selectedIndexToken);
      if (selectedSceneId !== sceneId || !Number.isInteger(selectedIndex)) {
        return prev;
      }

      if (selectedIndex === elementIndex) {
        return null;
      }

      if (selectedIndex > elementIndex) {
        return `${sceneId}:${selectedIndex - 1}`;
      }

      return prev;
    });
    setSelectedTimelineTrack((prev) => {
      if (!prev || prev.kind !== "element" || prev.sceneId !== sceneId) {
        return prev;
      }

      if (prev.elementIndex === elementIndex) {
        return null;
      }

      if (prev.elementIndex > elementIndex) {
        return {
          ...prev,
          elementIndex: prev.elementIndex - 1,
        };
      }

      return prev;
    });
  }, []);

  const splitElementTrack = useCallback((sceneId: string, elementIndex: number, splitFrame: number) => {
    let nextSelected: SelectedTimelineTrack | null = null;

    setVideoSchema((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => {
        if (scene.id !== sceneId) {
          return scene;
        }

        const targetElement = scene.elements[elementIndex];
        if (!targetElement || !editableOverlayKinds.has(targetElement.kind)) {
          return scene;
        }

        const elementStartFrame = getElementTimelineStart(scene.startFrame, targetElement);
        const elementEndFrame = elementStartFrame + Math.max(1, targetElement.durationInFrames);
        if (splitFrame <= elementStartFrame || splitFrame >= elementEndFrame) {
          return scene;
        }

        const firstDuration = splitFrame - elementStartFrame;
        const secondDuration = elementEndFrame - splitFrame;
        if (firstDuration < 1 || secondDuration < 1) {
          return scene;
        }

        const nextElements = [...scene.elements];
        const firstPart: VideoElement = {
          ...targetElement,
          durationInFrames: firstDuration,
        };
        const secondPart: VideoElement = {
          ...targetElement,
          id: `${targetElement.id}-part-${Date.now().toString(36)}`,
          timelineStartFrame: splitFrame,
          durationInFrames: secondDuration,
        };

        nextElements.splice(elementIndex, 1, firstPart, secondPart);
        nextSelected = {
          kind: "element",
          sceneId,
          elementIndex: elementIndex + 1,
        };

        return {
          ...scene,
          elements: nextElements,
        };
      }),
    }));

    if (nextSelected?.kind === "element") {
      setSelectedTimelineTrack(nextSelected);
      setSelectedElementKey(`${nextSelected.sceneId}:${nextSelected.elementIndex}`);
    }
  }, []);

  const splitSelectedTimelineTrack = useCallback(() => {
    if (!selectedTimelineTrack || selectedTimelineTrack.kind !== "element") {
      return;
    }

    splitElementTrack(selectedTimelineTrack.sceneId, selectedTimelineTrack.elementIndex, currentFrame);
  }, [currentFrame, selectedTimelineTrack, splitElementTrack]);

  const deleteSelectedTimelineTrack = useCallback(() => {
    if (!selectedTimelineTrack) {
      return;
    }

    if (selectedTimelineTrack.kind === "scene") {
      deleteSceneTrack(selectedTimelineTrack.sceneId);
      return;
    }

    deleteElementTrack(selectedTimelineTrack.sceneId, selectedTimelineTrack.elementIndex);
  }, [deleteElementTrack, deleteSceneTrack, selectedTimelineTrack]);

  const clearSelectionFocus = useCallback(() => {
    setSelectedTimelineTrack(null);
    setSelectedElementKey(null);
  }, []);

  const updateSelectedTextElement = useCallback(
    (updater: (element: Extract<VideoElement, { kind: "text" }>) => Extract<VideoElement, { kind: "text" }>) => {
      if (!selectedOverlayElement || selectedOverlayElement.element.kind !== "text") {
        return;
      }

      const { sceneId, elementIndex } = selectedOverlayElement;

      setVideoSchema((prev) => ({
        ...prev,
        scenes: prev.scenes.map((scene) => {
          if (scene.id !== sceneId) {
            return scene;
          }

          return {
            ...scene,
            elements: scene.elements.map((element, index) => {
              if (index !== elementIndex || element.kind !== "text") {
                return element;
              }

              return updater(element);
            }),
          };
        }),
      }));
    },
    [selectedOverlayElement],
  );

  const beginTimelineClipDrag = useCallback(
    (event: PointerEvent<HTMLElement>, state: TimelineDragState) => {
      event.preventDefault();
      event.stopPropagation();
      const scrubElement = scrubZoneRef.current;
      if (!scrubElement) {
        return;
      }

      const scrubRect = scrubElement.getBoundingClientRect();
      const scrubWidth = Math.max(scrubRect.width, 1);
      const pointerX = Math.max(0, event.clientX - scrubRect.left);
      const pointerFrame = (pointerX / scrubWidth) * timelineFrameSpan;
      const pointerOffsetFrames = pointerFrame - state.startFrame;

      if (state.kind === "scene") {
        setSelectedTimelineTrack({ kind: "scene", sceneId: state.sceneId });
        setSelectedElementKey(null);
      } else {
        setSelectedTimelineTrack({
          kind: "element",
          sceneId: state.sceneId,
          elementIndex: state.elementIndex,
        });
        setSelectedElementKey(`${state.sceneId}:${state.elementIndex}`);
      }

      setTimelineDragState({
        ...state,
        pointerOffsetFrames,
      });
    },
    [timelineFrameSpan],
  );

  useEffect(() => {
    if (!timelineDragState) {
      return;
    }

    const drag = timelineDragState;
    let hasMoved = false;
    let lastAppliedStartFrame = Number.NaN;
    let rafId: number | null = null;
    let pendingClientX: number | null = null;

    function applyDrag(clientX: number) {
      const scrub = scrubZoneRef.current;
      if (!scrub) {
        return;
      }

      const scrubRect = scrub.getBoundingClientRect();
      const scrubWidth = Math.max(scrubRect.width, 1);
      const pointerX = Math.max(0, clientX - scrubRect.left);
      const pointerFrame = (pointerX / scrubWidth) * timelineFrameSpan;
      const pointerOffsetFrames = drag.pointerOffsetFrames ?? 0;
      const nextStartFrame = Math.max(0, Math.round(pointerFrame - pointerOffsetFrames));

      if (nextStartFrame === lastAppliedStartFrame) {
        return;
      }
      lastAppliedStartFrame = nextStartFrame;

      if (nextStartFrame !== drag.startFrame) {
        hasMoved = true;
      }

      if (drag.kind === "scene") {
        setVideoSchema((prev) => {
          let hasChange = false;
          const nextScenes = prev.scenes.map((scene) => {
            if (scene.id !== drag.sceneId) {
              return scene;
            }

            if (scene.startFrame === nextStartFrame) {
              return scene;
            }

            hasChange = true;
            return {
              ...scene,
              startFrame: nextStartFrame,
            };
          });

          if (!hasChange) {
            return prev;
          }

          return {
            ...prev,
            scenes: nextScenes,
          };
        });

        return;
      }

      setVideoSchema((prev) => {
        let hasSceneChange = false;
        const nextScenes = prev.scenes.map((scene) => {
          if (scene.id !== drag.sceneId) {
            return scene;
          }

          let hasElementChange = false;
          const nextElements = scene.elements.map((element, index) => {
            if (index !== drag.elementIndex) {
              return element;
            }

            if (element.timelineStartFrame === nextStartFrame) {
              return element;
            }

            hasElementChange = true;

            return {
              ...element,
              timelineStartFrame: nextStartFrame,
            };
          });

          if (!hasElementChange) {
            return scene;
          }

          hasSceneChange = true;
          return {
            ...scene,
            elements: nextElements,
          };
        });

        if (!hasSceneChange) {
          return prev;
        }

        return {
          ...prev,
          scenes: nextScenes,
        };
      });
    }

    function flushPendingDrag() {
      rafId = null;
      if (pendingClientX === null) {
        return;
      }

      const clientX = pendingClientX;
      pendingClientX = null;
      applyDrag(clientX);
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      pendingClientX = event.clientX;
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(flushPendingDrag);
    }

    function stopDragging() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (pendingClientX !== null) {
        applyDrag(pendingClientX);
        pendingClientX = null;
      }

      if (hasMoved) {
        suppressTrackClickUntilRef.current = Date.now() + 150;
      }
      setTimelineDragState(null);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [timelineDragState, timelineFrameSpan]);

  const startOverlayDrag = useCallback(
    (
      event: PointerEvent<HTMLButtonElement>,
      sceneId: string,
      elementIndex: number,
      element: VideoElement,
      renderedX: number,
      renderedY: number,
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (!editableOverlayKinds.has(element.kind)) {
        return;
      }

      const coords = toCompositionCoordinates(event.clientX, event.clientY);
      if (!coords) {
        return;
      }

      setSelectedElementKey(`${sceneId}:${elementIndex}`);
      setSelectedTimelineTrack({
        kind: "element",
        sceneId,
        elementIndex,
      });
      setDragState({
        sceneId,
        elementIndex,
        pointerOffsetX: coords.x - renderedX,
        pointerOffsetY: coords.y - renderedY,
        renderDeltaX: renderedX - element.x,
        renderDeltaY: renderedY - element.y,
      });
    },
    [toCompositionCoordinates],
  );

  const startOverlayResize = useCallback(
    (
      event: PointerEvent<HTMLElement>,
      sceneId: string,
      elementIndex: number,
      element: VideoElement,
      directionX: -1 | 0 | 1,
      directionY: -1 | 0 | 1,
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (!editableOverlayKinds.has(element.kind)) {
        return;
      }

      setSelectedElementKey(`${sceneId}:${elementIndex}`);
      setOverlayResizeState({
        sceneId,
        elementIndex,
        element,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: element.x,
        startY: element.y,
        startWidth: element.width,
        startHeight: element.height,
        directionX,
        directionY,
      });
    },
    [],
  );

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const activeDrag = dragState;

    function handlePointerMove(event: globalThis.PointerEvent) {
      const coords = toCompositionCoordinates(event.clientX, event.clientY);
      if (!coords) {
        return;
      }

      updateElementPosition(
        activeDrag.sceneId,
        activeDrag.elementIndex,
        coords.x - activeDrag.pointerOffsetX - activeDrag.renderDeltaX,
        coords.y - activeDrag.pointerOffsetY - activeDrag.renderDeltaY,
      );
    }

    function stopDragging() {
      setDragState(null);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [dragState, toCompositionCoordinates, updateElementPosition]);

  useEffect(() => {
    if (!overlayResizeState) {
      return;
    }

    const activeResize = overlayResizeState;

    function handlePointerMove(event: globalThis.PointerEvent) {
      const scale = Math.max(compositionViewport.scale, 0.0001);
      const deltaX = (event.clientX - activeResize.startClientX) / scale;
      const deltaY = (event.clientY - activeResize.startClientY) / scale;
      const minWidth = activeResize.element.kind === "text" ? getTextMinimumWidth(activeResize.element) : 36;
      let left = activeResize.startX;
      let right = activeResize.startX + activeResize.startWidth;
      let top = activeResize.startY;
      let bottom = activeResize.startY + activeResize.startHeight;

      if (activeResize.directionX === -1) {
        left += deltaX;
      } else if (activeResize.directionX === 1) {
        right += deltaX;
      }

      if (activeResize.directionY === -1) {
        top += deltaY;
      } else if (activeResize.directionY === 1) {
        bottom += deltaY;
      }

      if (right - left < minWidth) {
        if (activeResize.directionX === -1) {
          left = right - minWidth;
        } else if (activeResize.directionX === 1) {
          right = left + minWidth;
        }
      }

      const minHeight =
        activeResize.element.kind === "text"
          ? getTextMinimumHeightForWidth(activeResize.element, right - left)
          : 24;

      if (bottom - top < minHeight) {
        if (activeResize.directionY === -1) {
          top = bottom - minHeight;
        } else if (activeResize.directionY === 1) {
          bottom = top + minHeight;
        }
      }

      updateElementBounds(
        activeResize.sceneId,
        activeResize.elementIndex,
        left,
        top,
        right - left,
        bottom - top,
      );
    }

    function stopResizing() {
      setOverlayResizeState(null);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [compositionViewport.scale, overlayResizeState, updateElementBounds]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekBy(-keyboardSeekStep);
        return;
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        seekBy(keyboardSeekStep);
        return;
      }

      if (event.code === "KeyB") {
        event.preventDefault();
        splitSelectedTimelineTrack();
        return;
      }

      if (event.code === "Backspace" || event.code === "Delete") {
        event.preventDefault();
        deleteSelectedTimelineTrack();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteSelectedTimelineTrack, seekBy, splitSelectedTimelineTrack, togglePlay]);

  function rewind() {
    seekBy(-transportSeekStep);
  }

  function forward() {
    seekBy(transportSeekStep);
  }

  const handleSeek = useCallback((nextTime: number) => {
    seekToFrame(nextTime * fps);
  }, [fps, seekToFrame]);

  const handleTimelineZoomChange = useCallback((nextZoom: number) => {
    setTimelineZoom(clamp(nextZoom, minTimelineZoom, maxTimelineZoom));
  }, []);

  const adjustTimelineZoom = useCallback((delta: number) => {
    setTimelineZoom((prev) => clamp(prev + delta, minTimelineZoom, maxTimelineZoom));
  }, []);

  const applyTimelineWheelZoom = useCallback((deltaY: number, clientX: number) => {
    const timelineElement = timelineTracksRef.current;
    if (!timelineElement) {
      return;
    }

    const rect = timelineElement.getBoundingClientRect();
    const mouseX = clamp(clientX - rect.left, 0, rect.width);
    const minScale = timelineScaleBase + (minTimelineZoom / 100) * timelineScaleSpan;
    const maxScale = timelineScaleBase + (maxTimelineZoom / 100) * timelineScaleSpan;
    const oldScale = timelineScaleBase + (timelineZoom / 100) * timelineScaleSpan;
    const zoomFactor = Math.exp(-deltaY * wheelZoomStep);
    const newScale = clamp(oldScale * zoomFactor, minScale, maxScale);

    if (Math.abs(newScale - oldScale) < 0.0001) {
      return;
    }

    const timeUnderCursor = (timelineElement.scrollLeft + mouseX) / oldScale;
    const nextScrollLeft = Math.max(0, timeUnderCursor * newScale - mouseX);
    pendingTimelineScrollLeftRef.current = nextScrollLeft;

    const nextZoom = ((newScale - timelineScaleBase) / timelineScaleSpan) * 100;
    setTimelineZoom(clamp(nextZoom, minTimelineZoom, maxTimelineZoom));
  }, [timelineZoom]);

  useLayoutEffect(() => {
    const timelineElement = timelineTracksRef.current;
    const timelineMainElement = timelineMainRef.current;
    const scrubZoneElement = scrubZoneRef.current;

    if (!timelineElement || !timelineMainElement || !scrubZoneElement) {
      return;
    }

    function updatePlayheadMetrics() {
      const scrubRect = scrubZoneElement.getBoundingClientRect();
      const mainRect = timelineMainElement.getBoundingClientRect();
      const nextOffsetLeft = scrubRect.left - mainRect.left;
      const nextWidth = Math.max(scrubRect.width, 1);
      const nextScrollLeft = timelineElement.scrollLeft;

      setTimelinePlayheadMetrics((prev) => {
        if (Math.abs(prev.offsetLeft - nextOffsetLeft) < 0.5 && Math.abs(prev.width - nextWidth) < 0.5) {
          return prev;
        }

        return {
          offsetLeft: nextOffsetLeft,
          width: nextWidth,
        };
      });
      setTimelineScrollLeft((prev) => (Math.abs(prev - nextScrollLeft) < 0.5 ? prev : nextScrollLeft));
    }

    updatePlayheadMetrics();
    timelineElement.addEventListener("scroll", updatePlayheadMetrics, { passive: true });
    window.addEventListener("resize", updatePlayheadMetrics);

    return () => {
      timelineElement.removeEventListener("scroll", updatePlayheadMetrics);
      window.removeEventListener("resize", updatePlayheadMetrics);
    };
  }, [timelineZoom]);

  useEffect(() => {
    const timelineElement = timelineTracksRef.current;
    if (!timelineElement) {
      return;
    }

    function handleNativeWheel(event: globalThis.WheelEvent) {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      applyTimelineWheelZoom(event.deltaY, event.clientX);
    }

    timelineElement.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      timelineElement.removeEventListener("wheel", handleNativeWheel);
    };
  }, [applyTimelineWheelZoom]);

  useLayoutEffect(() => {
    const timelineElement = timelineTracksRef.current;
    const pendingScrollLeft = pendingTimelineScrollLeftRef.current;

    if (!timelineElement || pendingScrollLeft === null) {
      return;
    }

    const maxScrollLeft = Math.max(0, timelineElement.scrollWidth - timelineElement.clientWidth);
    timelineElement.scrollLeft = clamp(pendingScrollLeft, 0, maxScrollLeft);
    pendingTimelineScrollLeftRef.current = null;
  }, [timelineZoom]);

  useEffect(() => {
    const timelineElement = timelineTracksRef.current;
    if (!timelineElement) {
      return;
    }

    const chunkFrames = Math.max(Math.round(fps * timelineExtensionChunkSeconds), fps);

    function maybeExtendTimeline() {
      const remaining = timelineElement.scrollWidth - (timelineElement.scrollLeft + timelineElement.clientWidth);
      const threshold = Math.max(timelineElement.clientWidth * timelineExtensionThresholdRatio, 120);

      if (remaining > threshold) {
        return;
      }

      setTimelineExtraFrames((prev) => prev + chunkFrames);
    }

    maybeExtendTimeline();
    timelineElement.addEventListener("scroll", maybeExtendTimeline, { passive: true });
    window.addEventListener("resize", maybeExtendTimeline);

    return () => {
      timelineElement.removeEventListener("scroll", maybeExtendTimeline);
      window.removeEventListener("resize", maybeExtendTimeline);
    };
  }, [fps, timelineFrameSpan]);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const scrubZoneElement = scrubZoneRef.current;

      if (!scrubZoneElement || durationSeconds <= 0) {
        return;
      }

      const scrubZoneRect = scrubZoneElement.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - scrubZoneRect.left) / Math.max(scrubZoneRect.width, 1), 0), 1);

      handleSeek(ratio * durationSeconds);
    },
    [durationSeconds, handleSeek],
  );

  function beginScrub(clientX: number) {
    seekFromClientX(clientX);
    setIsScrubbing(true);
  }

  useEffect(() => {
    if (!isScrubbing) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      seekFromClientX(event.clientX);
    }

    function stopScrub() {
      setIsScrubbing(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopScrub);
    window.addEventListener("pointercancel", stopScrub);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopScrub);
      window.removeEventListener("pointercancel", stopScrub);
    };
  }, [isScrubbing, seekFromClientX]);

  useEffect(() => {
    if (!isLeftRailResizing) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const { startX, startWidth } = leftRailResizeStateRef.current;
      const nextWidth = startWidth + (event.clientX - startX);
      setLeftRailWidth(Math.max(250, nextWidth));
    }

    function stopResizing() {
      setIsLeftRailResizing(false);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isLeftRailResizing]);

  useEffect(() => {
    if (!isInspectorResizing) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const { startX, startWidth } = resizeStateRef.current;
      const nextWidth = startWidth + (event.clientX - startX);
      setInspectorWidth(Math.max(250, nextWidth));
    }

    function stopResizing() {
      setIsInspectorResizing(false);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isInspectorResizing]);

  useEffect(() => {
    if (!isTimelineResizing) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const { startY, startHeight } = timelineResizeStateRef.current;
      const nextHeight = startHeight - (event.clientY - startY);
      setTimelineHeight(clamp(nextHeight, 180, 560));
    }

    function stopResizing() {
      setIsTimelineResizing(false);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isTimelineResizing]);

  function handleInspectorResizeStart(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: boundedInspectorWidth,
    };
    setIsInspectorResizing(true);
  }

  function handleLeftRailResizeStart(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    leftRailResizeStateRef.current = {
      startX: event.clientX,
      startWidth: leftRailWidth,
    };
    setIsLeftRailResizing(true);
  }

  function handleTimelineResizeStart(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    timelineResizeStateRef.current = {
      startY: event.clientY,
      startHeight: timelineHeight,
    };
    setIsTimelineResizing(true);
  }

  const handleChatScroll = useCallback(() => {
    setIsChatScrollbarVisible(true);

    if (chatScrollbarTimerRef.current) {
      clearTimeout(chatScrollbarTimerRef.current);
    }

    chatScrollbarTimerRef.current = setTimeout(() => {
      setIsChatScrollbarVisible(false);
      chatScrollbarTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (chatScrollbarTimerRef.current) {
        clearTimeout(chatScrollbarTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    return () => {
      for (const asset of assetsRef.current) {
        if (asset.revokeOnDispose && asset.src) {
          URL.revokeObjectURL(asset.src);
        }
      }
    };
  }, []);

  const handleAssetUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    const nextAssets: AssetItem[] = Array.from(files).map((file, index) => {
      const src = URL.createObjectURL(file);
      const kind: AssetKind = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : file.type.startsWith("image/")
            ? "image"
            : "other";

      return {
        id: `${Date.now()}-${index}-${file.name}`,
        name: file.name,
        kind,
        src,
        revokeOnDispose: true,
        sizeLabel: formatFileSize(file.size),
      };
    });

    setAssets((prev) => [...nextAssets, ...prev]);
    event.target.value = "";
  }, []);

  const handleRightSidebarSectionClick = useCallback((section: RightSidebarSection) => {
    setActiveRightSidebarSection(section);
    setIsRightSidebarPanelOpen((prev) => !(prev && activeRightSidebarSection === section));
  }, [activeRightSidebarSection]);

  return (
    <div
      className={styles.editorShell}
      style={
        {
          "--timeline-height": `${timelineHeight}px`,
          "--right-sidebar-panel-width": isRightSidebarPanelOpen ? "340px" : "0px",
        } as CSSProperties
      }
      onPointerDownCapture={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        if (target.closest("[data-selection-anchor='true']")) {
          return;
        }

        clearSelectionFocus();
      }}
    >
      <header className={styles.topBar}>
        <nav className={styles.menuBar} aria-label="Editor menu">
          <Link
            href={{ pathname: "/", query: { project: slug } }}
            className={styles.backToProjectButton}
            aria-label="Back to project"
            title="Back to project"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10.5 3.2L5.5 8l5 4.8V3.2z" />
            </svg>
          </Link>
          <button type="button">File</button>
          <button type="button">View</button>
          <button type="button">Tools</button>
          <button type="button">Packages</button>
          <button type="button">Help</button>
        </nav>
        <div className={styles.projectTitle}>{slug}</div>
        <div className={styles.topBarActions}>
          <button
            type="button"
            className={styles.topBarIconButton}
            onClick={() => setIsLeftRailCollapsed((prev) => !prev)}
            aria-label={isLeftRailCollapsed ? "Expand left sidebar" : "Collapse left sidebar"}
            title={isLeftRailCollapsed ? "Expand left sidebar" : "Collapse left sidebar"}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2" y="3" width="12" height="10" rx="1.3" />
              <path d="M6 3v10" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.topBarIconButton}
            onClick={() => setIsInspectorCollapsed((prev) => !prev)}
            aria-label={isInspectorCollapsed ? "Expand timeline inspector" : "Collapse timeline inspector"}
            title={isInspectorCollapsed ? "Expand timeline inspector" : "Collapse timeline inspector"}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2" y="3" width="12" height="10" rx="1.3" />
              <path d="M10 3v10" />
            </svg>
          </button>
        </div>
      </header>

      <aside className={`${styles.rightSidebar} ${styles.rightSidebarLight}`} aria-label="Editor tools">
        <div className={styles.rightSidebarTop}>
          {rightSidebarSections.map((section) => (
            <div key={section} className={styles.rightSidebarNavEntry}>
              <button
                type="button"
                className={`${styles.rightSidebarItem} ${isRightSidebarPanelOpen && activeRightSidebarSection === section ? styles.rightSidebarItemActive : ""}`}
                onClick={() => handleRightSidebarSectionClick(section)}
                aria-pressed={isRightSidebarPanelOpen && activeRightSidebarSection === section}
              >
                <span className={styles.rightSidebarIcon} aria-hidden="true">
                  {section === "Project" ? (
                    <svg viewBox="0 0 20 20">
                      <path d="M2.8 6.2a1.7 1.7 0 0 1 1.7-1.7h3.3l1.2 1.3h6.5a1.7 1.7 0 0 1 1.7 1.7v6.3a1.7 1.7 0 0 1-1.7 1.7H4.5a1.7 1.7 0 0 1-1.7-1.7V6.2Z" />
                    </svg>
                  ) : null}
                  {section === "AI Tools" ? (
                    <svg viewBox="0 0 20 20">
                      <path d="M10 2.5l1.3 3.3 3.2 1.3-3.2 1.3L10 11.7 8.7 8.4 5.5 7.1l3.2-1.3L10 2.5Z" />
                      <path d="M14.2 10.6l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8.8-1.8Z" />
                    </svg>
                  ) : null}
                  {section === "Properties" ? (
                    <svg viewBox="0 0 20 20">
                      <path d="M6 3.5v4m0 9v-4m8-9v9m-4-5v9" />
                      <circle cx="6" cy="9.2" r="1.4" />
                      <circle cx="14" cy="14.2" r="1.4" />
                      <circle cx="10" cy="5.8" r="1.4" />
                    </svg>
                  ) : null}
                  {section === "Elements" ? (
                    <svg viewBox="0 0 20 20">
                      <rect x="3.5" y="3.5" width="4.2" height="4.2" rx="0.8" />
                      <rect x="12.3" y="3.5" width="4.2" height="4.2" rx="0.8" />
                      <rect x="7.9" y="12.3" width="4.2" height="4.2" rx="0.8" />
                      <path d="M7.7 5.6h4.6M10 7.7v4.6" />
                    </svg>
                  ) : null}
                  {section === "Captions" ? (
                    <svg viewBox="0 0 20 20">
                      <rect x="2.8" y="4" width="14.4" height="12" rx="2" />
                      <path d="M6.5 8.8h4.8M6.5 11.7h3.2M13.8 9.6l3.4 2.4-3.4 2.4" />
                    </svg>
                  ) : null}
                  {section === "Media" ? (
                    <svg viewBox="0 0 20 20">
                      <rect x="2.8" y="4" width="8.5" height="12" rx="1.8" />
                      <path d="M7 8.2l2.6 1.8L7 11.8V8.2Z" />
                      <path d="M13.1 6.3h4.1M13.1 10h4.1M13.1 13.7h4.1" />
                    </svg>
                  ) : null}
                </span>
                <span className={styles.rightSidebarItemLabel}>{section}</span>
              </button>
              {section === "Project" || section === "Properties" ? (
                <span className={styles.rightSidebarDivider} aria-hidden="true" />
              ) : null}
            </div>
          ))}
        </div>
        {isRightSidebarPanelOpen ? (
          <div className={styles.rightSidebarContent}>
            {activeRightSidebarSection === "Properties" ? (
              <section className={styles.rightSidebarEditor} aria-label="Element properties">
                <h3 className={styles.rightSidebarEditorTitle}>Properties</h3>
                {selectedOverlayElement?.element.kind === "text" ? (
                  <>
                    <label className={styles.rightSidebarField}>
                      <span>Text</span>
                      <textarea
                        value={selectedOverlayElement.element.text}
                        rows={4}
                        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                          updateSelectedTextElement((element) => ({
                            ...element,
                            text: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className={styles.rightSidebarField}>
                      <span>Font size</span>
                      <input
                        type="number"
                        min={8}
                        max={300}
                        step={1}
                        value={selectedOverlayElement.element.fontSize ?? 44}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          const nextSize = Number(event.target.value);
                          if (!Number.isFinite(nextSize)) {
                            return;
                          }

                          updateSelectedTextElement((element) => ({
                            ...element,
                            fontSize: clamp(Math.round(nextSize), 8, 300),
                          }));
                        }}
                      />
                    </label>
                  </>
                ) : (
                  <p className={styles.rightSidebarEditorHint}>Select a text element on canvas to edit it.</p>
                )}
              </section>
            ) : activeRightSidebarSection === "Elements" ? (
              <section className={styles.elementsLibraryPanel} aria-label="Elements panel">
                <header className={styles.elementsLibraryHeader}>
                  <span className={styles.elementsLibraryHeaderIcon} aria-hidden="true">
                    <svg viewBox="0 0 20 20">
                      <rect x="3.5" y="3.5" width="4.2" height="4.2" rx="0.8" />
                      <rect x="12.3" y="3.5" width="4.2" height="4.2" rx="0.8" />
                      <rect x="7.9" y="12.3" width="4.2" height="4.2" rx="0.8" />
                      <path d="M7.7 5.6h4.6M10 7.7v4.6" />
                    </svg>
                  </span>
                  <h3 className={styles.elementsLibraryHeaderTitle}>Elements</h3>
                </header>
                <div className={styles.elementsLibraryGroups}>
                  {elementsLibrarySections.map((group) => (
                    <section key={group.title} className={styles.elementsLibraryGroup}>
                      <div className={styles.elementsLibraryGroupHeader}>
                        <h4 className={styles.elementsLibraryGroupTitle}>{group.title}</h4>
                        {group.showInfo ? (
                          <span className={styles.elementsLibraryInfo} aria-hidden="true">
                            i
                          </span>
                        ) : null}
                      </div>
                      <div
                        className={`${styles.elementsLibraryGrid} ${
                          group.items.length === 3 ? styles.elementsLibraryGridThree : ""
                        }`}
                      >
                        {group.items.map((item, index) => (
                          <button
                            key={`${group.title}-${item.label || item.icon || index}`}
                            type="button"
                            className={styles.elementsLibraryCard}
                          >
                            {item.icon ? (
                              <span className={styles.elementsLibraryCardIcon}>{renderElementsLibraryIcon(item.icon)}</span>
                            ) : null}
                            {item.label ? (
                              <span
                                className={`${styles.elementsLibraryCardLabel} ${
                                  item.emphasis ? styles.elementsLibraryCardLabelEmphasis : ""
                                }`}
                              >
                                {item.label}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ) : (
              <section className={styles.rightSidebarEditor} aria-label={`${activeRightSidebarSection} panel`}>
                <h3 className={styles.rightSidebarEditorTitle}>{activeRightSidebarSection}</h3>
                <p className={styles.rightSidebarEditorHint}>
                  {activeRightSidebarSection === "Project"
                    ? "Scene and project options are shown in this panel."
                    : activeRightSidebarSection === "AI Tools"
                      ? "Run AI actions for script, visuals and timing."
                      : activeRightSidebarSection === "Elements"
                        ? "Manage elements and layer ordering here."
                        : activeRightSidebarSection === "Captions"
                          ? "Configure subtitle style, timing and position."
                          : "Browse uploaded files and media library."}
                </p>
              </section>
            )}
          </div>
        ) : null}
        <button type="button" className={`${styles.rightSidebarItem} ${styles.rightSidebarAgent}`}>
          <span className={styles.rightSidebarIcon} aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <rect x="5" y="7.2" width="10" height="7.8" rx="2" />
              <circle cx="8" cy="11.1" r="0.9" />
              <circle cx="12" cy="11.1" r="0.9" />
              <path d="M10 3v2.2M3.7 10h1.8M14.5 10h1.8" />
            </svg>
          </span>
          <span className={styles.rightSidebarItemLabel}>Underlord</span>
        </button>
      </aside>

      <div
        className={styles.workspace}
        style={
          {
            "--left-rail-width": isLeftRailCollapsed ? "0px" : `${leftRailWidth}px`,
            "--left-rail-min": isLeftRailCollapsed ? "0px" : "250px",
          } as CSSProperties
        }
      >
        <aside className={`${styles.leftRail} ${isLeftRailCollapsed ? styles.leftRailCollapsed : ""}`}>
          <button
            type="button"
            className={`${styles.leftRailResizeHandle} ${isLeftRailResizing ? styles.leftRailResizeHandleActive : ""}`}
            onPointerDown={handleLeftRailResizeStart}
            aria-label="Resize composition sidebar"
          />
          <div className={styles.panelTabs}>
            <button
              type="button"
              className={activeLeftTab === "chat" ? styles.tabActive : styles.tab}
              onClick={() => setActiveLeftTab("chat")}
            >
              <span className={styles.tabWithIcon}>Edit with AI</span>
            </button>
            <button
              type="button"
              className={activeLeftTab === "assets" ? styles.tabActive : styles.tab}
              onClick={() => setActiveLeftTab("assets")}
            >
              <span className={styles.tabWithIcon}>Assets</span>
            </button>
          </div>
          {activeLeftTab === "chat" ? (
            <div className={styles.chatPanel}>
              <header className={styles.chatHeader}>
                <div className={styles.chatIdentity}>
                  <span className={styles.chatAvatar} aria-hidden="true" />
                  <span className={styles.chatName}>Compis</span>
                </div>
              </header>

              <div
                className={`${styles.chatBody} ${isChatScrollbarVisible ? styles.chatBodyScrollbarVisible : ""}`}
                onScroll={handleChatScroll}
              >
                <p>JSON-based editor is active. You can describe scenes and elements in schema and render with Remotion.</p>
                <p className={styles.chatSectionTitle}>Current pipeline:</p>
                <ol>
                  <li>
                    <strong>Video schema</strong> - Timeline, scenes, elements and animations in JSON/TS object
                  </li>
                  <li>
                    <strong>Remotion composition</strong> - Scene renderer from schema
                  </li>
                  <li>
                    <strong>Editor timeline</strong> - Clip tracks and playhead synced with player frame
                  </li>
                </ol>
                <p>Ready for adding schema editor and AI transforms.</p>
                <div className={styles.chatTime}>just now</div>
              </div>

              <footer className={styles.chatComposer}>
                <div className={styles.chatComposerInput}>
                  <textarea placeholder="What would you like to change?" rows={3} />
                </div>
              </footer>
            </div>
          ) : (
            <div className={styles.assetsPanel}>
              <input
                ref={assetUploadInputRef}
                type="file"
                accept="video/*,audio/*,image/*"
                multiple
                className={styles.assetsFileInput}
                onChange={handleAssetUpload}
              />
              <button
                type="button"
                className={styles.assetsUploadButton}
                onClick={() => assetUploadInputRef.current?.click()}
              >
                Upload New Asset
              </button>
              <div className={styles.assetList}>
                {assets.map((asset) => (
                  <article key={asset.id} className={styles.assetCard}>
                    {asset.kind === "video" && asset.src ? (
                      <video className={styles.assetPreview} src={asset.src} controls preload="metadata" />
                    ) : null}
                    {asset.kind === "audio" && asset.src ? (
                      <audio className={styles.assetAudio} src={asset.src} controls preload="metadata" />
                    ) : null}
                    {asset.kind === "image" && asset.src ? (
                      <img className={styles.assetPreview} src={asset.src} alt={asset.name} />
                    ) : null}
                    {(asset.kind === "audio" && !asset.src) || asset.kind === "other" ? (
                      <div className={styles.assetFilePlaceholder}>
                        <span>File</span>
                      </div>
                    ) : null}
                    <div className={styles.assetMeta}>
                      <p className={styles.assetName}>{asset.name}</p>
                      <p className={styles.assetType}>{asset.sizeLabel}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className={styles.previewArea}>
          <div className={styles.previewStage}>
            <div className={styles.previewCanvas} ref={previewCanvasRef}>
              <div
                className={styles.previewViewport}
                style={{
                  left: `${compositionViewport.left}px`,
                  top: `${compositionViewport.top}px`,
                  width: `${compositionViewport.width}px`,
                  height: `${compositionViewport.height}px`,
                }}
              >
                <Player
                  ref={playerRef}
                  component={VideoComposition}
                  inputProps={{ schema: videoSchema }}
                  durationInFrames={videoSchema.durationInFrames}
                  fps={videoSchema.fps}
                  compositionWidth={videoSchema.width}
                  compositionHeight={videoSchema.height}
                  controls={false}
                  loop={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "#000000",
                  }}
                  clickToPlay={false}
                />

                <div
                  className={styles.previewOverlayLayer}
                  onPointerDown={(event) => {
                    if (event.target !== event.currentTarget) {
                      return;
                    }

                    setSelectedElementKey(null);
                    setSelectedTimelineTrack(null);
                    setDragState(null);
                    setOverlayResizeState(null);
                  }}
                >
                  {activeOverlayElements.map(({ sceneId, elementIndex, renderedX, renderedY, element }) => {
                    const key = `${sceneId}:${elementIndex}`;
                    const isSelected = selectedElementKey === key;
                    const left = (renderedX / videoSchema.width) * 100;
                    const top = (renderedY / videoSchema.height) * 100;
                    const width = (element.width / videoSchema.width) * 100;
                    const height = (element.height / videoSchema.height) * 100;
                    const title = `${element.kind} / ${getElementLabel(element)}`;

                    return (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.overlayHandle} ${isSelected ? styles.overlayHandleSelected : ""}`}
                        style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                        data-selection-anchor="true"
                        data-overlay-item="true"
                        onPointerDown={(event) =>
                          startOverlayDrag(event, sceneId, elementIndex, element, renderedX, renderedY)
                        }
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedElementKey(key);
                          setSelectedTimelineTrack({
                            kind: "element",
                            sceneId,
                            elementIndex,
                          });
                        }}
                        title={title}
                        aria-label={`Drag ${title}`}
                      >
                        {isSelected ? (
                          <>
                            <span className={styles.overlaySizeLabel}>
                              {Math.round(element.width)} x {Math.round(element.height)} px
                            </span>
                            {overlayResizeHandles.map((handle) => (
                              <span
                                key={`${key}-${handle.key}`}
                                className={`${styles.overlayResizeHandle} ${styles[`overlayResizeHandle${handle.key.toUpperCase()}`]}`}
                                onPointerDown={(event) =>
                                  startOverlayResize(
                                    event,
                                    sceneId,
                                    elementIndex,
                                    element,
                                    handle.directionX,
                                    handle.directionY,
                                  )
                                }
                              />
                            ))}
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <PlaybackToolbar
        isPlaying={isPlaying}
        zoom={timelineZoom}
        onZoomChange={handleTimelineZoomChange}
        onZoomStep={adjustTimelineZoom}
        onTogglePlay={togglePlay}
        onRewind={rewind}
        onForward={forward}
        onRender={() => seekToFrame(0)}
      />

      <section className={styles.timeline}>
        <button
          type="button"
          className={`${styles.timelineResizeHandle} ${isTimelineResizing ? styles.timelineResizeHandleActive : ""}`}
          onPointerDown={handleTimelineResizeStart}
          aria-label="Resize timeline height"
        />
        <div
          className={styles.timelineBody}
          style={
            {
              "--inspector-width": isInspectorCollapsed ? "0px" : `${boundedInspectorWidth}px`,
              "--inspector-min": isInspectorCollapsed ? "0px" : "250px",
            } as CSSProperties
          }
        >
          {!isInspectorCollapsed ? (
            <TimelineInspector
              currentTimeLabel={formatTime(currentTime)}
              isResizing={isInspectorResizing}
              onResizeStart={handleInspectorResizeStart}
              rows={inspectorRows}
            />
          ) : null}
          <div className={styles.timelineMain} ref={timelineMainRef}>
            <div
              className={styles.timelineHeader}
              style={{
                width: timelineContentWidth,
                transform: `translateX(${-timelineScrollLeft}px)`,
              }}
            >
              {timelineMarks.map((mark, index) => (
                <span key={`${mark}-${index}`}>{mark}</span>
              ))}
            </div>
            <div className={styles.tracks} ref={timelineTracksRef}>
              <input
                type="range"
                min={0}
                max={timelineDurationSeconds || 0}
                step={0.001}
                value={timelineDurationSeconds ? currentTime : 0}
                onChange={(event) => handleSeek(Number(event.target.value))}
                className={styles.timelineScrubber}
                aria-label="Timeline scrubber"
              />
              <button
                type="button"
                className={styles.timelineScrubZone}
                ref={scrubZoneRef}
                style={{ width: timelineContentWidth, right: "auto" }}
                onPointerDown={(event) => beginScrub(event.clientX)}
                aria-label="Seek timeline"
              />
              {sceneTracks.map((track) => {
                const isSelected =
                  selectedTimelineTrack?.kind === "scene" && selectedTimelineTrack.sceneId === track.id;

                return (
                  <div className={styles.trackRow} key={`scene-${track.id}`}>
                    <div className={styles.trackLane}>
                      <div
                        className={`${styles.clip} ${styles.sceneClip} ${getSceneClipKindClassName(track.visualKind)} ${isSelected ? styles.sceneClipSelected : ""}`}
                        style={{
                          left: `${track.start * timelineZoomScale}%`,
                          width: `${track.width * timelineZoomScale}%`,
                        }}
                        data-selection-anchor="true"
                        onPointerDown={(event) =>
                          beginTimelineClipDrag(event, {
                            kind: "scene",
                            sceneId: track.id,
                            startFrame: track.startFrame,
                            startClientX: event.clientX,
                          })
                        }
                        onClick={() => {
                          if (Date.now() < suppressTrackClickUntilRef.current) {
                            return;
                          }

                          setSelectedTimelineTrack({ kind: "scene", sceneId: track.id });
                          setSelectedElementKey(null);
                        }}
                      >
                        {renderTrackVisual({
                          kind: track.visualKind,
                          title: track.name,
                          src: track.previewSrc,
                          waveformSeed: track.id,
                          durationInFrames: track.durationInFrames,
                          fps,
                        })}
                        <span className={styles.clipTitle}>
                          {track.name} ({track.meta})
                        </span>
                        <button
                          type="button"
                          className={styles.clipDeleteButton}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            deleteSceneTrack(track.id);
                          }}
                          aria-label={`Delete ${track.name} track`}
                          title="Delete track"
                        >
                          x
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {overlayTracks.map((track) => {
                const trackKey = `${track.sceneId}:${track.elementIndex}`;
                const isSelected = selectedElementKey === trackKey;

                return (
                  <div className={styles.trackRow} key={`element-${trackKey}`}>
                    <div className={styles.trackLane}>
                    <div
                      className={`${styles.clip} ${styles.elementClip} ${getElementClipKindClassName(track.visualKind)} ${isSelected ? styles.elementClipSelected : ""} ${isSelected ? styles.clipHasSplitAction : ""}`}
                      style={{
                          left: `${track.start * timelineZoomScale}%`,
                          width: `${track.width * timelineZoomScale}%`,
                      }}
                        data-selection-anchor="true"
                        onClick={() => {
                          if (Date.now() < suppressTrackClickUntilRef.current) {
                            return;
                          }

                          setSelectedTimelineTrack({
                            kind: "element",
                            sceneId: track.sceneId,
                            elementIndex: track.elementIndex,
                          });
                          setSelectedElementKey(trackKey);
                        }}
                        onPointerDown={(event) =>
                          beginTimelineClipDrag(event, {
                            kind: "element",
                            sceneId: track.sceneId,
                            elementIndex: track.elementIndex,
                            startFrame: track.startFrame,
                            startClientX: event.clientX,
                          })
                        }
                      >
                        {renderTrackVisual({
                          kind: track.visualKind,
                          title: track.elementName,
                          src: track.previewSrc,
                          waveformSeed: track.elementId,
                          durationInFrames: track.durationInFrames,
                          fps,
                        })}
                        <span className={styles.clipTitle}>
                          {track.elementKind}: {track.elementName} ({track.meta})
                        </span>
                        <button
                          type="button"
                          className={styles.clipDeleteButton}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            deleteElementTrack(track.sceneId, track.elementIndex);
                          }}
                          aria-label={`Delete ${track.elementKind} track`}
                          title="Delete track"
                        >
                          x
                        </button>
                        {isSelected ? (
                          <button
                            type="button"
                            className={styles.clipSplitButton}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              splitElementTrack(track.sceneId, track.elementIndex, currentFrame);
                            }}
                            aria-label={`Split ${track.elementKind} track at playhead`}
                            title="Split at playhead"
                          >
                            split
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className={`${styles.trackRow} ${styles.newTrackRow}`}>
                <div className={`${styles.trackLane} ${styles.newTrackLane}`}>
                  <button type="button" className={styles.newTrackButton} onClick={addTextTrack}>
                    + New
                  </button>
                </div>
              </div>
            </div>
            <div className={styles.playheadLayer}>
              <button
                type="button"
                className={styles.playhead}
                onPointerDown={(event) => beginScrub(event.clientX)}
                aria-label="Drag playhead"
                style={
                  {
                    "--playhead-left": `${playheadLeftPx}px`,
                  } as CSSProperties
                }
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}








