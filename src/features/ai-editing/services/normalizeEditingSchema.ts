import { AiEditorAssetContext } from "@/features/ai-editing/agent/editorAgent";
import {
  EditingSchema,
  EditingSchemaClip,
  EditingSchemaClipContent,
  EditingSchemaElementStyle,
} from "@/features/ai-editing/types/editingSchema";
import { TimelineSequence, TimelineTrackType } from "@/features/timeline/types/timeline";

import {
  DEFAULT_VIEWPORT_ASPECT_RATIO,
  RequestAnalysis,
  analyzeUserRequest,
  clamp,
  getAspectRatioLabel,
  sanitizeNullableText,
  sanitizeText,
} from "./requestAnalysis";
import {
  SceneLayoutVariant,
  SceneRole,
  createStarterMontageTracks,
  getCompositionSummary,
  getLayoutSummary,
  getRoleLayoutForVariant,
  getSceneLayoutVariant,
  getSceneTextAlign,
  getStarterMontageDurationFrames,
} from "./storyboardPlanning";

interface NormalizeEditingSchemaInput {
  schema: EditingSchema;
  currentSequence: TimelineSequence;
  assets: AiEditorAssetContext[];
  userMessage: string;
}

interface EnsureNonEmptyEditingSchemaForIntentInput {
  schema: EditingSchema;
  currentSequence: TimelineSequence;
  userMessage: string;
}

interface ScenePlanSummary {
  startFrame: number;
  endFrame: number;
  label: string | null;
  title: string;
  body: string | null;
  list: string[];
  visual: string | null;
  narration: string | null;
  layout: string;
  motion: string;
}

interface SceneInspectionEntry {
  trackType: TimelineTrackType;
  clip: EditingSchemaClip;
  role: SceneRole;
}

interface SceneEditableEntry extends SceneInspectionEntry {
  trackIndex: number;
  clipIndex: number;
}

const KNOWN_PRESET_NAMES = [
  "Hero Title (H1)",
  "Section Title (H2)",
  "Topic Header (H3)",
  "Subtitle",
  "Description",
  "Body Text",
  "Quote Block",
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

const SCENE_GROUPING_TOLERANCE_FRAMES = 18;

const EXPLICIT_AUDIO_REQUEST_PATTERN = /(voice|voiceover|narration|audio|music|sound|озвуч|диктор|голос|музык|звук)/i;

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-zР°-СЏС‘0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

const isBackgroundDescriptor = (descriptor: string) =>
  descriptor.includes("background") || descriptor.includes("backdrop") || descriptor.includes("С„РѕРЅ");

const isTitleDescriptor = (descriptor: string) =>
  /(hero title|section title|topic header|title|header|heading|h1|h2|h3|Р·Р°РіРѕР»РѕРІ|С‚РёС‚СѓР»)/i.test(
    descriptor,
  );

const isBodyDescriptor = (descriptor: string) =>
  /(description|body text|body|quote|РѕРїРёСЃР°РЅ|С‚РµРєСЃС‚|С†РёС‚Р°С‚|copy)/i.test(descriptor);

const isGraphicDescriptor = (descriptor: string) =>
  /(rectangle|circle|triangle|line accent|lower third|callout|progress|split|arrow|burst|shape|card|placeholder|graphic|С„РёРіСѓСЂ|РіСЂР°С„РёРє|РєР°СЂС‚РѕС‡|РїР»Р°С€Рє)/i.test(
    descriptor,
  );

const isListText = (value: string | null | undefined) => {
  const text = sanitizeNullableText(value);
  if (!text) {
    return false;
  }

  return text.includes("\n") || /^(?:[-*]|\d+[.)]?)/.test(text);
};

const splitListItems = (value: string | null | undefined) => {
  const text = sanitizeNullableText(value);
  if (!text) {
    return [];
  }

  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[\sвЂў\-*\d.)]+/, "").trim())
    .filter((line) => line.length > 0);
};

const resolveElementPreset = (clip: EditingSchemaClip) => {
  const explicitPreset = sanitizeNullableText(clip.elementPreset);
  if (explicitPreset) {
    return explicitPreset;
  }

  const loweredName = clip.name.toLowerCase();
  return KNOWN_PRESET_NAMES.find((preset) => loweredName.startsWith(preset.toLowerCase())) ?? null;
};

const resolveAssetMediaUrl = (
  clip: EditingSchemaClip,
  trackType: TimelineTrackType,
  assets: AiEditorAssetContext[],
): string | null => {
  if (clip.source !== "asset") {
    return null;
  }

  if (typeof clip.mediaUrl === "string" && clip.mediaUrl.trim().length > 0) {
    return clip.mediaUrl;
  }

  const expectedType = trackType === "audio" ? "audio" : "video";
  const candidates = assets.filter(
    (asset) =>
      typeof asset.mediaUrl === "string" &&
      asset.mediaUrl.trim().length > 0 &&
      (asset.mediaType === expectedType || asset.mediaType === "unknown"),
  );

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0]?.mediaUrl ?? null;
  }

  const clipSearchText = [clip.name, clip.content?.displayText, clip.content?.designIntent]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const nameTokens = tokenize(clipSearchText);
  if (nameTokens.length === 0) {
    return candidates[0]?.mediaUrl ?? null;
  }

  let bestMatch: { mediaUrl: string; score: number } | null = null;

  for (const candidate of candidates) {
    const candidateTokens = tokenize(candidate.name);
    if (candidateTokens.length === 0) {
      continue;
    }

    const overlap = nameTokens.filter((token) => candidateTokens.includes(token)).length;
    if (overlap <= 0) {
      continue;
    }

    if (!bestMatch || overlap > bestMatch.score) {
      bestMatch = {
        mediaUrl: candidate.mediaUrl ?? "",
        score: overlap,
      };
    }
  }

  return bestMatch?.mediaUrl || candidates[0]?.mediaUrl || null;
};

const deriveDisplayTextFromLabel = (
  clipName: string,
  trackType: TimelineTrackType,
  elementPreset?: string | null,
) => {
  if (trackType === "audio") {
    return null;
  }

  const explicitMatch =
    /^(?:hero title|section title|topic header|subtitle|description|body text|quote block|lower third pro|callout bubble|scene title|section title)\s*:\s*(.+)$/i.exec(
      clipName.trim(),
    );
  if (explicitMatch?.[1]) {
    return sanitizeNullableText(explicitMatch[1]);
  }

  const descriptor = sanitizeText(elementPreset ?? clipName, clipName).toLowerCase();
  if (trackType === "subtitle" || isTitleDescriptor(descriptor) || isBodyDescriptor(descriptor)) {
    return sanitizeNullableText(clipName.replace(/\s*\(h\d\)/i, ""));
  }

  return null;
};

const deriveNarrationTextFromLabel = (clipName: string, trackType: TimelineTrackType) => {
  if (trackType !== "audio") {
    return null;
  }

  const narrationMatch = /^(?:narration|voiceover|РѕР·РІСѓС‡РєР°|РґРёРєС‚РѕСЂ)\s*:\s*(.+)$/i.exec(clipName.trim());
  return narrationMatch?.[1] ? sanitizeNullableText(narrationMatch[1]) : null;
};

const normalizeClipContent = ({
  clip,
  trackType,
  elementPreset,
}: {
  clip: EditingSchemaClip;
  trackType: TimelineTrackType;
  elementPreset: string | null;
}): EditingSchemaClipContent | undefined => {
  const content = clip.content;
  const normalizedContent: EditingSchemaClipContent = {
    displayText:
      sanitizeNullableText(content?.displayText) ?? deriveDisplayTextFromLabel(clip.name, trackType, elementPreset),
    narrationText:
      sanitizeNullableText(content?.narrationText) ?? deriveNarrationTextFromLabel(clip.name, trackType),
    designIntent: sanitizeNullableText(content?.designIntent),
  };

  return Object.values(normalizedContent).some((value) => typeof value === "string")
    ? normalizedContent
    : undefined;
};

const normalizeNullableNumber = (
  value: number | null | undefined,
  min: number,
  max: number,
) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return clamp(value, min, max);
};

const normalizeElementStyle = (style?: EditingSchemaElementStyle | null) => {
  if (!style) {
    return undefined;
  }

  const normalizedStyle: EditingSchemaElementStyle = {
    fillColor: sanitizeNullableText(style.fillColor),
    accentColor: sanitizeNullableText(style.accentColor),
    textColor: sanitizeNullableText(style.textColor),
    strokeColor: sanitizeNullableText(style.strokeColor),
    strokeWidthPx: normalizeNullableNumber(style.strokeWidthPx, 0, 24),
    backgroundColor: sanitizeNullableText(style.backgroundColor),
    backgroundOpacity: normalizeNullableNumber(style.backgroundOpacity, 0, 1),
    opacity: normalizeNullableNumber(style.opacity, 0, 1),
    borderRadiusPx: normalizeNullableNumber(style.borderRadiusPx, 0, 128),
    textAlign:
      style.textAlign === "left" || style.textAlign === "center" || style.textAlign === "right"
        ? style.textAlign
        : null,
    fontFamily: sanitizeNullableText(style.fontFamily),
    fontSizePx: normalizeNullableNumber(style.fontSizePx, 8, 240),
    fontWeight: normalizeNullableNumber(style.fontWeight, 100, 900),
    lineHeight: normalizeNullableNumber(style.lineHeight, 0.8, 3),
    letterSpacingEm: normalizeNullableNumber(style.letterSpacingEm, -0.2, 0.5),
    paddingXPx: normalizeNullableNumber(style.paddingXPx, 0, 160),
    paddingYPx: normalizeNullableNumber(style.paddingYPx, 0, 160),
  };

  return Object.values(normalizedStyle).some((value) => value !== null && value !== undefined)
    ? normalizedStyle
    : undefined;
};

const detectSceneRole = ({
  clipName,
  trackType,
  elementPreset,
  displayText,
}: {
  clipName: string;
  trackType: TimelineTrackType;
  elementPreset: string | null;
  displayText?: string | null;
}): SceneRole => {
  if (trackType === "subtitle") {
    return "subtitle";
  }

  const descriptor = sanitizeText(elementPreset ?? clipName, clipName).toLowerCase();
  if (isBackgroundDescriptor(descriptor)) {
    return "background";
  }

  if (descriptor.includes("topic header") || descriptor.includes("label") || descriptor.includes("kicker")) {
    return "label";
  }

  if (isTitleDescriptor(descriptor)) {
    return descriptor.includes("topic header") ? "label" : "title";
  }

  if (isListText(displayText)) {
    return "list";
  }

  if (descriptor.includes("line accent") || descriptor.includes("line")) {
    return "accent";
  }

  if (isBodyDescriptor(descriptor)) {
    return "body";
  }

  if (isGraphicDescriptor(descriptor)) {
    return descriptor.includes("line accent") ? "accent" : "graphic";
  }

  return displayText ? "body" : "graphic";
};

const applyAspectRatioLayoutGuardrails = ({
  previewX,
  previewY,
  previewWidth,
  previewHeight,
  role,
  aspectRatio,
}: {
  previewX: number;
  previewY: number;
  previewWidth: number;
  previewHeight: number;
  role: SceneRole;
  aspectRatio: number;
}) => {
  if (role === "background" || role === "subtitle" || role === "accent") {
    return { previewX, previewY, previewWidth, previewHeight };
  }

  if (aspectRatio >= 1.3) {
    const rightEdge = previewX + previewWidth;
    const looksLikeNarrowCenteredCard = previewWidth <= 0.62 && previewX >= 0.18 && rightEdge <= 0.82;

    if (looksLikeNarrowCenteredCard) {
      if (role === "title") {
        return { previewX: 0.12, previewY, previewWidth: 0.76, previewHeight: Math.max(previewHeight, 0.16) };
      }

      if (role === "body") {
        return { previewX: 0.14, previewY, previewWidth: 0.72, previewHeight: Math.max(previewHeight, 0.11) };
      }

      if (role === "list") {
        return { previewX: 0.14, previewY, previewWidth: 0.72, previewHeight: Math.max(previewHeight, 0.16) };
      }

      if (role === "graphic") {
        return { previewX: 0.18, previewY, previewWidth: 0.64, previewHeight: Math.max(previewHeight, 0.18) };
      }
    }
  }

  return { previewX, previewY, previewWidth, previewHeight };
};

const normalizeClip = ({
  clip,
  clipIndex,
  trackType,
  sequenceDurationFrames,
  assets,
  analysis,
  aspectRatio,
}: {
  clip: EditingSchemaClip;
  clipIndex: number;
  trackType: TimelineTrackType;
  sequenceDurationFrames: number;
  assets: AiEditorAssetContext[];
  analysis: RequestAnalysis;
  aspectRatio: number;
}): EditingSchemaClip => {
  const safeDuration = clamp(Math.round(clip.durationFrames), 1, sequenceDurationFrames);
  const safeStart = clamp(Math.round(clip.startFrame), 0, Math.max(sequenceDurationFrames - safeDuration, 0));
  const fallbackName =
    trackType === "subtitle"
      ? `Subtitle ${clipIndex + 1}`
      : trackType === "audio"
        ? `Narration ${clipIndex + 1}`
        : `Scene ${clipIndex + 1}`;

  const elementPreset = resolveElementPreset(clip);
  const normalizedContent = normalizeClipContent({ clip, trackType, elementPreset });
  const role = detectSceneRole({
    clipName: clip.name,
    trackType,
    elementPreset,
    displayText: normalizedContent?.displayText,
  });

  const defaultLayout =
    clip.source === "asset" && clip.mediaUrl
      ? { previewX: 0, previewY: 0, previewWidth: 1, previewHeight: 1 }
      : {
          previewX: role === "background" ? 0 : aspectRatio < 1 ? 0.1 : 0.08,
          previewY: role === "background" ? 0 : aspectRatio < 1 ? 0.12 : 0.16,
          previewWidth: role === "background" ? 1 : aspectRatio < 1 ? 0.8 : 0.72,
          previewHeight: role === "background" ? 1 : aspectRatio < 1 ? 0.16 : 0.18,
        };

  const hasExplicitLayout =
    typeof clip.previewX === "number" &&
    typeof clip.previewY === "number" &&
    typeof clip.previewWidth === "number" &&
    typeof clip.previewHeight === "number";

  let previewX = hasExplicitLayout ? clip.previewX ?? defaultLayout.previewX : defaultLayout.previewX;
  let previewY = hasExplicitLayout ? clip.previewY ?? defaultLayout.previewY : defaultLayout.previewY;
  let previewWidth = hasExplicitLayout ? clip.previewWidth ?? defaultLayout.previewWidth : defaultLayout.previewWidth;
  let previewHeight = hasExplicitLayout ? clip.previewHeight ?? defaultLayout.previewHeight : defaultLayout.previewHeight;

  if (role === "background") {
    previewX = 0;
    previewY = 0;
    previewWidth = 1;
    previewHeight = 1;
  }

  ({ previewX, previewY, previewWidth, previewHeight } = applyAspectRatioLayoutGuardrails({
    previewX,
    previewY,
    previewWidth,
    previewHeight,
    role,
    aspectRatio,
  }));

  const normalizedElementStyle = normalizeElementStyle(clip.elementStyle);
  let resolvedElementStyle: EditingSchemaElementStyle | undefined = normalizedElementStyle
    ? { ...normalizedElementStyle }
    : undefined;

  if (clip.source === "element") {
    resolvedElementStyle ??= {};

    if (role === "title" || role === "body" || role === "list" || role === "label") {
      resolvedElementStyle.textAlign ??= trackType === "subtitle" ? "center" : "left";
      resolvedElementStyle.textColor ??= analysis.theme.textColor;
    }

    if (role === "background") {
      resolvedElementStyle.backgroundColor ??= analysis.theme.backgroundColor;
      resolvedElementStyle.fillColor ??= analysis.theme.backgroundColor;
    }

    if (role === "graphic") {
      resolvedElementStyle.fillColor ??= analysis.theme.surfaceColor;
      resolvedElementStyle.accentColor ??= analysis.theme.accentColor;
      resolvedElementStyle.borderRadiusPx ??= elementPreset === "Split Screen" ? 28 : 24;
    }

    if (role === "accent") {
      resolvedElementStyle.fillColor ??= analysis.theme.lineColor;
      resolvedElementStyle.backgroundColor ??= analysis.theme.lineColor;
      resolvedElementStyle.borderRadiusPx ??= 999;
    }

    if (trackType === "subtitle") {
      resolvedElementStyle.textAlign ??= "center";
    }

    if (!Object.values(resolvedElementStyle).some((value) => value !== null && value !== undefined)) {
      resolvedElementStyle = undefined;
    }
  }

  return {
    ...clip,
    name: sanitizeText(clip.name, fallbackName),
    startFrame: safeStart,
    durationFrames: safeDuration,
    mediaUrl: resolveAssetMediaUrl(clip, trackType, assets),
    previewX: clamp(previewX, 0, 1),
    previewY: clamp(previewY, 0, 1),
    previewWidth: clamp(previewWidth, 0.08, 1),
    previewHeight: clamp(previewHeight, 0.08, 1),
    subtitleOutlineWidth: normalizeNullableNumber(clip.subtitleOutlineWidth, 0, 12),
    subtitleBackgroundOpacity: normalizeNullableNumber(clip.subtitleBackgroundOpacity, 0, 1),
    subtitleFontWeight:
      clip.subtitleFontWeight == null
        ? null
        : clamp(Math.round(clip.subtitleFontWeight / 100) * 100, 100, 900),
    subtitleFontSizePx: normalizeNullableNumber(clip.subtitleFontSizePx, 10, 96),
    subtitleBorderRadiusPx: normalizeNullableNumber(clip.subtitleBorderRadiusPx, 0, 64),
    subtitlePaddingXPx: normalizeNullableNumber(clip.subtitlePaddingXPx, 0, 64),
    subtitlePaddingYPx: normalizeNullableNumber(clip.subtitlePaddingYPx, 0, 64),
    elementPreset,
    content: normalizedContent,
    elementStyle: resolvedElementStyle,
  };
};

const hasTrackEdits = (schema: Pick<EditingSchema, "tracks">) =>
  schema.tracks.some((track) => track.clips.length > 0);

const clipHasNarrativePayload = (
  clip: Pick<EditingSchemaClip, "content" | "source" | "elementPreset">,
) => {
  if (clip.source === "asset") {
    return true;
  }

  return Boolean(
    sanitizeNullableText(clip.content?.displayText) ||
      sanitizeNullableText(clip.content?.narrationText) ||
      sanitizeNullableText(clip.content?.designIntent) ||
      sanitizeNullableText(clip.elementPreset),
  );
};

const isFullFrameBackgroundClip = (
  clip: Pick<
    EditingSchemaClip,
    "previewX" | "previewY" | "previewWidth" | "previewHeight" | "content" | "source" | "elementPreset"
  >,
) => {
  const previewX = clip.previewX ?? 0;
  const previewY = clip.previewY ?? 0;
  const previewWidth = clip.previewWidth ?? 0;
  const previewHeight = clip.previewHeight ?? 0;

  return (
    previewX <= 0.04 &&
    previewY <= 0.04 &&
    previewWidth >= 0.92 &&
    previewHeight >= 0.92 &&
    !clipHasNarrativePayload(clip)
  );
};

const countNarrativeScenes = (
  tracks: Array<{
    type: TimelineTrackType;
    clips: Array<
      Pick<
        EditingSchemaClip,
        | "startFrame"
        | "durationFrames"
        | "previewX"
        | "previewY"
        | "previewWidth"
        | "previewHeight"
        | "content"
        | "source"
        | "elementPreset"
      >
    >;
  }>,
) => {
  const sceneAnchors = new Set<number>();

  tracks.forEach((track) => {
    if (track.type !== "video") {
      return;
    }

    track.clips.forEach((clip) => {
      if (clip.durationFrames < 18 || isFullFrameBackgroundClip(clip) || !clipHasNarrativePayload(clip)) {
        return;
      }

      sceneAnchors.add(Math.max(0, Math.round(clip.startFrame / 30)));
    });
  });

  return sceneAnchors.size;
};

const getClipDisplayText = (clip: Pick<EditingSchemaClip, "name" | "content">) =>
  sanitizeNullableText(clip.content?.displayText) ?? sanitizeNullableText(clip.name);

const getPrimaryNarrationText = (sceneEntries: SceneInspectionEntry[]) => {
  const narrationCandidates = sceneEntries
    .map((entry) => sanitizeNullableText(entry.clip.content?.narrationText))
    .filter((value): value is string => Boolean(value));

  if (narrationCandidates.length === 0) {
    return null;
  }

  return narrationCandidates.sort((left, right) => right.length - left.length)[0] ?? null;
};

const mergeSceneAnchors = (anchors: number[]) => {
  const merged: number[] = [];

  for (const anchor of anchors) {
    const previous = merged[merged.length - 1];
    if (typeof previous === "number" && anchor - previous <= SCENE_GROUPING_TOLERANCE_FRAMES) {
      continue;
    }

    merged.push(anchor);
  }

  return merged;
};

const describeVisual = (entry: SceneInspectionEntry | undefined, analysis: RequestAnalysis) => {
  if (!entry) {
    return analysis.language === "ru" ? "геометрическая или типографическая заглушка по теме" : "geometric or typographic placeholder visual";
  }

  if (entry.clip.source === "asset") {
    return analysis.language === "ru" ? "реальный медиа-ассет" : "real media asset";
  }

  return sanitizeText(
    entry.clip.content?.designIntent ?? entry.clip.elementPreset,
    analysis.language === "ru" ? "геометрическая или типографическая заглушка по теме" : "geometric or typographic placeholder visual",
  );
};

const buildMotionDescription = (
  titleEntry: SceneInspectionEntry | undefined,
  bodyEntry: SceneInspectionEntry | undefined,
  listEntry: SceneInspectionEntry | undefined,
  graphicEntry: SceneInspectionEntry | undefined,
  analysis: RequestAnalysis,
) => {
  const preset = sanitizeText(graphicEntry?.clip.elementPreset ?? "", "").toLowerCase();

  if (preset.includes("split")) {
    return analysis.language === "ru"
      ? "Кадр собирается как быстро читаемое сопоставление двух состояний или позиций."
      : "The frame assembles as a quick readable comparison between two states or positions.";
  }

  if (preset.includes("arrow")) {
    return analysis.language === "ru"
      ? "Сначала входит главный тезис, затем опорные пункты, а направляющий акцент закрывает ритм сцены."
      : "The main thesis enters first, support points follow, and the directional accent closes the scene rhythm.";
  }

  if (graphicEntry && listEntry) {
    return analysis.language === "ru"
      ? "Сцена раскрывается по шагам: сначала заголовок, затем опорные пункты и визуальный акцент."
      : "The scene unfolds in steps: headline first, then support points, then the visual accent.";
  }

  if (titleEntry || bodyEntry) {
    return analysis.language === "ru"
      ? "Типографика входит спокойно и последовательно без тяжёлой анимационной перегрузки."
      : "Typography enters in a calm readable sequence without heavy animation.";
  }

  return analysis.language === "ru"
    ? "Плавные restrained-входы и контролируемый motion-ритм."
    : "Soft restrained entrances and a controlled motion rhythm.";
};

const inferSceneLayoutVariant = (
  sceneEntries: SceneInspectionEntry[],
  aspectRatio: number,
  index: number,
): SceneLayoutVariant => {
  const fallback = getSceneLayoutVariant(index, aspectRatio);
  const titleEntry = sceneEntries.find((entry) => entry.role === "title");
  const bodyEntry = sceneEntries.find((entry) => entry.role === "body");
  const graphicEntry = sceneEntries.find((entry) => entry.role === "graphic");

  if (aspectRatio < 0.85) {
    return graphicEntry && (graphicEntry.clip.previewY ?? 0) > 0.62 ? "stacked" : fallback;
  }

  if (!titleEntry && !bodyEntry && graphicEntry) {
    return "center-focus";
  }

  const titleX = titleEntry?.clip.previewX ?? bodyEntry?.clip.previewX ?? 0.08;
  const titleY = titleEntry?.clip.previewY ?? bodyEntry?.clip.previewY ?? 0.17;
  const titleWidth = titleEntry?.clip.previewWidth ?? bodyEntry?.clip.previewWidth ?? 0.46;
  const graphicX = graphicEntry?.clip.previewX ?? 0.6;
  const graphicY = graphicEntry?.clip.previewY ?? 0.2;

  if (graphicEntry && graphicY > titleY + 0.22) {
    return "stacked";
  }

  if (graphicEntry && graphicX < 0.34 && titleX > 0.4) {
    return "split-right";
  }

  if (graphicEntry && graphicX > 0.52 && titleX < 0.36) {
    return "split-left";
  }

  if (titleWidth > 0.58 && titleX > 0.16 && titleX < 0.28) {
    return "center-focus";
  }

  if (graphicEntry && titleWidth > 0.62) {
    return "poster";
  }

  return fallback;
};

const isSceneAutoLayoutCandidate = (entry: SceneEditableEntry) =>
  entry.trackType === "video" &&
  entry.clip.source === "element" &&
  entry.role !== "background" &&
  entry.role !== "subtitle";

const relayoutGeneratedScenes = ({
  tracks,
  aspectRatio,
  forceRelayout,
}: {
  tracks: EditingSchema["tracks"];
  aspectRatio: number;
  forceRelayout: boolean;
}) => {
  if (!forceRelayout) {
    return tracks;
  }

  const nextTracks = tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => ({ ...clip })),
  }));

  const entries: SceneEditableEntry[] = nextTracks
    .flatMap((track, trackIndex) =>
      track.clips.map((clip, clipIndex) => {
        const elementPreset = resolveElementPreset(clip);
        const content = normalizeClipContent({ clip, trackType: track.type, elementPreset });
        return {
          trackIndex,
          clipIndex,
          trackType: track.type,
          clip: {
            ...clip,
            content,
            elementPreset,
          },
          role: detectSceneRole({
            clipName: clip.name,
            trackType: track.type,
            elementPreset,
            displayText: content?.displayText,
          }),
        };
      }),
    )
    .filter((entry) => entry.trackType !== "audio")
    .filter((entry) => entry.clip.durationFrames >= 18)
    .filter((entry) => !(entry.role === "background" && isFullFrameBackgroundClip(entry.clip)));

  if (entries.length === 0) {
    return tracks;
  }

  const anchors = mergeSceneAnchors(
    Array.from(new Set(entries.map((entry) => entry.clip.startFrame))).sort((left, right) => left - right),
  );
  const maxEndFrame = Math.max(...entries.map((entry) => entry.clip.startFrame + entry.clip.durationFrames));

  anchors.slice(0, 8).forEach((startFrame, sceneIndex) => {
    const endFrame = anchors[sceneIndex + 1] ?? maxEndFrame;
    const sceneEntries = entries.filter(
      (entry) => entry.clip.startFrame < endFrame && entry.clip.startFrame + entry.clip.durationFrames > startFrame,
    );

    if (sceneEntries.some((entry) => entry.clip.source === "asset")) {
      return;
    }

    const editableEntries = sceneEntries.filter(isSceneAutoLayoutCandidate);
    if (editableEntries.length < 2) {
      return;
    }

    const layoutVariant = getSceneLayoutVariant(sceneIndex, aspectRatio);
    const textAlign = getSceneTextAlign(layoutVariant);

    editableEntries.forEach((entry) => {
      const layout = getRoleLayoutForVariant(entry.role, aspectRatio, layoutVariant, sceneIndex);
      const track = nextTracks[entry.trackIndex];
      const clip = track?.clips[entry.clipIndex];
      if (!track || !clip) {
        return;
      }

      const isTextRole =
        entry.role === "label" ||
        entry.role === "title" ||
        entry.role === "body" ||
        entry.role === "list";

      track.clips[entry.clipIndex] = {
        ...clip,
        previewX: layout.previewX,
        previewY: layout.previewY,
        previewWidth: layout.previewWidth,
        previewHeight: layout.previewHeight,
        elementStyle: clip.elementStyle
          ? {
              ...clip.elementStyle,
              textAlign: isTextRole ? clip.elementStyle.textAlign ?? textAlign : clip.elementStyle.textAlign,
            }
          : clip.elementStyle,
      };
    });
  });

  return nextTracks;
};
const collectScenePlans = (
  tracks: EditingSchema["tracks"],
  frameRate: number,
  aspectRatio: number,
  analysis: RequestAnalysis,
): ScenePlanSummary[] => {
  const entries: SceneInspectionEntry[] = tracks
    .flatMap((track) =>
      track.clips.map((clip) => {
        const elementPreset = resolveElementPreset(clip);
        const content = normalizeClipContent({ clip, trackType: track.type, elementPreset });
        return {
          trackType: track.type,
          clip: {
            ...clip,
            content,
            elementPreset,
          },
          role: detectSceneRole({
            clipName: clip.name,
            trackType: track.type,
            elementPreset,
            displayText: content?.displayText,
          }),
        };
      }),
    )
    .filter((entry) => entry.trackType !== "audio")
    .filter((entry) => entry.clip.durationFrames >= 18)
    .filter((entry) => !(entry.role === "background" && isFullFrameBackgroundClip(entry.clip)));

  if (entries.length === 0) {
    return [];
  }

  const anchors = mergeSceneAnchors(
    Array.from(new Set(entries.map((entry) => entry.clip.startFrame))).sort((left, right) => left - right),
  );
  const maxEndFrame = Math.max(...entries.map((entry) => entry.clip.startFrame + entry.clip.durationFrames));

  return anchors.slice(0, 8).map((startFrame, index) => {
    const endFrame = anchors[index + 1] ?? maxEndFrame;
    const sceneEntries = entries.filter(
      (entry) => entry.clip.startFrame < endFrame && entry.clip.startFrame + entry.clip.durationFrames > startFrame,
    );

    const labelEntry = sceneEntries.find((entry) => entry.role === "label");
    const titleEntry =
      sceneEntries.find((entry) => entry.role === "title") ??
      sceneEntries.find((entry) => Boolean(getClipDisplayText(entry.clip)));
    const listEntry = sceneEntries.find((entry) => entry.role === "list");
    const bodyEntry =
      sceneEntries.find((entry) => entry.role === "body") ??
      sceneEntries.find((entry) => entry !== titleEntry && entry !== listEntry && Boolean(getClipDisplayText(entry.clip)));
    const graphicEntry = sceneEntries.find((entry) => entry.role === "graphic");

    const layoutVariant = inferSceneLayoutVariant(sceneEntries, aspectRatio, index);
    const narration = getPrimaryNarrationText(sceneEntries);
    const title =
      getClipDisplayText(titleEntry?.clip ?? { name: "", content: undefined }) ??
      (analysis.language === "ru" ? `Сцена ${index + 1}` : `Scene ${index + 1}`);

    return {
      startFrame,
      endFrame,
      label: getClipDisplayText(labelEntry?.clip ?? { name: "", content: undefined }),
      title,
      body: getClipDisplayText(bodyEntry?.clip ?? { name: "", content: undefined }),
      list: splitListItems(listEntry?.clip.content?.displayText),
      visual: describeVisual(graphicEntry, analysis),
      narration,
      layout: getLayoutSummary(layoutVariant, analysis.language),
      motion: buildMotionDescription(titleEntry, bodyEntry, listEntry, graphicEntry, analysis),
    };
  });
};

const formatTimeRange = (startFrame: number, endFrame: number, frameRate: number) => {
  const format = (frame: number) => {
    const seconds = Math.max(frame / frameRate, 0);
    const totalSeconds = Math.floor(seconds);
    const tenths = Math.floor((seconds - totalSeconds) * 10);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}.${tenths}`;
  };

  return `${format(startFrame)}-${format(Math.max(endFrame - 1, startFrame))}`;
};

const buildStoryboardAssistantMessage = ({
  assistantMessage,
  tracks,
  frameRate,
  aspectRatio,
  analysis,
}: {
  assistantMessage: string;
  tracks: EditingSchema["tracks"];
  frameRate: number;
  aspectRatio: number;
  analysis: RequestAnalysis;
}) => {
  const scenePlans = collectScenePlans(tracks, frameRate, aspectRatio, analysis);
  const intro = sanitizeText(
    assistantMessage,
    analysis.language === "ru"
      ? "Собрал структуру ролика и разложил её по сценам."
      : "Built the requested video structure and mapped it scene by scene.",
  );

  if (scenePlans.length === 0) {
    return intro;
  }

  const lines: string[] = [intro, ""];
  lines.push(analysis.language === "ru" ? "## Контент-план" : "## Content Plan");
  lines.push(
    `${analysis.language === "ru" ? "Формат" : "Format"}: ${getAspectRatioLabel(aspectRatio)}, ${analysis.backgroundSummary}.`,
  );
  lines.push(getCompositionSummary(aspectRatio, analysis.language));

  if (analysis.visualSignals.length > 0) {
    lines.push(
      `${analysis.language === "ru" ? "Визуальное направление" : "Visual direction"}: ${analysis.visualSignals.join(", ")}.`,
    );
  }

  scenePlans.forEach((scene, index) => {
    const screenText = [scene.title, scene.body, ...scene.list]
      .filter((value): value is string => Boolean(value && value.trim().length > 0));

    lines.push("");
    lines.push(
      `${analysis.language === "ru" ? "### Сцена" : "### Scene"} ${index + 1} · ${formatTimeRange(scene.startFrame, scene.endFrame, frameRate)}`,
    );

    if (scene.label) {
      lines.push(`${analysis.language === "ru" ? "Метка" : "Label"}: ${scene.label}`);
    }

    lines.push(`${analysis.language === "ru" ? "Тайтл" : "Title"}: ${scene.title}`);
    lines.push(`${analysis.language === "ru" ? "Лейаут" : "Layout"}: ${scene.layout}`);

    if (screenText.length > 0) {
      lines.push(analysis.language === "ru" ? "Экранный текст:" : "On-screen text:");
      screenText.forEach((item) => {
        lines.push(`- ${item}`);
      });
    }

    if (scene.narration) {
      lines.push(`${analysis.language === "ru" ? "Подробный текст" : "Scene detail"}: ${scene.narration}`);
    }

    if (scene.visual) {
      lines.push(`${analysis.language === "ru" ? "Визуал" : "Visual"}: ${scene.visual}`);
    }

    lines.push(`${analysis.language === "ru" ? "Движение" : "Motion"}: ${scene.motion}`);
  });

  return lines.join("\n");
};

const hasStructuredSupportCopy = (scene: ScenePlanSummary) =>
  Boolean((scene.body && scene.body !== scene.title) || scene.list.length > 0 || scene.narration);

const hasSpecificVisualDirection = (scene: ScenePlanSummary) => {
  const visual = sanitizeNullableText(scene.visual)?.toLowerCase() ?? "";
  if (!visual) {
    return false;
  }

  return !visual.includes("placeholder") && !visual.includes("заглуш");
};

const shouldGenerateStarterMontage = ({
  schema,
  currentSequence,
  analysis,
}: {
  schema: EditingSchema;
  currentSequence: TimelineSequence;
  analysis: RequestAnalysis;
}) => {
  if (!analysis.needsGeneratedCoverage) {
    return false;
  }

  const targetAspectRatio =
    schema.aspectRatio ?? analysis.aspectRatio ?? currentSequence.aspectRatio ?? DEFAULT_VIEWPORT_ASPECT_RATIO;
  const scenePlans = collectScenePlans(schema.tracks, currentSequence.frameRate, targetAspectRatio, analysis);
  const generatedSceneCount = countNarrativeScenes(schema.tracks);
  const currentSceneCount = countNarrativeScenes(currentSequence.tracks as never);
  const generatedVideoTrackCount = schema.tracks.filter((track) => track.type === "video" && track.clips.length > 0).length;

  if (generatedSceneCount === 0 || scenePlans.length === 0) {
    return true;
  }

  const supportedScenes = scenePlans.filter(hasStructuredSupportCopy).length;
  const visuallyDirectedScenes = scenePlans.filter(hasSpecificVisualDirection).length;
  const lacksEnoughSupportCopy = supportedScenes < Math.max(3, Math.ceil(scenePlans.length * 0.7));
  const lacksEnoughVisualDirection = visuallyDirectedScenes < Math.max(2, Math.ceil(scenePlans.length * 0.6));
  const lacksLayeredVideoStructure = generatedVideoTrackCount < 4;

  if (generatedSceneCount < 3 && generatedSceneCount <= currentSceneCount + 1) {
    return true;
  }

  return lacksLayeredVideoStructure || lacksEnoughSupportCopy || lacksEnoughVisualDirection;
};

export const normalizeEditingSchema = ({
  schema,
  currentSequence,
  assets,
  userMessage,
}: NormalizeEditingSchemaInput): EditingSchema => {
  const analysis = analyzeUserRequest(userMessage);
  const requestedDuration =
    typeof schema.durationFrames === "number" && Number.isFinite(schema.durationFrames)
      ? Math.max(Math.round(schema.durationFrames), 1)
      : null;

  const sequenceDurationFrames = requestedDuration ?? currentSequence.durationFrames;
  const requestedAspectRatio =
    typeof schema.aspectRatio === "number" && Number.isFinite(schema.aspectRatio) && schema.aspectRatio > 0.1
      ? schema.aspectRatio
      : analysis.aspectRatio;
  const targetAspectRatio = requestedAspectRatio ?? currentSequence.aspectRatio ?? DEFAULT_VIEWPORT_ASPECT_RATIO;

  const allowGeneratedAudio = EXPLICIT_AUDIO_REQUEST_PATTERN.test(userMessage);

  const normalizedTracks = schema.tracks
    .filter((track) => allowGeneratedAudio || track.type !== "audio")
    .map((track) => ({
      ...track,
      index: Math.max(0, Math.round(track.index)),
      clips: track.clips
        .map((clip, clipIndex) =>
          normalizeClip({
            clip,
            clipIndex,
            trackType: track.type,
            sequenceDurationFrames,
            assets,
            analysis,
            aspectRatio: targetAspectRatio,
          }),
        )
        .sort((left, right) => left.startFrame - right.startFrame),
    }))
    .sort((left, right) => {
      if (left.type === right.type) {
        return left.index - right.index;
      }

      const order: TimelineTrackType[] = ["video", "audio", "subtitle"];
      return order.indexOf(left.type) - order.indexOf(right.type);
    });

  const rebalancedTracks = relayoutGeneratedScenes({
    tracks: normalizedTracks,
    aspectRatio: targetAspectRatio,
    forceRelayout: analysis.needsGeneratedCoverage,
  });

  const narrativeSceneCount = countNarrativeScenes(rebalancedTracks);
  const baseAssistantMessage = sanitizeText(
    schema.assistantMessage,
    hasTrackEdits({ tracks: rebalancedTracks })
      ? analysis.language === "ru"
        ? "Собрал структуру ролика и подготовил сцены."
        : "Built the requested video structure and prepared the scenes."
      : analysis.language === "ru"
        ? `Пока не применил изменения к таймлайну. Уточни точнее задачу: ${sanitizeText(userMessage, "что нужно изменить в первую очередь?")}`
        : `No timeline edits applied yet. Clarify the exact edit goal: ${sanitizeText(userMessage, "what should I change first?")}`,
  );

  const shouldAttachStoryboardPlan =
    hasTrackEdits({ tracks: rebalancedTracks }) && (analysis.needsGeneratedCoverage || narrativeSceneCount >= 3);

  return {
    ...schema,
    assistantMessage: shouldAttachStoryboardPlan
      ? buildStoryboardAssistantMessage({
          assistantMessage: baseAssistantMessage,
          tracks: rebalancedTracks,
          frameRate: currentSequence.frameRate,
          aspectRatio: targetAspectRatio,
          analysis,
        })
      : baseAssistantMessage,
    durationFrames: requestedDuration,
    aspectRatio: targetAspectRatio,
    tracks: rebalancedTracks,
  };
};

export const ensureNonEmptyEditingSchemaForIntent = ({
  schema,
  currentSequence,
  userMessage,
}: EnsureNonEmptyEditingSchemaForIntentInput): EditingSchema => {
  const analysis = analyzeUserRequest(userMessage);

  if (shouldGenerateStarterMontage({ schema, currentSequence, analysis })) {
    const fallbackDurationFrames =
      schema.durationFrames ?? getStarterMontageDurationFrames(currentSequence, userMessage, analysis);
    const fallbackAspectRatio =
      schema.aspectRatio ?? analysis.aspectRatio ?? currentSequence.aspectRatio ?? DEFAULT_VIEWPORT_ASPECT_RATIO;
    const fallbackTracks = createStarterMontageTracks({
      durationFrames: fallbackDurationFrames,
      userMessage,
      aspectRatio: fallbackAspectRatio,
      analysis,
    });

    return {
      ...schema,
      durationFrames: fallbackDurationFrames,
      aspectRatio: fallbackAspectRatio,
      assistantMessage: buildStoryboardAssistantMessage({
        assistantMessage:
          analysis.language === "ru"
            ? "Модель раскрыла тему слишком поверхностно, поэтому я собрал более полный черновик с сильной сценовой структурой."
            : "The model did not expand the topic deeply enough, so I assembled a fuller draft with a stronger scene structure.",
        tracks: fallbackTracks,
        frameRate: currentSequence.frameRate,
        aspectRatio: fallbackAspectRatio,
        analysis,
      }),
      tracks: fallbackTracks,
    };
  }

  if (hasTrackEdits(schema) || !analysis.hasExplicitEditIntent) {
    return schema;
  }

  return {
    ...schema,
    durationFrames: schema.durationFrames,
    assistantMessage:
      analysis.language === "ru"
        ? "Изменения не были применены автоматически, потому что модель не вернула достаточно точный EditingSchema для этого запроса."
        : "No edits were applied automatically because the model did not return a precise enough EditingSchema for this request.",
    tracks: [],
  };
};











