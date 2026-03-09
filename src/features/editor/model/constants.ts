import { VideoElement } from "./schema";
import { ElementsLibrarySection } from "./types";

export const transportSeekStep = 5;
export const keyboardSeekStep = 1;
export const minTimelineZoom = 0;
export const maxTimelineZoom = 100;
export const timelineScaleBase = 0.5;
export const timelineScaleSpan = 2.5;
export const wheelZoomStep = 0.0018;
export const timelineExtensionChunkSeconds = 30;
export const timelineExtensionThresholdRatio = 0.4;
export const defaultSidebarWidth = 400;
export const defaultTimelineHeight = 290;

export const rightSidebarSections = ["Project", "AI Tools", "Properties", "Elements", "Captions", "Media"] as const;
export type RightSidebarSection = (typeof rightSidebarSections)[number];

export const editableOverlayKinds = new Set<VideoElement["kind"]>(["text", "shape", "image"]);

export const overlayResizeHandles = [
  { key: "n", directionX: 0 as const, directionY: -1 as const },
  { key: "ne", directionX: 1 as const, directionY: -1 as const },
  { key: "e", directionX: 1 as const, directionY: 0 as const },
  { key: "se", directionX: 1 as const, directionY: 1 as const },
  { key: "s", directionX: 0 as const, directionY: 1 as const },
  { key: "sw", directionX: -1 as const, directionY: 1 as const },
  { key: "w", directionX: -1 as const, directionY: 0 as const },
  { key: "nw", directionX: -1 as const, directionY: -1 as const },
];

export const elementsLibrarySections: ElementsLibrarySection[] = [
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




