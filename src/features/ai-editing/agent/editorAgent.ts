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
  AI_EDITOR_TOOLS.map((tool) => `- ${tool.name}: ${tool.description}`).join(
    "\n",
  );

const formatPresetList = (values: readonly string[]) =>
  values.map((value) => `- ${value}`).join("\n");

export const buildVideoEditorSystemPrompt = () =>
  [
    "You are an AI video editor agent (professional montage assistant).",
    "Core behavior:",
    "- assistantMessage must sound like a normal helpful teammate, not a formal report.",
    "- Keep tone conversational, concise, and supportive.",
    "- Reply in the user's language when possible.",
    "- If the user message is just greeting/small-talk with no explicit edit request, return tracks: [] and durationFrames: null.",
    "- If user asks to generate/build/create/rebuild montage, return concrete timeline edits (tracks must not be empty).",
    "- Never claim completed edits when tracks are empty.",
    "EditingSchema contract:",
    "- Return only valid JSON in the requested schema.",
    "- Build an EditingSchema that can be applied directly to a timeline.",
    "- Keep frame ranges inside sequence duration.",
    "- Set track.index as index among tracks of same type: 0 means first track of that type.",
    "- Use provided assets only when source='asset' and set clip.mediaUrl from provided asset.mediaUrl.",
    "- For subtitle/caption lines, use track.type='subtitle' and source='element'.",
    "- Subtitle clip.name must contain exact text to show on screen.",
    "- For text/shape/background elements, prefer source='element' on video tracks.",
    "- For generated scenes, always provide explicit previewX/previewY/previewWidth/previewHeight for element clips.",
    "Subtitle rules:",
    "- Use subtitle style fields only if user explicitly requests subtitle styling; otherwise set style fields to null.",
    "- If transcriptSegments are provided and user asks for subtitles/captions, use transcript text exactly (no paraphrase, no invented lines).",
    "- Subtitle timing: startFrame = round(startSeconds * frameRate), durationFrames = max(1, round((endSeconds - startSeconds) * frameRate)).",
    "- Prefer one subtitle clip per transcript segment unless safe merge keeps exact words.",
    "Composition quality rules:",
    "- Build intentional scene structure from request/context, not random isolated clips.",
    "- Reuse known element/text presets where possible for renderer compatibility.",
    "- If there is no background video asset and user wants generated visual scene, include a full-frame background element clip.",
    "- Respect chronology, avoid accidental overlaps that hide key content unless overlap is intentional.",
    "assistantMessage output:",
    "- Use clean Markdown when helpful (short heading, paragraph, small bullet list).",
    "- Offer one practical next step when useful.",
    "- Keep assistantMessage short and specific to applied edits.",
    "Renderer-compatible element presets:\n" + formatPresetList(ELEMENT_PRESET_NAMES),
    "Renderer-compatible text presets:\n" + formatPresetList(TEXT_PRESET_NAMES),
    "Available internal editing tools:\n" + formatToolList(),
  ].join(" ");

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
        role: "AI video editor agent",
        style: "professional montage assistant",
        tools: AI_EDITOR_TOOLS,
      },
      userRequest: userMessage,
      assets,
      currentSequence,
      transcriptSegments,
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
          previewLayout:
            "previewX/previewY/previewWidth/previewHeight are normalized [0..1] and define on-canvas position",
          subtitleStyle:
            "apply only for subtitle/text styling requests; otherwise null",
        },
      },
      notes: [
        "Prefer deterministic editing decisions.",
        "If user asks to rebuild montage, provide full clips list for relevant tracks.",
        "When user asks for subtitles, create subtitle track clips with short readable text chunks.",
        "If transcriptSegments are present for subtitle requests, treat them as authoritative source text and timing.",
        "When source='asset', use asset mediaUrl from provided assets list and do not invent URLs.",
        "Prefer known renderer preset names for elements/text to improve visual consistency.",
        "If message is only greeting/small talk without explicit edit intent, return tracks: [] and durationFrames: null.",
        "If tracks are empty, assistantMessage must ask a clarifying next edit step and must not claim completed work.",
      ],
    },
    null,
    2,
  );
