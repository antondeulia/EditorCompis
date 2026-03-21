import { TimelineSequence } from "@/features/timeline/types/timeline";

import { analyzeUserRequest } from "@/features/ai-editing/services/requestAnalysis";
import { buildSceneBlueprints, createSceneLabel } from "@/features/ai-editing/services/contentPlanBuilder";

import { buildCreativeDirectionContext } from "./creativeDirection";
import { buildSequenceSceneSummary } from "./sequenceSceneSummary";

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
    id: "request_analyzer",
    name: "Request Analyzer",
    description: "Extracts constraints, intent, topic, format, tone, and useful context from the prompt before editing.",
  },
  {
    id: "content_planner",
    name: "Content Planner",
    description: "Designs a strong arc for the piece and decides what each scene or beat must accomplish.",
  },
  {
    id: "storyboard_designer",
    name: "Storyboard Designer",
    description: "Turns the plan into scene-by-scene visual beats with hierarchy, layout, and pacing.",
  },
  {
    id: "content_writer",
    name: "Scene Writer",
    description: "Writes concise on-screen copy and fuller narration or guidance when the request needs generated content.",
  },
  {
    id: "visual_director",
    name: "Visual Director",
    description: "Chooses composition, typography, surfaces, accents, and motion intent to fit the request instead of a fixed template.",
  },
  {
    id: "timeline_executor",
    name: "Timeline Executor",
    description: "Maps the plan into concrete timeline tracks and clips that can be applied directly.",
  },
  {
    id: "subtitle_builder",
    name: "Subtitle Builder",
    description: "Creates subtitle clips with timing and style guidance when the user asks for captions.",
  },
];

const formatToolList = () =>
  AI_EDITOR_TOOLS.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n");

const formatPresetList = (values: readonly string[]) => values.map((value) => `- ${value}`).join("\n");

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
    "You are an AI editor inside a timeline editor.",
    "Return only JSON that matches EditingSchema.",
    "If the user is just chatting, return tracks: [] and durationFrames: null.",
    "For real edit requests, honor the requested format, topic, assets, and visual tone before placing clips.",
    "Treat aspect ratio and orientation as real canvas constraints, not as decoration inside another frame.",
    "For full builds, think scene by scene: what each beat says, how it is laid out, and how it moves.",
    "Keep on-screen text concise; use narrationText only for hidden scene detail when helpful.",
    "Use asset media URLs only from the provided assets list.",
    "Do not create audio unless the user explicitly asks for it.",
    "If the user asks for a specific background color, create a real full-frame background clip in that color.",
    "assistantMessage should be brief for small edits and scene-structured for full generated videos.",
    "Renderer compatible element presets:\n" + formatPresetList(ELEMENT_PRESET_NAMES),
    "Renderer compatible text presets:\n" + formatPresetList(TEXT_PRESET_NAMES),
    "Available internal tools:\n" + formatToolList(),
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
}) => {
  const requestAnalysis = analyzeUserRequest(userMessage);
  const planningScaffold = buildSceneBlueprints(requestAnalysis, userMessage).map((scene, index) => ({
    sceneNumber: index + 1,
    label: createSceneLabel(index, requestAnalysis.language),
    title: scene.title,
    body: scene.body,
    keyPoints: scene.list,
    narration: scene.narration,
    visual: scene.visual,
    motion: scene.motionNote,
  }));

  return JSON.stringify(
    {
      agent: {
        role: "helpful assistant inside a video editor",
        capabilities: AI_EDITOR_TOOLS,
      },
      userRequest: userMessage,
      requestAnalysis: {
        language: requestAnalysis.language,
        hasExplicitEditIntent: requestAnalysis.hasExplicitEditIntent,
        needsGeneratedCoverage: requestAnalysis.needsGeneratedCoverage,
        topic: requestAnalysis.topic,
        aspectRatio: requestAnalysis.aspectRatio,
        aspectRatioLabel: requestAnalysis.aspectRatioLabel,
        orientation: requestAnalysis.orientation,
        background: requestAnalysis.background,
        backgroundSummary: requestAnalysis.backgroundSummary,
        visualSignals: requestAnalysis.visualSignals,
      },
      workflow: {
        phases: ["analyze", "plan", "write", "compose", "execute"],
        planningExpectation: [
          "Extract constraints before creating scenes.",
          "If this is a full video, split the topic into multiple purposeful scenes.",
          "Make each scene do one job rather than dumping all information into one card.",
          "Expand the topic into real subtopics instead of placeholder headings.",
          "Write support copy for each scene, not only a title.",
          "Decide layout, graphic role, and motion intent per scene.",
          "Use wide compositions for 16:9 and true portrait compositions for 9:16 instead of simulating the ratio with a small centered card.",
          "Then output EditingSchema clips that reflect that plan.",
        ],
      },
      planningScaffold,
      assets,
      currentSequence: summarizeCurrentSequence(currentSequence),
      currentSequenceSceneSummary: buildSequenceSceneSummary(currentSequence),
      transcriptSegments,
      creativeDirection: buildCreativeDirectionContext(userMessage, currentSequence),
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
              "short note about the purpose of the scene or element, including layout or motion intent when useful",
          },
          elementStyle: {
            fillColor: "primary fill or shape color",
            accentColor: "secondary accent color",
            textColor: "text color",
            strokeColor: "stroke or outline color",
            strokeWidthPx: "stroke width",
            backgroundColor: "background or card color used on the element",
            backgroundOpacity: "background alpha",
            opacity: "overall opacity",
            borderRadiusPx: "corner radius",
            textAlign: "left | center | right",
            fontFamily: "font family when typography direction matters",
            fontSizePx: "font size for generated text elements",
            fontWeight: "numeric font weight",
            lineHeight: "unitless line height",
            letterSpacingEm: "letter spacing in em",
            paddingXPx: "horizontal inner padding",
            paddingYPx: "vertical inner padding",
          },
          previewLayout:
            "previewX, previewY, previewWidth, and previewHeight are normalized zero-to-one canvas coordinates.",
          subtitleStyle:
            "apply only for subtitle or caption styling requests; otherwise keep subtitle style fields null",
        },
      },
      notes: [
        "Prefer deterministic editing decisions over vague creative filler.",
        "If the user asks for subtitles, create subtitle track clips with short readable chunks.",
        "When source is asset, use asset mediaUrl from the provided assets list and do not invent URLs.",
        "If the user specifies 16:9, 9:16, landscape, portrait, or an explicit render resolution, reflect that directly in aspectRatio and scene composition.",
        "Treat '16 9' exactly like '16:9' and '9 16' exactly like '9:16'.",
        "A 16:9 request should use the full wide frame; a 9:16 request should use a true portrait canvas rather than a narrow card inside 16:9.",
        "General chat is allowed. Chat-only messages should return empty tracks and durationFrames null.",
        "If the request implies a full video, assistantMessage should show a meaningful scene plan, not just a generic confirmation.",
        "If the request is about a topic, cover the topic in substance scene by scene instead of returning a deck of labels.",
        "If the request is about a topic, cover the topic in substance scene by scene instead of returning a deck of labels.",
      ],
    },
    null,
    2,
  );
};







