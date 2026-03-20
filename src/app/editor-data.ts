import { SidebarItemDefinition, SidebarLibraryItem, SidebarLibrarySection } from "./editor-types";

const FRAME_RATE = 30;

const createLibraryItem = (
  id: string,
  icon: string,
  title: string,
  description: string,
  seconds: number,
): SidebarLibraryItem => ({
  id,
  icon,
  title,
  description,
  dragItem: {
    label: title,
    mediaType: "video",
    durationFrames: FRAME_RATE * seconds,
    source: "element",
  },
});

export const DEFAULT_CLIP_DURATION_FRAMES = FRAME_RATE * 8;
export const TOOL_PANEL_MIN_WIDTH = 320;
export const STREAMING_STEP_MS = 20;
export const STREAMING_CHUNK_SIZE = 3;
export const SUBTITLE_REQUEST_PATTERN =
  /(subtitle|subtitles|caption|captions|subtitles? track|субтитр|субтитры|титр|титры)/i;

export const SIDEBAR_ITEMS: SidebarItemDefinition[] = [
  { id: "assets", label: "Assets" },
  { id: "ai-edit", label: "AI Edit" },
  { id: "ai-tools", label: "AI Tools" },
  { id: "elements", label: "Elements" },
  { id: "text", label: "Text" },
  { id: "json", label: "JSON" },
];

export const SIDEBAR_ITEM_BY_ID = new Map(
  SIDEBAR_ITEMS.map((item) => [item.id, item] as const),
);

export const ELEMENT_LIBRARY_SECTIONS: SidebarLibrarySection[] = [
  {
    id: "shapes",
    title: "Shapes",
    items: [
      createLibraryItem(
        "shape-rect",
        "[]",
        "Solid Rectangle",
        "Clean block for plates, masks, and visual accents.",
        6,
      ),
      createLibraryItem(
        "shape-circle",
        "()",
        "Circle Pulse",
        "Round accent for focus highlights.",
        5,
      ),
      createLibraryItem(
        "shape-triangle",
        "/\\",
        "Triangle Marker",
        "Directional marker for infographics and pointers.",
        5,
      ),
      createLibraryItem(
        "shape-line",
        "--",
        "Line Accent",
        "Linear divider for titles and cards.",
        4,
      ),
    ],
  },
  {
    id: "motion-pack",
    title: "Motion Elements",
    items: [
      createLibraryItem(
        "element-lower-third",
        "LT",
        "Lower Third Pro",
        "Modern lower-third with room for name and role.",
        6,
      ),
      createLibraryItem(
        "element-callout",
        "!",
        "Callout Bubble",
        "Callout bubble for hints and UI demos.",
        5,
      ),
      createLibraryItem(
        "element-progress",
        "==",
        "Progress Bar",
        "Timer/progress bar for storytelling.",
        8,
      ),
      createLibraryItem(
        "element-split",
        "||",
        "Split Screen",
        "Two-column composition for side-by-side comparison.",
        10,
      ),
      createLibraryItem(
        "element-arrow",
        "->",
        "Arrow Swipe",
        "Dynamic arrow to direct viewer attention.",
        4,
      ),
      createLibraryItem(
        "element-burst",
        "**",
        "Star Burst",
        "Burst badge for promos, discounts, and CTA.",
        4,
      ),
    ],
  },
];

export const TEXT_LIBRARY_SECTIONS: SidebarLibrarySection[] = [
  {
    id: "headings",
    title: "Headings",
    items: [
      createLibraryItem(
        "text-h1",
        "H1",
        "Hero Title (H1)",
        "Primary large heading for the scene.",
        6,
      ),
      createLibraryItem(
        "text-h2",
        "H2",
        "Section Title (H2)",
        "Section heading for a new topic.",
        6,
      ),
      createLibraryItem(
        "text-h3",
        "H3",
        "Topic Header (H3)",
        "Subheading for key points and bullets.",
        5,
      ),
    ],
  },
  {
    id: "captions",
    title: "Captions & Body",
    items: [
      createLibraryItem(
        "text-subtitle",
        "CC",
        "Subtitle",
        "Subtitle in a lower safe area.",
        4,
      ),
      createLibraryItem(
        "text-description",
        "DS",
        "Description",
        "Description or clarification under the heading.",
        7,
      ),
      createLibraryItem(
        "text-body",
        "Tx",
        "Body Text",
        "Main body text for cards and scenes.",
        8,
      ),
      createLibraryItem(
        "text-quote",
        "\"\"",
        "Quote Block",
        "Quote block with emphasized typography.",
        8,
      ),
    ],
  },
];
