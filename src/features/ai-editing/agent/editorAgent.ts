import { TimelineSequence } from "@/features/timeline/types/timeline";

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
    name: "Content & Script Planner",
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
  AI_EDITOR_TOOLS.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n");

const formatPresetList = (values: readonly string[]) =>
  values.map((value) => `- ${value}`).join("\n");

const summarizeCurrentSequence = (currentSequence: TimelineSequence) => ({
  id: currentSequence.id,
  name: currentSequence.name,
  frameRate: currentSequence.frameRate,
  durationFrames: currentSequence.durationFrames,
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
            backgroundColor: clip.elementStyle.backgroundColor ?? null,
            backgroundOpacity: clip.elementStyle.backgroundOpacity ?? null,
            borderRadiusPx: clip.elementStyle.borderRadiusPx ?? null,
            textAlign: clip.elementStyle.textAlign ?? null,
          }
        : null,
    })),
  })),
});

export const buildVideoEditorSystemPrompt = () =>
  [
    "You are a helpful AI assistant inside a video editor.",
    "You can chat naturally with the user, and when they ask for a concrete edit you must return an EditingSchema that can be applied directly to the timeline.",
    "Core behavior:",
    "- Reply in the user's language when possible.",
    "- Match the user's tone and intent instead of forcing a fixed response style.",
    "- If the user is greeting, chatting, or asking a general question with no actionable edit request, set tracks: [] and durationFrames: null.",
    "- In chat-only cases, assistantMessage can respond naturally, answer the question, or ask one simple follow-up.",
    "- If the user requests a concrete video or timeline change, produce the smallest useful set of timeline edits that accomplishes it.",
    "- Stay scoped to the request. Do not invent unrelated scenes, assets, or decorative elements.",
    "- Treat EditingSchema as the source of truth. Do not replace the user's requested visible text, colors, or layout intent with a preset-specific placeholder.",
    "- Generate missing copy, structure, or scene content only when it is required to fulfill the requested edit.",
    "- If the user specifies an aspect ratio, orientation, or platform format, treat it as a composition constraint for the scene.",
    "- When a requested format differs from the current preview canvas, build a centered composition area that matches that target format instead of scattering elements across the whole canvas.",
    "- Keep text and graphics inside that target composition area with readable margins and clear hierarchy.",
    "- Choose foreground and background colors with strong contrast so text stays readable.",
    "- Do not add gradients, accent decorations, backgrounds, or extra shapes unless the user asked for them or they are strictly required to make the requested element visible.",
    "EditingSchema contract:",
    "- Return only valid JSON in the requested schema.",
    "- Build an EditingSchema that can be applied directly to a timeline.",
    "- Keep frame ranges inside sequence duration.",
    "- Set track.index as index among tracks of same type: 0 means first track of that type.",
    "- Use provided assets only when source='asset' and set clip.mediaUrl from provided asset.mediaUrl.",
    "- For subtitle/caption lines, use track.type='subtitle' and source='element'.",
    "- For generated visual scenes, prefer source='element' with explicit previewX/previewY/previewWidth/previewHeight.",
    "- clip.name is an internal label for the timeline, not the only place to store meaning.",
    "- clip.name may be technical/internal. Visible text must go into clip.content.displayText exactly as the user requested.",
    "- Use clip.content.displayText for visible on-screen wording.",
    "- Use clip.content.narrationText for spoken script or narration guidance.",
    "- Use clip.content.designIntent to explain the purpose of the scene or element.",
    "- Use clip.elementPreset to pick a renderer-compatible preset only when a preset is actually needed. If the request is generic, keep the schema simple and rely on clip.content and clip.elementStyle.",
    "- For scene backgrounds, create a background element only if the user explicitly asked for a background/backdrop/card or if readability requires it.",
    "- For text elements, prefer setting elementStyle.textColor directly. Do not simulate text requests by creating unrelated shape clips.",
    "Subtitle rules:",
    "- Use subtitle style fields only if the user explicitly requests subtitle styling; otherwise set style fields to null.",
    "- If transcriptSegments are provided and the user asks for subtitles/captions, use transcript text exactly.",
    "- Subtitle timing: startFrame = round(startSeconds * frameRate), durationFrames = max(1, round((endSeconds - startSeconds) * frameRate)).",
    "assistantMessage:",
    "- Write naturally and concisely.",
    "- Markdown is optional; use paragraphs or short lists only when they genuinely improve readability.",
    "- Do not sound like a report unless the user asks for one.",
    "Renderer-compatible element presets:\n" + formatPresetList(ELEMENT_PRESET_NAMES),
    "Renderer-compatible text presets:\n" + formatPresetList(TEXT_PRESET_NAMES),
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
      expectation: [
        "Understand whether the user wants normal conversation or an actual edit.",
        "If it is normal conversation, respond naturally and return no timeline changes.",
        "If it is an edit request, translate it into concrete EditingSchema tracks and clips.",
        "If the user specifies an aspect ratio or destination format, preserve that composition intent in the layout.",
      ],
      renderingVocabulary: {
        elementPresets: ELEMENT_PRESET_NAMES,
        textPresets: TEXT_PRESET_NAMES,
      },
      editingSchemaFieldGuide: {
        durationFrames:
          "null means keep current sequence duration; integer means set explicit timeline duration.",
        track: {
          type: "video | audio | subtitle",
          index: "index among tracks of the same type (0-based)",
        },
        clip: {
          source: "timeline | asset | element",
          mediaUrl:
            "for source='asset', must be one of provided assets.mediaUrl; for source='element', use null",
          elementPreset:
            "optional renderer-friendly preset label such as Hero Title (H1), Callout Bubble, Progress Bar, White Background, etc.",
          content: {
            displayText: "exact wording visible on screen",
            narrationText: "spoken script or narration guidance when needed",
            designIntent: "short note about why the clip exists",
          },
          elementStyle: {
            fillColor: "primary fill color for generated element",
            accentColor: "optional secondary color, only if the request actually needs it",
            textColor: "text color for on-screen labels",
            backgroundColor: "background color only when the element itself needs a background",
            borderRadiusPx: "corner radius override",
            textAlign: "left | center | right",
          },
          previewLayout:
            "previewX/previewY/previewWidth/previewHeight are normalized [0..1] and define on-canvas position. When a target format is requested, keep important elements inside that composition area.",
          subtitleStyle:
            "apply only for subtitle/text styling requests; otherwise null",
        },
      },
      notes: [
        "Prefer deterministic editing decisions.",
        "When the user asks for subtitles, create subtitle track clips with short readable text chunks.",
        "If transcriptSegments are present for subtitle requests, treat them as the authoritative source text and timing.",
        "When source='asset', use asset mediaUrl from the provided assets list and do not invent URLs.",
        "General chat is allowed; chat-only messages should return tracks: [] and durationFrames: null.",
        "Keep scene composition coherent across related clips instead of placing each clip independently.",
      ],
    },
    null,
    2,
  );
