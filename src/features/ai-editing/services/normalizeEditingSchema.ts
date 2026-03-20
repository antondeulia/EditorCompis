import { AiEditorAssetContext } from "@/features/ai-editing/agent/editorAgent";
import { EditingSchema, EditingSchemaClip } from "@/features/ai-editing/types/editingSchema";
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

const ENGLISH_EDIT_INTENT_PATTERN =
  /\b(make|create|build|generate|edit|montage|video|scene|rebuild|add|insert|subtitle|captions|animate|animation)\b/i;
const CYRILLIC_EDIT_INTENT_PATTERN =
  /(сделай|создай|собери|смонтируй|монтаж|видео|добавь|субтитр|титр|анимац|сгенерируй)/i;
const SMALL_TALK_ONLY_PATTERN = /^(hi|hello|hey|yo|привет|здравствуй|добрый\s+(день|вечер)|ку|хай)[!.,\s]*$/i;

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

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9а-яё]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

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

  const nameTokens = tokenize(clip.name);
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

const getDefaultPreviewLayout = (trackType: TimelineTrackType, clipName: string) => {
  const loweredName = clipName.toLowerCase();

  if (trackType === "subtitle") {
    return {
      previewX: 0.08,
      previewY: 0.76,
      previewWidth: 0.84,
      previewHeight: 0.18,
    };
  }

  if (loweredName.includes("background") || loweredName.includes("backdrop") || loweredName.includes("фон")) {
    return {
      previewX: 0,
      previewY: 0,
      previewWidth: 1,
      previewHeight: 1,
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
        previewX: 0.28,
        previewY: 0.1,
        previewWidth: 0.44,
        previewHeight: 0.14,
      };
    }

    if (loweredName.includes("h2") || loweredName.includes("h3") || loweredName.includes("header")) {
      return {
        previewX: 0.3,
        previewY: 0.18,
        previewWidth: 0.4,
        previewHeight: 0.12,
      };
    }

    return {
      previewX: 0.28,
      previewY: 0.3,
      previewWidth: 0.44,
      previewHeight: 0.16,
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

const normalizeClip = ({
  clip,
  clipIndex,
  trackType,
  sequenceDurationFrames,
  assets,
}: {
  clip: EditingSchemaClip;
  clipIndex: number;
  trackType: TimelineTrackType;
  sequenceDurationFrames: number;
  assets: AiEditorAssetContext[];
}): EditingSchemaClip => {
  const safeDuration = clamp(Math.round(clip.durationFrames), 1, sequenceDurationFrames);
  const safeStart = clamp(Math.round(clip.startFrame), 0, Math.max(sequenceDurationFrames - safeDuration, 0));
  const fallbackName =
    trackType === "subtitle"
      ? `Subtitle ${clipIndex + 1}`
      : trackType === "audio"
        ? `Audio Clip ${clipIndex + 1}`
        : `Visual Clip ${clipIndex + 1}`;

  const defaultLayout = getDefaultPreviewLayout(trackType, clip.name);

  const previewX = clip.previewX ?? defaultLayout.previewX;
  const previewY = clip.previewY ?? defaultLayout.previewY;
  const previewWidth = clip.previewWidth ?? defaultLayout.previewWidth;
  const previewHeight = clip.previewHeight ?? defaultLayout.previewHeight;

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
  const sanitized = userMessage.replace(/\s+/g, " ").trim();
  if (!sanitized) {
    return "Video Outline";
  }

  const prefixRemoved = sanitized.replace(/^(please|pls|hey|hi|hello|привет|сделай|создай)\s+/i, "");
  const candidate = prefixRemoved || sanitized;
  return candidate.length > 72 ? `${candidate.slice(0, 69)}...` : candidate;
};

const createStarterMontageTracks = (durationFrames: number, userMessage: string): EditingSchema["tracks"] => {
  const introDuration = Math.max(Math.round(durationFrames * 0.22), 60);
  const sectionDuration = Math.max(Math.round(durationFrames * 0.26), 70);
  const markerDuration = Math.max(Math.round(durationFrames * 0.2), 60);

  return [
    {
      type: "video",
      index: 0,
      clips: [
        {
          name: "White Background",
          startFrame: 0,
          durationFrames,
          source: "element",
          mediaUrl: null,
          previewX: 0,
          previewY: 0,
          previewWidth: 1,
          previewHeight: 1,
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
        },
      ],
    },
    {
      type: "video",
      index: 1,
      clips: [
        {
          name: `Hero Title (H1): ${deriveTopicTitle(userMessage)}`,
          startFrame: 12,
          durationFrames: introDuration,
          source: "element",
          mediaUrl: null,
          previewX: 0.18,
          previewY: 0.12,
          previewWidth: 0.64,
          previewHeight: 0.2,
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
        },
        {
          name: "Section Title (H2): Main Ideas",
          startFrame: introDuration + 24,
          durationFrames: sectionDuration,
          source: "element",
          mediaUrl: null,
          previewX: 0.2,
          previewY: 0.38,
          previewWidth: 0.6,
          previewHeight: 0.15,
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
        },
        {
          name: "Line Accent",
          startFrame: introDuration + sectionDuration + 42,
          durationFrames: markerDuration,
          source: "element",
          mediaUrl: null,
          previewX: 0.22,
          previewY: 0.58,
          previewWidth: 0.56,
          previewHeight: 0.08,
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
        },
      ],
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
        ? "Applied timeline edits based on your request."
        : `No timeline edits applied yet. Clarify the exact edit goal: ${sanitizeText(userMessage, "what should I change first?")}`,
    ),
    durationFrames: requestedDuration,
    tracks: normalizedTracks,
  };

  return normalizedSchema;
};

export const ensureNonEmptyEditingSchemaForIntent = ({
  schema,
  currentSequence,
  userMessage,
}: EnsureNonEmptyEditingSchemaForIntentInput): EditingSchema => {
  if (hasTrackEdits(schema) || !hasExplicitEditIntent(userMessage)) {
    return schema;
  }

  const effectiveDuration =
    typeof schema.durationFrames === "number" && Number.isFinite(schema.durationFrames)
      ? Math.max(Math.round(schema.durationFrames), 1)
      : currentSequence.durationFrames;

  return {
    ...schema,
    durationFrames: schema.durationFrames,
    assistantMessage:
      schema.assistantMessage.trim().length > 0
        ? `${schema.assistantMessage}\n\nGenerated a starter montage because your request explicitly asked for timeline edits.`
        : "Generated a starter montage because your request explicitly asked for timeline edits.",
    tracks: createStarterMontageTracks(effectiveDuration, userMessage),
  };
};
