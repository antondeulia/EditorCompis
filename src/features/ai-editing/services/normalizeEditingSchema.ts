import { AiEditorAssetContext } from "@/features/ai-editing/agent/editorAgent";
import {
  EditingSchema,
  EditingSchemaClip,
  EditingSchemaClipContent,
  EditingSchemaElementStyle,
} from "@/features/ai-editing/types/editingSchema";
import { TimelineSequence, TimelineTrackType } from "@/features/timeline/types/timeline";

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

interface StoryboardScene {
  title: string;
  body: string;
  narration: string;
  accentPreset: string;
  designIntent: string;
}

interface FallbackTheme {
  backgroundPreset: string;
  backgroundColor: string;
  textColor: string;
  surfaceColor: string;
  accentColor: string;
  lineColor: string;
}

const ENGLISH_EDIT_INTENT_PATTERN =
  /\b(make|create|build|generate|edit|montage|video|scene|rebuild|add|insert|subtitle|captions|animate|animation|transition|timing|pace|layout|style|trim|cut)\b/i;
const CYRILLIC_EDIT_INTENT_PATTERN =
  /(РЎРѓР Т‘Р ВµР В»Р В°Р в„–|РЎРѓР С•Р В·Р Т‘Р В°Р в„–|РЎРѓР С•Р В±Р ВµРЎР‚Р С‘|РЎРѓР СР С•Р Р…РЎвЂљР С‘РЎР‚РЎС“Р в„–|Р СР С•Р Р…РЎвЂљР В°Р В¶|Р Р†Р С‘Р Т‘Р ВµР С•|Р Т‘Р С•Р В±Р В°Р Р†РЎРЉ|РЎРѓРЎС“Р В±РЎвЂљР С‘РЎвЂљРЎР‚|РЎвЂљР С‘РЎвЂљРЎР‚|Р В°Р Р…Р С‘Р СР В°РЎвЂ |РЎРѓР С–Р ВµР Р…Р ВµРЎР‚Р С‘РЎР‚РЎС“Р в„–|РЎС“РЎР‚Р С•Р С”|Р С•Р В±РЎР‰РЎРЏРЎРѓР Р…Р С‘|РЎР‚Р В°Р В·Р В±Р ВµРЎР‚Р С‘|РЎРѓРЎвЂљР С•РЎР‚Р С‘Р В±Р С•РЎР‚Р Т‘)/i;
const SMALL_TALK_ONLY_PATTERN = /^(hi|hello|hey|yo|Р С—РЎР‚Р С‘Р Р†Р ВµРЎвЂљ|Р В·Р Т‘РЎР‚Р В°Р Р†РЎРѓРЎвЂљР Р†РЎС“Р в„–|Р Т‘Р С•Р В±РЎР‚РЎвЂ№Р в„–\s+(Р Т‘Р ВµР Р…РЎРЉ|Р Р†Р ВµРЎвЂЎР ВµРЎР‚)|Р С”РЎС“|РЎвЂ¦Р В°Р в„–)[!.,\s]*$/i;
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

const clamp = (value: number, min: number, max: number) => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const sanitizeText = (value: string, fallback: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const sanitizeNullableText = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9Р В°-РЎРЏРЎвЂ]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

const prefersRussian = (userMessage: string) => /[Р В°-РЎРЏРЎвЂ]/i.test(userMessage);

const resolveElementPreset = (clip: EditingSchemaClip) => {
  const explicitPreset = sanitizeNullableText(clip.elementPreset);
  if (explicitPreset) {
    return explicitPreset;
  }

  const loweredName = clip.name.toLowerCase();
  const matchedPreset = KNOWN_PRESET_NAMES.find((preset) => loweredName.startsWith(preset.toLowerCase()));
  return matchedPreset ?? null;
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
    return null;
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

  return bestMatch?.mediaUrl || null;
};

interface CompositionFrame {
  previewX: number;
  previewY: number;
  previewWidth: number;
  previewHeight: number;
  aspectRatio: number;
}

const DEFAULT_VIEWPORT_ASPECT_RATIO = 16 / 9;
const EXPLICIT_ASPECT_RATIO_PATTERN = /(?:^|[^\d])(\d{1,2})\s*(?::|x|\/)\s*(\d{1,2})(?:[^\d]|$)/i;
const VERTICAL_FORMAT_PATTERN = /(vertical|portrait|tiktok|reels?|shorts?|stories?|snapchat|вертикал|вертикаль|портрет|тикток|рилс|шортс|сторис)/i;
const SQUARE_FORMAT_PATTERN = /(square|instagram post|feed post|квадрат)/i;
const LANDSCAPE_FORMAT_PATTERN = /(horizontal|landscape|widescreen|youtube|горизонтал|горизонтальный|широкий|ютуб)/i;
const LIGHT_BACKGROUND_PATTERN = /(white background|white bg|light background|бел(?:ый|ом|ом фоне)|светл(?:ый|ом) фон)/i;
const DARK_BACKGROUND_PATTERN = /(dark background|black background|темн(?:ый|ом) фон|черн(?:ый|ом) фон)/i;

const inferRequestedAspectRatio = (userMessage: string): number | null => {
  const explicitMatch = EXPLICIT_ASPECT_RATIO_PATTERN.exec(userMessage);
  if (explicitMatch) {
    const width = Number.parseFloat(explicitMatch[1] ?? "");
    const height = Number.parseFloat(explicitMatch[2] ?? "");
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return width / height;
    }
  }

  if (VERTICAL_FORMAT_PATTERN.test(userMessage)) {
    return 9 / 16;
  }

  if (SQUARE_FORMAT_PATTERN.test(userMessage)) {
    return 1;
  }

  if (LANDSCAPE_FORMAT_PATTERN.test(userMessage)) {
    return 16 / 9;
  }

  return null;
};

const getCenteredCompositionFrame = (
  aspectRatio: number,
  viewportAspectRatio = DEFAULT_VIEWPORT_ASPECT_RATIO,
): CompositionFrame | null => {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return null;
  }

  if (Math.abs(aspectRatio - viewportAspectRatio) <= 0.01) {
    return {
      previewX: 0,
      previewY: 0,
      previewWidth: 1,
      previewHeight: 1,
      aspectRatio,
    };
  }

  if (aspectRatio > viewportAspectRatio) {
    const fittedHeight = viewportAspectRatio / aspectRatio;
    return {
      previewX: 0,
      previewY: (1 - fittedHeight) / 2,
      previewWidth: 1,
      previewHeight: fittedHeight,
      aspectRatio,
    };
  }

  const fittedWidth = aspectRatio / viewportAspectRatio;
  return {
    previewX: (1 - fittedWidth) / 2,
    previewY: 0,
    previewWidth: fittedWidth,
    previewHeight: 1,
    aspectRatio,
  };
};

const isBackgroundDescriptor = (descriptor: string) =>
  descriptor.includes("background") || descriptor.includes("backdrop") || descriptor.includes("фон");

const isTextDescriptor = (descriptor: string) =>
  /(title|subtitle|header|text|quote|description|body|h1|h2|h3|lower third|callout|заголов|текст|подзаголов)/i.test(
    descriptor,
  );

const getFrameRelativePreviewLayout = (
  trackType: TimelineTrackType,
  clipName: string,
  elementPreset: string | null,
  frameAspectRatio: number,
) => {
  const loweredName = sanitizeText(elementPreset ?? clipName, clipName).toLowerCase();
  const isPortraitFrame = frameAspectRatio < 1;

  if (trackType === "subtitle") {
    return {
      previewX: 0.07,
      previewY: isPortraitFrame ? 0.8 : 0.76,
      previewWidth: 0.86,
      previewHeight: isPortraitFrame ? 0.14 : 0.18,
    };
  }

  if (isBackgroundDescriptor(loweredName)) {
    return {
      previewX: 0,
      previewY: 0,
      previewWidth: 1,
      previewHeight: 1,
    };
  }

  if (loweredName.includes("lower third")) {
    return {
      previewX: 0.07,
      previewY: 0.74,
      previewWidth: 0.76,
      previewHeight: 0.16,
    };
  }

  if (loweredName.includes("callout")) {
    return {
      previewX: 0.1,
      previewY: 0.18,
      previewWidth: 0.8,
      previewHeight: 0.22,
    };
  }

  if (loweredName.includes("progress")) {
    return {
      previewX: 0.1,
      previewY: 0.88,
      previewWidth: 0.8,
      previewHeight: 0.06,
    };
  }

  if (loweredName.includes("split")) {
    return {
      previewX: 0,
      previewY: 0,
      previewWidth: 1,
      previewHeight: 1,
    };
  }

  if (loweredName.includes("arrow")) {
    return {
      previewX: 0.18,
      previewY: 0.44,
      previewWidth: 0.64,
      previewHeight: 0.14,
    };
  }

  if (loweredName.includes("burst")) {
    return {
      previewX: 0.62,
      previewY: 0.08,
      previewWidth: 0.24,
      previewHeight: 0.18,
    };
  }

  if (isTextDescriptor(loweredName)) {
    if (loweredName.includes("subtitle")) {
      return {
        previewX: 0.12,
        previewY: 0.8,
        previewWidth: 0.76,
        previewHeight: 0.1,
      };
    }

    if (loweredName.includes("h1") || loweredName.includes("hero") || loweredName.includes("title")) {
      return {
        previewX: 0.08,
        previewY: 0.1,
        previewWidth: 0.84,
        previewHeight: isPortraitFrame ? 0.18 : 0.16,
      };
    }

    if (loweredName.includes("h2") || loweredName.includes("h3") || loweredName.includes("header")) {
      return {
        previewX: 0.08,
        previewY: 0.2,
        previewWidth: 0.84,
        previewHeight: 0.14,
      };
    }

    return {
      previewX: 0.1,
      previewY: 0.32,
      previewWidth: 0.8,
      previewHeight: isPortraitFrame ? 0.22 : 0.18,
    };
  }

  if (loweredName.includes("circle")) {
    return {
      previewX: 0.28,
      previewY: 0.3,
      previewWidth: 0.44,
      previewHeight: 0.26,
    };
  }

  if (loweredName.includes("triangle")) {
    return {
      previewX: 0.22,
      previewY: 0.32,
      previewWidth: 0.56,
      previewHeight: 0.26,
    };
  }

  if (loweredName.includes("line")) {
    return {
      previewX: 0.18,
      previewY: 0.47,
      previewWidth: 0.64,
      previewHeight: 0.08,
    };
  }

  return {
    previewX: 0.12,
    previewY: 0.24,
    previewWidth: 0.76,
    previewHeight: 0.24,
  };
};

const projectLayoutIntoFrame = (
  layout: { previewX: number; previewY: number; previewWidth: number; previewHeight: number },
  frame: CompositionFrame,
) => ({
  previewX: frame.previewX + layout.previewX * frame.previewWidth,
  previewY: frame.previewY + layout.previewY * frame.previewHeight,
  previewWidth: layout.previewWidth * frame.previewWidth,
  previewHeight: layout.previewHeight * frame.previewHeight,
});

const isLayoutInsideFrame = (
  layout: { previewX: number; previewY: number; previewWidth: number; previewHeight: number },
  frame: CompositionFrame,
  tolerance = 0.025,
) => {
  const right = layout.previewX + layout.previewWidth;
  const bottom = layout.previewY + layout.previewHeight;
  const frameRight = frame.previewX + frame.previewWidth;
  const frameBottom = frame.previewY + frame.previewHeight;

  return (
    layout.previewX >= frame.previewX - tolerance &&
    layout.previewY >= frame.previewY - tolerance &&
    right <= frameRight + tolerance &&
    bottom <= frameBottom + tolerance
  );
};

const inferDefaultTextColor = (userMessage: string) => {
  if (LIGHT_BACKGROUND_PATTERN.test(userMessage)) {
    return "#101828";
  }

  if (DARK_BACKGROUND_PATTERN.test(userMessage)) {
    return "#F8FAFC";
  }

  return null;
};

const inferDefaultBackgroundColor = (userMessage: string) => {
  if (LIGHT_BACKGROUND_PATTERN.test(userMessage)) {
    return "#FFFFFF";
  }

  if (DARK_BACKGROUND_PATTERN.test(userMessage)) {
    return "#081120";
  }

  return null;
};
const getDefaultPreviewLayout = (
  trackType: TimelineTrackType,
  clipName: string,
  elementPreset?: string | null,
) => {
  const loweredName = sanitizeText(elementPreset ?? clipName, clipName).toLowerCase();

  if (trackType === "subtitle") {
    return {
      previewX: 0.08,
      previewY: 0.76,
      previewWidth: 0.84,
      previewHeight: 0.18,
    };
  }

  if (loweredName.includes("background") || loweredName.includes("backdrop") || loweredName.includes("РЎвЂћР С•Р Р…")) {
    return {
      previewX: 0,
      previewY: 0,
      previewWidth: 1,
      previewHeight: 1,
    };
  }

  if (loweredName.includes("lower third")) {
    return {
      previewX: 0.05,
      previewY: 0.74,
      previewWidth: 0.48,
      previewHeight: 0.16,
    };
  }

  if (loweredName.includes("callout")) {
    return {
      previewX: 0.57,
      previewY: 0.18,
      previewWidth: 0.28,
      previewHeight: 0.24,
    };
  }

  if (loweredName.includes("progress")) {
    return {
      previewX: 0.12,
      previewY: 0.84,
      previewWidth: 0.76,
      previewHeight: 0.08,
    };
  }

  if (loweredName.includes("split")) {
    return {
      previewX: 0.08,
      previewY: 0.14,
      previewWidth: 0.84,
      previewHeight: 0.66,
    };
  }

  if (loweredName.includes("arrow")) {
    return {
      previewX: 0.18,
      previewY: 0.44,
      previewWidth: 0.64,
      previewHeight: 0.16,
    };
  }

  if (loweredName.includes("burst")) {
    return {
      previewX: 0.64,
      previewY: 0.12,
      previewWidth: 0.2,
      previewHeight: 0.2,
    };
  }

  if (/(title|subtitle|header|text|quote|description|body|h1|h2|h3)/i.test(loweredName)) {
    if (loweredName.includes("subtitle")) {
      return {
        previewX: 0.26,
        previewY: 0.78,
        previewWidth: 0.48,
        previewHeight: 0.11,
      };
    }

    if (loweredName.includes("h1") || loweredName.includes("hero")) {
      return {
        previewX: 0.18,
        previewY: 0.1,
        previewWidth: 0.64,
        previewHeight: 0.18,
      };
    }

    if (loweredName.includes("h2") || loweredName.includes("h3") || loweredName.includes("header")) {
      return {
        previewX: 0.16,
        previewY: 0.18,
        previewWidth: 0.68,
        previewHeight: 0.14,
      };
    }

    return {
      previewX: 0.16,
      previewY: 0.3,
      previewWidth: 0.68,
      previewHeight: 0.18,
    };
  }

  if (loweredName.includes("circle")) {
    return {
      previewX: 0.39,
      previewY: 0.32,
      previewWidth: 0.22,
      previewHeight: 0.22,
    };
  }

  if (loweredName.includes("triangle")) {
    return {
      previewX: 0.35,
      previewY: 0.36,
      previewWidth: 0.3,
      previewHeight: 0.22,
    };
  }

  if (loweredName.includes("line")) {
    return {
      previewX: 0.25,
      previewY: 0.47,
      previewWidth: 0.5,
      previewHeight: 0.07,
    };
  }

  return {
    previewX: 0.33,
    previewY: 0.3,
    previewWidth: 0.34,
    previewHeight: 0.2,
  };
};

const deriveDisplayTextFromLabel = (
  clipName: string,
  trackType: TimelineTrackType,
  elementPreset?: string | null,
) => {
  if (trackType === "audio") {
    return null;
  }

  const explicitMatch = /^(?:hero title|section title|topic header|subtitle|description|body text|quote block|lower third pro|callout bubble)\s*:\s*(.+)$/i.exec(clipName.trim());
  if (explicitMatch?.[1]) {
    return sanitizeNullableText(explicitMatch[1]);
  }

  const descriptor = sanitizeText(elementPreset ?? clipName, clipName).toLowerCase();
  if (trackType === "subtitle" || /(title|subtitle|header|text|quote|description|body|lower third|callout)/i.test(descriptor)) {
    return sanitizeNullableText(clipName.replace(/\s*\(h\d\)/i, ""));
  }

  return null;
};

const deriveNarrationTextFromLabel = (clipName: string, trackType: TimelineTrackType) => {
  if (trackType !== "audio") {
    return null;
  }

  const narrationMatch = /^(?:narration|voiceover|Р С•Р В·Р Р†РЎС“РЎвЂЎР С”Р В°|Р Т‘Р С‘Р С”РЎвЂљР С•РЎР‚)\s*:\s*(.+)$/i.exec(clipName.trim());
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

const normalizeElementStyle = (style?: EditingSchemaElementStyle | null) => {
  if (!style) {
    return undefined;
  }

  const normalizedStyle: EditingSchemaElementStyle = {
    fillColor: sanitizeNullableText(style.fillColor),
    accentColor: sanitizeNullableText(style.accentColor),
    textColor: sanitizeNullableText(style.textColor),
    strokeColor: sanitizeNullableText(style.strokeColor),
    backgroundColor: sanitizeNullableText(style.backgroundColor),
    backgroundOpacity:
      typeof style.backgroundOpacity === "number" ? clamp(style.backgroundOpacity, 0, 1) : null,
    borderRadiusPx:
      typeof style.borderRadiusPx === "number" ? clamp(style.borderRadiusPx, 0, 64) : null,
    textAlign:
      style.textAlign === "left" || style.textAlign === "center" || style.textAlign === "right"
        ? style.textAlign
        : null,
  };

  return Object.values(normalizedStyle).some((value) => value !== null) ? normalizedStyle : undefined;
};

const normalizeClip = ({
  clip,
  clipIndex,
  trackType,
  sequenceDurationFrames,
  assets,
  userMessage,
  compositionFrame,
}: {
  clip: EditingSchemaClip;
  clipIndex: number;
  trackType: TimelineTrackType;
  sequenceDurationFrames: number;
  assets: AiEditorAssetContext[];
  userMessage: string;
  compositionFrame: CompositionFrame | null;
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
  const descriptor = sanitizeText(elementPreset ?? clip.name, clip.name).toLowerCase();
  const hasExplicitLayout =
    clip.previewX !== null &&
    clip.previewY !== null &&
    clip.previewWidth !== null &&
    clip.previewHeight !== null;
  const defaultLayout =
    compositionFrame && clip.source === "element"
      ? projectLayoutIntoFrame(
          getFrameRelativePreviewLayout(trackType, clip.name, elementPreset, compositionFrame.aspectRatio),
          compositionFrame,
        )
      : getDefaultPreviewLayout(trackType, clip.name, elementPreset);

  let previewX = clip.previewX ?? defaultLayout.previewX;
  let previewY = clip.previewY ?? defaultLayout.previewY;
  let previewWidth = clip.previewWidth ?? defaultLayout.previewWidth;
  let previewHeight = clip.previewHeight ?? defaultLayout.previewHeight;

  if (compositionFrame && clip.source === "element") {
    const currentLayout = { previewX, previewY, previewWidth, previewHeight };

    if (!hasExplicitLayout || isBackgroundDescriptor(descriptor) || isTextDescriptor(descriptor)) {
      previewX = defaultLayout.previewX;
      previewY = defaultLayout.previewY;
      previewWidth = defaultLayout.previewWidth;
      previewHeight = defaultLayout.previewHeight;
    } else if (!isLayoutInsideFrame(currentLayout, compositionFrame)) {
      const fittedLayout = projectLayoutIntoFrame(currentLayout, compositionFrame);
      previewX = fittedLayout.previewX;
      previewY = fittedLayout.previewY;
      previewWidth = fittedLayout.previewWidth;
      previewHeight = fittedLayout.previewHeight;
    }
  }

  const normalizedElementStyle = normalizeElementStyle(clip.elementStyle);
  const resolvedElementStyle = (() => {
    if (clip.source !== "element") {
      return normalizedElementStyle;
    }

    const nextStyle = normalizedElementStyle ? { ...normalizedElementStyle } : {};

    if (isTextDescriptor(descriptor)) {
      nextStyle.textAlign ??= "center";
      nextStyle.textColor ??= inferDefaultTextColor(userMessage) ?? undefined;
    }

    if (isBackgroundDescriptor(descriptor)) {
      nextStyle.backgroundColor ??= inferDefaultBackgroundColor(userMessage) ?? undefined;
    }

    return Object.values(nextStyle).some((value) => value !== null && value !== undefined)
      ? nextStyle
      : undefined;
  })();

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
    subtitleOutlineWidth:
      clip.subtitleOutlineWidth === null ? null : clamp(clip.subtitleOutlineWidth, 0, 12),
    subtitleBackgroundOpacity:
      clip.subtitleBackgroundOpacity === null ? null : clamp(clip.subtitleBackgroundOpacity, 0, 1),
    subtitleFontWeight:
      clip.subtitleFontWeight === null
        ? null
        : clamp(Math.round(clip.subtitleFontWeight / 100) * 100, 100, 900),
    subtitleFontSizePx:
      clip.subtitleFontSizePx === null ? null : clamp(clip.subtitleFontSizePx, 10, 96),
    subtitleBorderRadiusPx:
      clip.subtitleBorderRadiusPx === null ? null : clamp(clip.subtitleBorderRadiusPx, 0, 64),
    subtitlePaddingXPx:
      clip.subtitlePaddingXPx === null ? null : clamp(clip.subtitlePaddingXPx, 0, 64),
    subtitlePaddingYPx:
      clip.subtitlePaddingYPx === null ? null : clamp(clip.subtitlePaddingYPx, 0, 64),
    elementPreset,
    content: normalizeClipContent({ clip, trackType, elementPreset }),
    elementStyle: resolvedElementStyle,
  };
};

const hasTrackEdits = (schema: EditingSchema) => schema.tracks.some((track) => track.clips.length > 0);

const hasExplicitEditIntent = (userMessage: string) => {
  const message = userMessage.trim();
  if (!message || SMALL_TALK_ONLY_PATTERN.test(message)) {
    return false;
  }

  return ENGLISH_EDIT_INTENT_PATTERN.test(message) || CYRILLIC_EDIT_INTENT_PATTERN.test(message);
};

const deriveTopicTitle = (userMessage: string) => {
  const quotedTopic = /["РІР‚СљРІР‚СњР’В«Р’В»](.+?)["РІР‚СљРІР‚СњР’В«Р’В»]/.exec(userMessage)?.[1];
  if (quotedTopic?.trim()) {
    return quotedTopic.trim();
  }

  const topicalMatch =
    /(?:topic|theme|about|on|for|Р Р…Р В° РЎвЂљР ВµР СРЎС“|Р С—Р С• РЎвЂљР ВµР СР Вµ|Р С—РЎР‚Р С•|Р С•Р В±|Р С•)\s+([^.!?\n]+)/i.exec(userMessage)?.[1] ?? null;
  if (topicalMatch?.trim()) {
    return topicalMatch.trim();
  }

  const sanitized = userMessage.replace(/\s+/g, " ").trim();
  if (!sanitized) {
    return "Video Outline";
  }

  const prefixRemoved = sanitized.replace(/^(please|pls|hey|hi|hello|Р С—РЎР‚Р С‘Р Р†Р ВµРЎвЂљ|РЎРѓР Т‘Р ВµР В»Р В°Р в„–|РЎРѓР С•Р В·Р Т‘Р В°Р в„–|РЎРѓР СР С•Р Р…РЎвЂљР С‘РЎР‚РЎС“Р в„–)\s+/i, "");
  const candidate = prefixRemoved || sanitized;
  return candidate.length > 72 ? `${candidate.slice(0, 69)}...` : candidate;
};

const getFallbackTheme = (userMessage: string): FallbackTheme => {
  if (/(white background|white bg|Р Р…Р В° Р В±Р ВµР В»Р С•Р С РЎвЂћР С•Р Р…Р Вµ|Р В±Р ВµР В»Р С•Р С РЎвЂћР С•Р Р…Р Вµ|Р В±Р ВµР В»РЎвЂ№Р в„– РЎвЂћР С•Р Р…)/i.test(userMessage)) {
    return {
      backgroundPreset: "White Background",
      backgroundColor: "#ffffff",
      textColor: "#101828",
      surfaceColor: "#F59E0B",
      accentColor: "#2563EB",
      lineColor: "#F97316",
    };
  }

  if (/(dark background|black background|РЎвЂљР ВµР СР Р…Р С•Р С РЎвЂћР С•Р Р…Р Вµ|РЎвЂљРЎвЂР СР Р…Р С•Р С РЎвЂћР С•Р Р…Р Вµ|РЎвЂЎР ВµРЎР‚Р Р…Р С•Р С РЎвЂћР С•Р Р…Р Вµ)/i.test(userMessage)) {
    return {
      backgroundPreset: "Solid Rectangle",
      backgroundColor: "#081120",
      textColor: "#F8FAFC",
      surfaceColor: "#1D4ED8",
      accentColor: "#22C55E",
      lineColor: "#F59E0B",
    };
  }

  return {
    backgroundPreset: "Solid Rectangle",
    backgroundColor: "#F8FAFC",
    textColor: "#0F172A",
    surfaceColor: "#2563EB",
    accentColor: "#F59E0B",
    lineColor: "#0EA5E9",
  };
};

const buildStoryboardScenes = (topic: string): StoryboardScene[] => {
  return [
    {
      title: topic,
      body: "Establish the requested outcome and set the direction of the edit immediately.",
      narration: `Open the piece by framing ${topic} and clarifying what the viewer is about to get.`,
      accentPreset: "Line Accent",
      designIntent: "Anchor the edit around the user's requested outcome.",
    },
    {
      title: "Primary beat",
      body: "Present the main idea, action, or message that the edit needs to communicate.",
      narration: "State the primary beat clearly and support it visually.",
      accentPreset: "Callout Bubble",
      designIntent: "Surface the single most important beat of the edit.",
    },
    {
      title: "Support",
      body: "Add the most useful supporting detail, comparison, or context for the requested result.",
      narration: "Bring in the supporting material that makes the main beat feel complete.",
      accentPreset: "Circle Pulse",
      designIntent: "Add enough support to make the edit coherent.",
    },
    {
      title: "Reinforcement",
      body: "Use motion, contrast, or layout to reinforce the key moment without inventing a new story.",
      narration: "Reinforce the key moment with visual contrast, pacing, or emphasis.",
      accentPreset: "Split Screen",
      designIntent: "Strengthen the edit with a focused visual beat.",
    },
    {
      title: "Finish",
      body: "Close with a clean ending, transition, or final message that matches the request.",
      narration: "End the sequence cleanly so the requested result feels finished.",
      accentPreset: "Arrow Swipe",
      designIntent: "Give the edit a deliberate final beat.",
    },
  ];
};

const buildSceneSpans = (durationFrames: number, count: number) => {
  const spans: { startFrame: number; durationFrames: number }[] = [];
  let cursor = 0;

  for (let index = 0; index < count; index += 1) {
    const remainingScenes = count - index;
    const remainingFrames = durationFrames - cursor;
    const sceneDuration =
      index === count - 1 ? remainingFrames : Math.max(Math.round(remainingFrames / remainingScenes), 60);

    spans.push({
      startFrame: cursor,
      durationFrames: Math.max(sceneDuration, 1),
    });
    cursor += sceneDuration;
  }

  return spans;
};

const createElementClip = ({
  name,
  startFrame,
  durationFrames,
  elementPreset,
  previewX,
  previewY,
  previewWidth,
  previewHeight,
  displayText,
  narrationText,
  designIntent,
  fillColor,
  accentColor,
  textColor,
  backgroundColor,
  borderRadiusPx,
  textAlign,
}: {
  name: string;
  startFrame: number;
  durationFrames: number;
  elementPreset: string;
  previewX: number;
  previewY: number;
  previewWidth: number;
  previewHeight: number;
  displayText?: string | null;
  narrationText?: string | null;
  designIntent?: string | null;
  fillColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  backgroundColor?: string | null;
  borderRadiusPx?: number | null;
  textAlign?: "left" | "center" | "right" | null;
}): EditingSchemaClip => ({
  name,
  startFrame,
  durationFrames,
  source: "element",
  mediaUrl: null,
  previewX,
  previewY,
  previewWidth,
  previewHeight,
  subtitleTextColor: null,
  subtitleOutlineColor: null,
  subtitleOutlineWidth: null,
  subtitleBackgroundColor: null,
  subtitleBackgroundOpacity: null,
  subtitleFontWeight: null,
  subtitleFontSizePx: null,
  subtitleBorderRadiusPx: null,
  subtitlePaddingXPx: null,
  subtitlePaddingYPx: null,
  elementPreset,
  content:
    displayText || narrationText || designIntent
      ? {
          displayText: displayText ?? null,
          narrationText: narrationText ?? null,
          designIntent: designIntent ?? null,
        }
      : undefined,
  elementStyle:
    fillColor || accentColor || textColor || backgroundColor || borderRadiusPx || textAlign
      ? {
          fillColor: fillColor ?? null,
          accentColor: accentColor ?? null,
          textColor: textColor ?? null,
          strokeColor: null,
          backgroundColor: backgroundColor ?? null,
          backgroundOpacity: null,
          borderRadiusPx: borderRadiusPx ?? null,
          textAlign: textAlign ?? null,
        }
      : undefined,
});

// Legacy scaffold generator retained for future manual fallback strategies.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createStarterMontageTracks = (durationFrames: number, userMessage: string): EditingSchema["tracks"] => {
  const topic = deriveTopicTitle(userMessage);
  const scenes = buildStoryboardScenes(topic);
  const sceneSpans = buildSceneSpans(durationFrames, scenes.length);
  const theme = getFallbackTheme(userMessage);

  const backgroundClip = createElementClip({
    name: theme.backgroundPreset,
    elementPreset: theme.backgroundPreset,
    startFrame: 0,
    durationFrames,
    previewX: 0,
    previewY: 0,
    previewWidth: 1,
    previewHeight: 1,
    displayText: null,
    designIntent: prefersRussian(userMessage)
      ? "Р В¤Р С•Р Р…Р С•Р Р†Р В°РЎРЏ РЎРѓРЎвЂ Р ВµР Р…Р В° Р Т‘Р В»РЎРЏ Р Р†РЎРѓР ВµР С–Р С• РЎР‚Р С•Р В»Р С‘Р С”Р В°."
      : "Full-frame background for the generated video.",
    backgroundColor: theme.backgroundColor,
  });

  const titleClips = scenes.map((scene, index) => {
    const span = sceneSpans[index]!;
    return createElementClip({
      name: index === 0 ? `Scene Title: ${scene.title}` : `Section Title: ${scene.title}`,
      elementPreset: index === 0 ? "Hero Title (H1)" : "Section Title (H2)",
      startFrame: span.startFrame + 6,
      durationFrames: Math.max(span.durationFrames - 12, 24),
      previewX: 0.14,
      previewY: 0.1,
      previewWidth: 0.72,
      previewHeight: 0.18,
      displayText: scene.title,
      designIntent: scene.designIntent,
      textColor: theme.textColor,
      textAlign: "center",
    });
  });

  const bodyClips = scenes.map((scene, index) => {
    const span = sceneSpans[index]!;
    return createElementClip({
      name: `Body Copy ${index + 1}`,
      elementPreset: "Body Text",
      startFrame: span.startFrame + 14,
      durationFrames: Math.max(span.durationFrames - 20, 24),
      previewX: 0.16,
      previewY: 0.32,
      previewWidth: 0.68,
      previewHeight: 0.22,
      displayText: scene.body,
      designIntent: scene.designIntent,
      textColor: theme.textColor,
      textAlign: "center",
    });
  });

  const accentClips = scenes.map((scene, index) => {
    const span = sceneSpans[index]!;
    const accentPreset = scene.accentPreset;
    const accentLayout = getDefaultPreviewLayout("video", accentPreset, accentPreset);

    return createElementClip({
      name: `Accent ${index + 1}`,
      elementPreset: accentPreset,
      startFrame: span.startFrame + 10,
      durationFrames: Math.max(span.durationFrames - 18, 18),
      previewX: accentLayout.previewX,
      previewY: accentLayout.previewY,
      previewWidth: accentLayout.previewWidth,
      previewHeight: accentLayout.previewHeight,
      displayText:
        accentPreset === "Callout Bubble" || accentPreset === "Lower Third Pro"
          ? scene.designIntent
          : null,
      designIntent: scene.designIntent,
      fillColor: theme.surfaceColor,
      accentColor: theme.accentColor,
      textColor: theme.textColor,
      backgroundColor: accentPreset === "Line Accent" ? theme.lineColor : null,
      borderRadiusPx: accentPreset === "Callout Bubble" ? 20 : 12,
      textAlign: "center",
    });
  });



  return [
    {
      type: "video",
      index: 0,
      clips: [backgroundClip],
    },
    {
      type: "video",
      index: 1,
      clips: titleClips,
    },
    {
      type: "video",
      index: 2,
      clips: bodyClips,
    },
    {
      type: "video",
      index: 3,
      clips: accentClips,
    },

  ];
};

export const normalizeEditingSchema = ({
  schema,
  currentSequence,
  assets,
  userMessage,
}: NormalizeEditingSchemaInput): EditingSchema => {
  const requestedDuration =
    typeof schema.durationFrames === "number" && Number.isFinite(schema.durationFrames)
      ? Math.max(Math.round(schema.durationFrames), 1)
      : null;

  const sequenceDurationFrames = requestedDuration ?? currentSequence.durationFrames;
  const requestedAspectRatio = inferRequestedAspectRatio(userMessage);
  const compositionFrame = requestedAspectRatio
    ? getCenteredCompositionFrame(requestedAspectRatio)
    : null;
  const normalizedTracks = schema.tracks
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
            userMessage,
            compositionFrame,
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

  const normalizedSchema: EditingSchema = {
    ...schema,
    assistantMessage: sanitizeText(
      schema.assistantMessage,
      hasTrackEdits({ ...schema, tracks: normalizedTracks })
        ? prefersRussian(userMessage)
          ? "Р СџРЎР‚Р С‘Р СР ВµР Р…Р С‘Р В» Р СР С•Р Р…РЎвЂљР В°Р В¶Р Р…РЎвЂ№Р Вµ Р С‘Р В·Р СР ВµР Р…Р ВµР Р…Р С‘РЎРЏ Р С—Р С• Р Р†Р В°РЎв‚¬Р ВµР СРЎС“ Р В·Р В°Р С—РЎР‚Р С•РЎРѓРЎС“."
          : "Applied timeline edits based on your request."
        : prefersRussian(userMessage)
          ? `Р СџР С•Р С”Р В° Р Р…Р ВµРЎвЂљ Р С‘Р В·Р СР ВµР Р…Р ВµР Р…Р С‘Р в„– Р Р† РЎвЂљР В°Р в„–Р СР В»Р В°Р в„–Р Р…Р Вµ. Р Р€РЎвЂљР С•РЎвЂЎР Р…Р С‘РЎвЂљР Вµ Р В·Р В°Р Т‘Р В°РЎвЂЎРЎС“: ${sanitizeText(userMessage, "РЎвЂЎРЎвЂљР С• Р Р…РЎС“Р В¶Р Р…Р С• Р С‘Р В·Р СР ВµР Р…Р С‘РЎвЂљРЎРЉ Р Р† Р С—Р ВµРЎР‚Р Р†РЎС“РЎР‹ Р С•РЎвЂЎР ВµРЎР‚Р ВµР Т‘РЎРЉ?")}`
          : `No timeline edits applied yet. Clarify the exact edit goal: ${sanitizeText(userMessage, "what should I change first?")}`,
    ),
    durationFrames: requestedDuration,
    tracks: normalizedTracks,
  };

  return normalizedSchema;
};

export const ensureNonEmptyEditingSchemaForIntent = ({
  schema,
  userMessage,
}: EnsureNonEmptyEditingSchemaForIntentInput): EditingSchema => {
  if (hasTrackEdits(schema) || !hasExplicitEditIntent(userMessage)) {
    return schema;
  }

  return {
    ...schema,
    durationFrames: schema.durationFrames,
    assistantMessage:
      "No edits were applied automatically because the model did not return a precise enough EditingSchema for this request.",
    tracks: [],
  };
};









