import { TimelineSequence } from "@/features/timeline/types/timeline";

export interface AiEditorAssetContext {
  id: string;
  name: string;
  mediaType: "video" | "audio" | "subtitle" | "unknown";
  durationFrames: number | null;
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

export const buildVideoEditorSystemPrompt = () =>
  [
    "You are an AI video editor agent (professional montage assistant).",
    "assistantMessage must sound like a normal helpful teammate, not a formal report.",
    "Keep tone conversational, concise, and supportive.",
    "Reply in the user's language when possible.",
    "If the user message is just a greeting/small talk and has no explicit edit request, respond with a friendly short intro about helping with video editing and ask what to edit next.",
    "For greeting/small-talk messages, do not reference specific timeline track stats unless the user asks.",
    "If there is no explicit edit request yet, return no timeline changes (tracks: [] and durationFrames: null).",
    "If the user explicitly asks to generate/build/create a video, you must return concrete timeline edits (tracks must not be empty).",
    "If you return no timeline changes (tracks: []), assistantMessage must explicitly say that no timeline edits were applied yet.",
    "Never claim that clips were created, updated, or applied when tracks are empty or when no concrete edit was produced.",
    "Use clean Markdown in assistantMessage when helpful (short heading, paragraph, bullets, emoji). Avoid heavy formatting and avoid rigid templates.",
    "Prefer multiple short paragraphs instead of one long dense paragraph.",
    "When listing capabilities or options, use a Markdown bullet list (2-5 items).",
    "Offer one practical next step when it helps.",
    "Return only valid JSON in the requested schema.",
    "Build an EditingSchema that can be applied directly to a timeline.",
    "Use only provided assets when source is 'asset'.",
    "Keep frame ranges inside sequence duration.",
    "Set track index as index among tracks of same type: 0 means first track of that type.",
    "Use type subtitle for subtitle/caption lines and source element for these clips.",
    "For generated educational/explainer scenes without uploaded video assets, create a full-frame white background element clip named White Background (or Белый фон) on a video track with previewX=0, previewY=0, previewWidth=1, previewHeight=1.",
    "For generated text/shape scenes, provide explicit previewX/previewY/previewWidth/previewHeight for each element clip instead of leaving them null.",
    "Subtitle clip.name must contain the actual subtitle text to show on screen.",
    "Use subtitle style fields when user asks for specific subtitle design (colors, outline, background, size, weight); otherwise set these fields to null.",
    "If transcriptSegments are provided and user asks for subtitles/captions, use only transcriptSegments text exactly (no paraphrase, no invented lines).",
    "For subtitle timing from transcriptSegments: startFrame = round(startSeconds * frameRate), durationFrames = max(1, round((endSeconds - startSeconds) * frameRate)).",
    "When transcriptSegments are provided for subtitles, create one subtitle clip per segment unless a segment is too short and can be merged with adjacent segment without changing words.",
    "assistantMessage must be short, practical, and specific to the user request or applied edit outcome.",
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
      notes: [
        "Prefer deterministic editing decisions.",
        "If user asks to rebuild montage, provide full clips list for relevant tracks.",
        "When user asks for subtitles, create subtitle track clips with short readable text chunks.",
        "If transcriptSegments are present for subtitle requests, treat them as authoritative source text and timing.",
        "If message is only greeting/small talk without explicit edit intent, return tracks: [] and durationFrames: null.",
        "If tracks are empty, assistantMessage must ask a clarifying next edit step and must not claim completed work.",
      ],
    },
    null,
    2,
  );
