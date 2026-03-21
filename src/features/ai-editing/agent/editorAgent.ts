import { TimelineSequence } from "@/features/timeline/types/timeline";

import { buildCreativeDirectionContext } from "./creativeDirection";

export interface AiEditorAssetContext {
  id: string;
  name: string;
  mediaType: "video" | "audio" | "subtitle" | "unknown";
  durationFrames: number | null;
  mediaUrl: string | null;
}

export interface AiEditorTranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface AiEditorTool {
  id: string;
  name: string;
  description: string;
}

export const DEFAULT_AI_EDIT_MODEL = "gpt-5-mini";

const ELEMENT_PRESET_NAMES = [
  "Solid Rectangle",
  "Circle Pulse",
  "Triangle Marker",
  "Line Accent",
  "Lower Third Pro",
  "Callout Bubble",
  "Progress Bar",
  "Split Screen",
  "Arrow Swipe",
  "Star Burst",
  "White Background",
] as const;

const TEXT_PRESET_NAMES = [
  "Hero Title (H1)",
  "Section Title (H2)",
  "Topic Header (H3)",
  "Subtitle",
  "Description",
  "Body Text",
  "Quote Block",
] as const;

export const AI_EDITOR_TOOLS: AiEditorTool[] = [
  {
    id: "content_planner",
    name: "Content and Script Planner",
    description:
      "Generates missing intermediary content, structure, or copy when the requested edit cannot be completed without it.",
  },
  {
    id: "storyboard_designer",
    name: "Storyboard Designer",
    description:
      "Turns ideas into scene-by-scene visual beats with clear purpose, pacing, and hierarchy.",
  },
  {
    id: "visual_director",
    name: "Visual Direction Tool",
    description:
      "Chooses typography, color, density, surface treatment, and layout language based on context instead of a fixed template.",
  },
  {
    id: "timeline_cut",
    name: "Timeline Cut Tool",
    description:
      "Cuts, trims, and rearranges clips while keeping timing consistent with the sequence.",
  },
  {
    id: "pacing_optimizer",
    name: "Pacing Optimizer",
    description:
      "Adjusts rhythm and clip lengths for better flow and viewer retention.",
  },
  {
    id: "audio_balance",
    name: "Audio Balance Tool",
    description:
      "Aligns audio track decisions with dialogue, music, and scene intent.",
  },
  {
    id: "subtitle_builder",
    name: "Subtitle Builder",
    description:
      "Creates readable subtitle clips with timing and style guidance.",
  },
];

const formatToolList = () =>
  AI_EDITOR_TOOLS.map((tool) => "- " + tool.name + ": " + tool.description).join("\n");

const formatPresetList = (values: readonly string[]) => values.map((value) => "- " + value).join("\n");

const summarizeCurrentSequence = (currentSequence: TimelineSequence) => ({
  id: currentSequence.id,
  name: currentSequence.name,
  frameRate: currentSequence.frameRate,
  durationFrames: currentSequence.durationFrames,
  aspectRatio: currentSequence.aspectRatio ?? null,
  tracks: currentSequence.tracks.map((track, trackIndex) => ({
    id: track.id,
    name: track.name,
    type: track.type,
    index: trackIndex,
    clipCount: track.clips.length,
    clips: track.clips.map((clip) => ({
      id: clip.id,
      name: clip.name,
      source: clip.source ?? null,
      startFrame: clip.startFrame,
      durationFrames: clip.durationFrames,
      mediaUrl: clip.mediaUrl ?? null,
      previewX: clip.previewX ?? null,
      previewY: clip.previewY ?? null,
      previewWidth: clip.previewWidth ?? null,
      previewHeight: clip.previewHeight ?? null,
      elementPreset: clip.elementPreset ?? null,
      content: clip.content
        ? {
            displayText: clip.content.displayText ?? null,
            narrationText: clip.content.narrationText ?? null,
            designIntent: clip.content.designIntent ?? null,
          }
        : null,
      elementStyle: clip.elementStyle
        ? {
            fillColor: clip.elementStyle.fillColor ?? null,
            accentColor: clip.elementStyle.accentColor ?? null,
            textColor: clip.elementStyle.textColor ?? null,
            strokeColor: clip.elementStyle.strokeColor ?? null,
            strokeWidthPx: clip.elementStyle.strokeWidthPx ?? null,
            backgroundColor: clip.elementStyle.backgroundColor ?? null,
            backgroundOpacity: clip.elementStyle.backgroundOpacity ?? null,
            opacity: clip.elementStyle.opacity ?? null,
            borderRadiusPx: clip.elementStyle.borderRadiusPx ?? null,
            textAlign: clip.elementStyle.textAlign ?? null,
            fontFamily: clip.elementStyle.fontFamily ?? null,
            fontSizePx: clip.elementStyle.fontSizePx ?? null,
            fontWeight: clip.elementStyle.fontWeight ?? null,
            lineHeight: clip.elementStyle.lineHeight ?? null,
            letterSpacingEm: clip.elementStyle.letterSpacingEm ?? null,
            paddingXPx: clip.elementStyle.paddingXPx ?? null,
            paddingYPx: clip.elementStyle.paddingYPx ?? null,
          }
        : null,
    })),
  })),
});

export const buildVideoEditorSystemPrompt = () =>
  [
    "You are a helpful AI video editing assistant inside a timeline editor.",
    "When the user asks for a concrete edit, return an EditingSchema that can be applied directly to the timeline.",
    "Core behavior:",
    "- Reply in the user's language when possible.",
    "- Match the user's tone, domain, and creative intent instead of forcing one house style.",
    "- If the user is greeting, chatting, or asking a general question with no actionable edit request, set tracks: [] and durationFrames: null.",
    "- If the user requests a concrete video or timeline change, produce the smallest useful set of timeline edits that accomplishes it.",
    "- Stay scoped to the request. Do not invent unrelated scenes, assets, or decorative elements.",
    "- Treat EditingSchema as the source of truth. Do not replace requested visible text, colors, composition, or mood with preset placeholders.",
    "- Generate missing copy, structure, or scene content only when it is required to fulfill the requested edit.",
    "- For new videos, explainers, lessons, presentations, social videos, or brand pieces, think like a real editor and visual director: understand the ask, plan the structure, choose a visual language, then execute scene by scene.",
    "- Do not lock yourself into one composition pattern such as left text plus right placeholder unless that is actually the best fit for this request.",
    "- You may choose colors, font sizes, font weights, padding, corner radius, backgrounds, cards, overlays, and graphic treatments whenever they help clarity, tone, or emphasis.",
    "- Use typography, scale, spacing, composition, color, and motion intentionally. Readable does not mean generic.",
    "- Keep on-screen text concise per scene. Put fuller explanation into narrationText instead of dumping everything into one text block.",
    "- Never collapse a full explainer into one oversized text card. Split the topic into multiple beats and keep each beat visually scannable.",
    "- Keep strong contrast and readable safe margins for the requested format.",
    "- If the user specifies aspect ratio, orientation, destination platform, brand feel, visual references, or an explicit background color, preserve that intent in the resulting structure and styling.",
    "- If there are no real images or assets for a scene, you may use geometric or typographic placeholder elements, but only when they serve the concept.",
    "- If the user asks for a specific background color such as purple, create a real full-frame background in that color instead of leaving the canvas visually neutral.",
    "- Encode motion thinking explicitly. If there are no dedicated animation fields for a clip, put motion or transition intent into clip.content.designIntent.",
    "EditingSchema contract:",
    "- Return only valid JSON in the requested schema.",
    "- Build an EditingSchema that can be applied directly to a timeline.",
    "- Keep frame ranges inside sequence duration.",
    "- Set track.index as the index among tracks of the same type.",
    "- Use provided assets only when source is asset and set clip.mediaUrl from provided asset.mediaUrl.",
    "- For subtitle or caption lines, use track.type subtitle and source element.",
    "- For generated visual scenes, prefer source element with explicit previewX, previewY, previewWidth, and previewHeight.",
    "- clip.name is an internal timeline label. Visible wording belongs in clip.content.displayText.",
    "- Use clip.content.narrationText for spoken script or narration guidance.",
    "- Use clip.content.designIntent to explain the role of the scene or element, including composition and motion intent when useful.",
    "- Use clip.elementPreset only when a renderer-compatible preset helps. Do not rely on presets as a substitute for layout or style thinking.",
    "- Use clip.elementStyle to control typography, color, strokes, surfaces, padding, opacity, and other visual attributes whenever needed.",
    "Subtitle rules:",
    "- Use subtitle style fields only if the user explicitly requests subtitle styling, otherwise set subtitle style fields to null.",
    "- If transcriptSegments are provided and the user asks for subtitles or captions, use transcript text exactly.",
    "- Subtitle timing: startFrame equals round(startSeconds times frameRate), durationFrames equals max of one and round(duration times frameRate).",
    "assistantMessage:",
    "- Write naturally and concisely for normal edits.",
    "- When generating or rebuilding a full video, show the plan you are creating: chosen format, visual language, scene structure, graphic logic, and motion intent.",
    "- Markdown is optional. Use short lists only when they improve readability.",
    "Renderer compatible element presets:\n" + formatPresetList(ELEMENT_PRESET_NAMES),
    "Renderer compatible text presets:\n" + formatPresetList(TEXT_PRESET_NAMES),
    "Available internal editing tools:\n" + formatToolList(),
  ].join("\n");

export const buildVideoEditorUserPrompt = ({
  userMessage,
  assets,
  currentSequence,
  transcriptSegments,
}: {
  userMessage: string;
  assets: AiEditorAssetContext[];
  currentSequence: TimelineSequence;
  transcriptSegments: AiEditorTranscriptSegment[];
}) =>
  JSON.stringify(
    {
      agent: {
        role: "helpful assistant inside a video editor",
        capabilities: AI_EDITOR_TOOLS,
      },
      userRequest: userMessage,
      assets,
      currentSequence: summarizeCurrentSequence(currentSequence),
      transcriptSegments,
      creativeDirection: buildCreativeDirectionContext(userMessage, currentSequence),
      expectation: [
        "Understand whether the user wants normal conversation or an actual edit.",
        "If it is normal conversation, respond naturally and return no timeline changes.",
        "If it is an edit request, translate it into concrete EditingSchema tracks and clips.",
        "When the request is for a full video, cover the topic through multiple purposeful scenes instead of one generic slide.",
        "Honor explicit hard constraints first, including aspect ratio, background color, and topic focus, then build the scene plan around them.",
        "Choose the visual system that best fits this specific request rather than defaulting to one template composition.",
        "Show the scene-by-scene plan in assistantMessage whenever you generate a full video or major rebuild.",
      ],
      renderingVocabulary: {
        elementPresets: ELEMENT_PRESET_NAMES,
        textPresets: TEXT_PRESET_NAMES,
      },
      editingSchemaFieldGuide: {
        durationFrames:
          "null means keep current sequence duration; integer means set an explicit timeline duration.",
        aspectRatio:
          "null means keep current sequence aspect ratio; number means set an explicit composition aspect ratio such as 16:9, 9:16, 1:1, or 4:5.",
        track: {
          type: "video | audio | subtitle",
          index: "index among tracks of the same type, zero based",
        },
        clip: {
          source: "timeline | asset | element",
          mediaUrl:
            "for source asset, use one of the provided asset media URLs; for source element, use null",
          elementPreset:
            "optional renderer-friendly preset label when it genuinely helps compatibility",
          content: {
            displayText: "exact wording visible on screen",
            narrationText: "spoken script or narration guidance when needed",
            designIntent:
              "short note about why the clip exists, what visual role it plays, and any motion or transition intent",
          },
          elementStyle: {
            fillColor: "primary fill or shape color",
            accentColor: "secondary accent color",
            textColor: "text color",
            strokeColor: "stroke or outline color for elements",
            strokeWidthPx: "stroke width for elements",
            backgroundColor: "background or card color used directly on the element",
            backgroundOpacity: "background alpha for overlays, cards, or subtitle surfaces",
            opacity: "overall element opacity",
            borderRadiusPx: "corner radius",
            textAlign: "left | center | right",
            fontFamily: "font family name when typography direction matters",
            fontSizePx: "font size for generated text elements",
            fontWeight: "numeric font weight",
            lineHeight: "unitless line height",
            letterSpacingEm: "letter spacing in em",
            paddingXPx: "horizontal internal padding for card-like text elements",
            paddingYPx: "vertical internal padding for card-like text elements",
          },
          previewLayout:
            "previewX, previewY, previewWidth, and previewHeight are normalized zero-to-one canvas coordinates.",
          subtitleStyle:
            "apply only for subtitle or caption styling requests; otherwise keep subtitle style fields null",
        },
      },
      notes: [
        "Prefer deterministic editing decisions.",
        "When the user asks for subtitles, create subtitle track clips with short readable chunks.",
        "If transcriptSegments are present for subtitle requests, treat them as the authoritative source text and timing.",
        "When source is asset, use asset mediaUrl from the provided assets list and do not invent URLs.",
        "General chat is allowed. Chat-only messages should return empty tracks and durationFrames null.",
        "Scene composition can evolve across the piece, but it should still feel intentionally directed.",
      ],
    },
    null,
    2,
  );

