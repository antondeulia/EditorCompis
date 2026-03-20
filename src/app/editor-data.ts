import { SidebarItemDefinition, SidebarLibrarySection } from "./editor-types";

const FRAME_RATE = 30;

export const DEFAULT_CLIP_DURATION_FRAMES = FRAME_RATE * 8;
export const TOOL_PANEL_MIN_WIDTH = 320;
export const STREAMING_STEP_MS = 20;
export const STREAMING_CHUNK_SIZE = 3;
export const SUBTITLE_REQUEST_PATTERN =
  /(subtitle|subtitles|caption|captions|субтитр|титр)/i;

export const SIDEBAR_ITEMS: SidebarItemDefinition[] = [
  { id: "assets", label: "Assets" },
  { id: "ai-edit", label: "AI Edit" },
  { id: "ai-tools", label: "AI Tools" },
  { id: "elements", label: "Elements" },
  { id: "text", label: "Text" },
  { id: "json", label: "JSON" },
];

export const ELEMENT_LIBRARY_SECTIONS: SidebarLibrarySection[] = [
  {
    id: "shapes",
    title: "Shapes",
    items: [
      {
        id: "shape-rect",
        icon: "[]",
        title: "Solid Rectangle",
        description: "Clean block for plates, masks, and visual accents.",
        dragItem: { label: "Solid Rectangle", mediaType: "video", durationFrames: FRAME_RATE * 6, source: "element" },
      },
      {
        id: "shape-circle",
        icon: "()",
        title: "Circle Pulse",
        description: "Round accent for focus highlights.",
        dragItem: { label: "Circle Pulse", mediaType: "video", durationFrames: FRAME_RATE * 5, source: "element" },
      },
      {
        id: "shape-triangle",
        icon: "/\\",
        title: "Triangle Marker",
        description: "Directional marker for infographics and pointers.",
        dragItem: { label: "Triangle Marker", mediaType: "video", durationFrames: FRAME_RATE * 5, source: "element" },
      },
      {
        id: "shape-line",
        icon: "--",
        title: "Line Accent",
        description: "Linear divider for titles and cards.",
        dragItem: { label: "Line Accent", mediaType: "video", durationFrames: FRAME_RATE * 4, source: "element" },
      },
    ],
  },
  {
    id: "motion-pack",
    title: "Motion Elements",
    items: [
      {
        id: "element-lower-third",
        icon: "LT",
        title: "Lower Third Pro",
        description: "Modern lower-third with room for name and role.",
        dragItem: { label: "Lower Third Pro", mediaType: "video", durationFrames: FRAME_RATE * 6, source: "element" },
      },
      {
        id: "element-callout",
        icon: "!",
        title: "Callout Bubble",
        description: "Callout bubble for hints and UI demos.",
        dragItem: { label: "Callout Bubble", mediaType: "video", durationFrames: FRAME_RATE * 5, source: "element" },
      },
      {
        id: "element-progress",
        icon: "==",
        title: "Progress Bar",
        description: "Timer/progress bar for storytelling.",
        dragItem: { label: "Progress Bar", mediaType: "video", durationFrames: FRAME_RATE * 8, source: "element" },
      },
      {
        id: "element-split",
        icon: "||",
        title: "Split Screen",
        description: "Two-column composition for side-by-side comparison.",
        dragItem: { label: "Split Screen", mediaType: "video", durationFrames: FRAME_RATE * 10, source: "element" },
      },
      {
        id: "element-arrow",
        icon: "->",
        title: "Arrow Swipe",
        description: "Dynamic arrow to direct viewer attention.",
        dragItem: { label: "Arrow Swipe", mediaType: "video", durationFrames: FRAME_RATE * 4, source: "element" },
      },
      {
        id: "element-burst",
        icon: "**",
        title: "Star Burst",
        description: "Burst badge for promos, discounts, and CTA.",
        dragItem: { label: "Star Burst", mediaType: "video", durationFrames: FRAME_RATE * 4, source: "element" },
      },
    ],
  },
];

export const TEXT_LIBRARY_SECTIONS: SidebarLibrarySection[] = [
  {
    id: "headings",
    title: "Headings",
    items: [
      {
        id: "text-h1",
        icon: "H1",
        title: "Hero Title (H1)",
        description: "Primary large heading for the scene.",
        dragItem: { label: "Hero Title (H1)", mediaType: "video", durationFrames: FRAME_RATE * 6, source: "element" },
      },
      {
        id: "text-h2",
        icon: "H2",
        title: "Section Title (H2)",
        description: "Section heading for a new topic.",
        dragItem: { label: "Section Title (H2)", mediaType: "video", durationFrames: FRAME_RATE * 6, source: "element" },
      },
      {
        id: "text-h3",
        icon: "H3",
        title: "Topic Header (H3)",
        description: "Subheading for key points and bullets.",
        dragItem: { label: "Topic Header (H3)", mediaType: "video", durationFrames: FRAME_RATE * 5, source: "element" },
      },
    ],
  },
  {
    id: "captions",
    title: "Captions & Body",
    items: [
      {
        id: "text-subtitle",
        icon: "CC",
        title: "Subtitle",
        description: "Subtitle in a lower safe area.",
        dragItem: { label: "Subtitle", mediaType: "video", durationFrames: FRAME_RATE * 4, source: "element" },
      },
      {
        id: "text-description",
        icon: "DS",
        title: "Description",
        description: "Description or clarification under the heading.",
        dragItem: { label: "Description", mediaType: "video", durationFrames: FRAME_RATE * 7, source: "element" },
      },
      {
        id: "text-body",
        icon: "Tx",
        title: "Body Text",
        description: "Main body text for cards and scenes.",
        dragItem: { label: "Body Text", mediaType: "video", durationFrames: FRAME_RATE * 8, source: "element" },
      },
      {
        id: "text-quote",
        icon: "\"\"",
        title: "Quote Block",
        description: "Quote block with emphasized typography.",
        dragItem: { label: "Quote Block", mediaType: "video", durationFrames: FRAME_RATE * 8, source: "element" },
      },
    ],
  },
];
