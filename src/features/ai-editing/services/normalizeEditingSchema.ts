import { AiEditorAssetContext } from '@/features/ai-editing/agent/editorAgent';
import {
  EditingSchema,
  EditingSchemaClip,
  EditingSchemaClipContent,
  EditingSchemaElementStyle,
} from '@/features/ai-editing/types/editingSchema';
import { TimelineSequence, TimelineTrackType } from '@/features/timeline/types/timeline';

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
  label: string;
  title: string;
  body: string;
  list: string[];
  narration: string;
  accentPreset: string;
  designIntent: string;
  motionNote: string;
}

interface FallbackTheme {
  backgroundPreset: string;
  backgroundColor: string;
  textColor: string;
  surfaceColor: string;
  accentColor: string;
  lineColor: string;
}

interface ScenePlanSummary {
  startFrame: number;
  endFrame: number;
  label: string | null;
  title: string;
  body: string | null;
  list: string[];
  visual: string | null;
  motion: string;
}

type SceneRole = 'background' | 'label' | 'title' | 'body' | 'list' | 'graphic' | 'accent' | 'subtitle';

const KNOWN_PRESET_NAMES = [
  'Hero Title (H1)',
  'Section Title (H2)',
  'Topic Header (H3)',
  'Subtitle',
  'Description',
  'Body Text',
  'Quote Block',
  'Solid Rectangle',
  'Circle Pulse',
  'Triangle Marker',
  'Line Accent',
  'Lower Third Pro',
  'Callout Bubble',
  'Progress Bar',
  'Split Screen',
  'Arrow Swipe',
  'Star Burst',
  'White Background',
] as const;

const DEFAULT_VIEWPORT_ASPECT_RATIO = 16 / 9;
const STARTER_SCENE_MIN_DURATION_FRAMES = 84;
const SCENE_GROUPING_TOLERANCE_FRAMES = 18;

const ENGLISH_EDIT_INTENT_PATTERN =
  /\b(make|create|build|generate|edit|montage|video|scene|storyboard|rebuild|add|insert|subtitle|captions?|animate|animation|transition|timing|pace|layout|style|trim|cut|lesson|tutorial|guide|explainer|presentation)\b/i;
const CYRILLIC_EDIT_INTENT_PATTERN =
  /(сделай|создай|сгенер|видео|сцен|монтаж|смонт|добав|анимац|переход|таймлайн|структур|урок|объясн|презентац|оформи|макет|размести|субтитр|титр)/i;
const SMALL_TALK_ONLY_PATTERN = /^(hi|hello|hey|yo|привет|здравствуй|здравствуйте|добрый день|добрый вечер)[!.,\s]*$/i;

const GENERATED_VIDEO_REQUEST_PATTERN =
  /\b(full|complete|educational|explain|explainer|lesson|tutorial|guide|overview|walkthrough|presentation|storyboard|topic)\b/i;
const RUSSIAN_GENERATED_VIDEO_REQUEST_PATTERN =
  /(полноц|образовательн|объясни|объясняющ|урок|гайд|разбор|презентац|структур|по теме|на тему|сделай видео|создай видео)/i;

const EXPLICIT_ASPECT_RATIO_PATTERN = /(?:^|[^\d])(\d{1,2})\s*(?::|x|\/)\s*(\d{1,2})(?:[^\d]|$)/i;
const VERTICAL_FORMAT_PATTERN = /(vertical|portrait|tiktok|reels?|shorts?|stories?|snapchat|вертикал|портрет|тикток|рилс|шортс|сторис)/i;
const SQUARE_FORMAT_PATTERN = /(square|instagram post|feed post|квадрат)/i;
const LANDSCAPE_FORMAT_PATTERN = /(horizontal|landscape|widescreen|youtube|горизонтал|широкий|ютуб)/i;
const LIGHT_BACKGROUND_PATTERN = /(white background|white bg|light background|бел(?:ый|ом|ом фоне)|светл(?:ый|ом) фон)/i;
const DARK_BACKGROUND_PATTERN = /(dark background|black background|темн(?:ый|ом) фон|черн(?:ый|ом) фон)/i;
const CYRILLIC_PATTERN = /[А-Яа-яЁё]/;

const clamp = (value: number, min: number, max: number) => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const sanitizeText = (value: string | null | undefined, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const sanitizeNullableText = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const prefersRussian = (userMessage: string) => CYRILLIC_PATTERN.test(userMessage);

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9а-яё]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

const isBackgroundDescriptor = (descriptor: string) =>
  descriptor.includes('background') || descriptor.includes('backdrop') || descriptor.includes('фон');

const isTitleDescriptor = (descriptor: string) =>
  /(hero title|section title|topic header|title|header|heading|h1|h2|h3|заголов)/i.test(descriptor);

const isBodyDescriptor = (descriptor: string) =>
  /(description|body text|body|quote|описан|текст|цитат)/i.test(descriptor);

const isGraphicDescriptor = (descriptor: string) =>
  /(rectangle|circle|triangle|line accent|lower third|callout|progress|split|arrow|burst|shape|card|placeholder|прямоуголь|круг|треуголь|линия|плейсхолдер|фигура)/i.test(
    descriptor,
  );

const isListText = (value: string | null | undefined) => {
  const text = sanitizeNullableText(value);
  if (!text) {
    return false;
  }

  return text.includes('\n') || /^[•\-*\d]/.test(text);
};

const splitListItems = (value: string | null | undefined) => {
  const text = sanitizeNullableText(value);
  if (!text) {
    return [];
  }

  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•\-*\d.)]+/, '').trim())
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
  if (clip.source !== 'asset') {
    return null;
  }

  if (typeof clip.mediaUrl === 'string' && clip.mediaUrl.trim().length > 0) {
    return clip.mediaUrl;
  }

  const expectedType = trackType === 'audio' ? 'audio' : 'video';
  const candidates = assets.filter(
    (asset) =>
      typeof asset.mediaUrl === 'string' &&
      asset.mediaUrl.trim().length > 0 &&
      (asset.mediaType === expectedType || asset.mediaType === 'unknown'),
  );

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0]?.mediaUrl ?? null;
  }

  const clipSearchText = [clip.name, clip.content?.displayText, clip.content?.designIntent]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
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
        mediaUrl: candidate.mediaUrl ?? '',
        score: overlap,
      };
    }
  }

  return bestMatch?.mediaUrl || candidates[0]?.mediaUrl || null;
};

const hasExplicitEditIntent = (userMessage: string) => {
  const message = userMessage.trim();
  if (!message || SMALL_TALK_ONLY_PATTERN.test(message)) {
    return false;
  }

  return ENGLISH_EDIT_INTENT_PATTERN.test(message) || CYRILLIC_EDIT_INTENT_PATTERN.test(message);
};

const requestNeedsGeneratedCoverage = (userMessage: string) => {
  if (!hasExplicitEditIntent(userMessage)) {
    return false;
  }

  return GENERATED_VIDEO_REQUEST_PATTERN.test(userMessage) || RUSSIAN_GENERATED_VIDEO_REQUEST_PATTERN.test(userMessage);
};

const inferRequestedAspectRatio = (userMessage: string): number | null => {
  const explicitMatch = EXPLICIT_ASPECT_RATIO_PATTERN.exec(userMessage);
  if (explicitMatch) {
    const width = Number.parseFloat(explicitMatch[1] ?? '');
    const height = Number.parseFloat(explicitMatch[2] ?? '');
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

const getAspectRatioLabel = (aspectRatio: number) => {
  const presets = [
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
    { label: '1:1', value: 1 },
    { label: '4:5', value: 4 / 5 },
    { label: '21:9', value: 21 / 9 },
  ];

  const matchedPreset = presets.find((preset) => Math.abs(preset.value - aspectRatio) <= 0.02);
  if (matchedPreset) {
    return matchedPreset.label;
  }

  const width = Math.max(1, Math.round(aspectRatio * 100));
  return String(width) + ':100';
};

const deriveTopicTitle = (userMessage: string) => {
  const topicalMatch = /(?:topic|theme|about|on|for|на тему|про|о)\s+([^.!?\n]+)/i.exec(userMessage)?.[1] ?? null;
  if (topicalMatch?.trim()) {
    return topicalMatch.trim();
  }

  const sanitized = userMessage.replace(/\s+/g, ' ').trim();
  if (!sanitized) {
    return 'Video Outline';
  }

  const prefixRemoved = sanitized.replace(/^(please|pls|hey|hi|hello|привет|сделай|создай|сгенерируй)\s+/i, '');
  const candidate = prefixRemoved || sanitized;
  return candidate.length > 72 ? candidate.slice(0, 69) + '...' : candidate;
};

const getFallbackTheme = (userMessage: string): FallbackTheme => {
  if (LIGHT_BACKGROUND_PATTERN.test(userMessage)) {
    return {
      backgroundPreset: 'White Background',
      backgroundColor: '#FFFFFF',
      textColor: '#101828',
      surfaceColor: '#E8EEF9',
      accentColor: '#2563EB',
      lineColor: '#0EA5E9',
    };
  }

  if (DARK_BACKGROUND_PATTERN.test(userMessage)) {
    return {
      backgroundPreset: 'Solid Rectangle',
      backgroundColor: '#081120',
      textColor: '#F8FAFC',
      surfaceColor: '#1D4ED8',
      accentColor: '#22C55E',
      lineColor: '#F59E0B',
    };
  }

  return {
    backgroundPreset: 'Solid Rectangle',
    backgroundColor: '#F8FAFC',
    textColor: '#0F172A',
    surfaceColor: '#DBEAFE',
    accentColor: '#2563EB',
    lineColor: '#60A5FA',
  };
};

const getBackgroundSummary = (userMessage: string, isRussian: boolean) => {
  if (LIGHT_BACKGROUND_PATTERN.test(userMessage)) {
    return isRussian ? 'белый фон' : 'white background';
  }

  if (DARK_BACKGROUND_PATTERN.test(userMessage)) {
    return isRussian ? 'темный фон' : 'dark background';
  }

  return isRussian ? 'чистый нейтральный фон' : 'clean neutral background';
};

const getCompositionSummary = (aspectRatio: number, isRussian: boolean) => {
  if (aspectRatio < 0.85) {
    return isRussian
      ? 'Вертикальная композиция: заголовок и текстовые блоки сверху, ниже отдельный визуальный блок, все элементы держатся в безопасных полях.'
      : 'Vertical composition: headline and text stack at the top, a separate visual block below, and everything kept inside safe margins.';
  }

  if (aspectRatio <= 1.15) {
    return isRussian
      ? 'Почти квадратная композиция: сильный верхний заголовок, компактный текстовый стек и отдельная зона под графику без налезания элементов.'
      : 'Near square composition: strong top headline, compact text stack, and a separate graphic zone with no overlaps.';
  }

  return isRussian
    ? 'Композиция 16:9 по центру: слева текстовая иерархия, справа отдельный графический блок, ровные поля и читаемые отступы.'
    : 'Centered 16 by 9 composition: text hierarchy on the left, separate graphic block on the right, and clean readable margins.';
};

const getDefaultRoleLayout = (
  role: SceneRole,
  aspectRatio: number,
  sceneIndex: number,
): { previewX: number; previewY: number; previewWidth: number; previewHeight: number } => {
  if (role === 'background') {
    return { previewX: 0, previewY: 0, previewWidth: 1, previewHeight: 1 };
  }

  if (role === 'subtitle') {
    return aspectRatio < 1
      ? { previewX: 0.08, previewY: 0.84, previewWidth: 0.84, previewHeight: 0.1 }
      : { previewX: 0.1, previewY: 0.82, previewWidth: 0.8, previewHeight: 0.1 };
  }

  if (aspectRatio < 0.85) {
    switch (role) {
      case 'label':
        return { previewX: 0.1, previewY: 0.08, previewWidth: 0.28, previewHeight: 0.05 };
      case 'title':
        return { previewX: 0.1, previewY: 0.16, previewWidth: 0.8, previewHeight: 0.13 };
      case 'accent':
        return { previewX: 0.1, previewY: 0.31, previewWidth: 0.18, previewHeight: 0.012 };
      case 'body':
        return { previewX: 0.1, previewY: 0.35, previewWidth: 0.8, previewHeight: 0.11 };
      case 'list':
        return { previewX: 0.1, previewY: 0.5, previewWidth: 0.8, previewHeight: 0.16 };
      case 'graphic':
        return sceneIndex % 2 === 0
          ? { previewX: 0.16, previewY: 0.7, previewWidth: 0.68, previewHeight: 0.18 }
          : { previewX: 0.12, previewY: 0.68, previewWidth: 0.76, previewHeight: 0.2 };
      default:
        return { previewX: 0.12, previewY: 0.22, previewWidth: 0.76, previewHeight: 0.18 };
    }
  }

  if (aspectRatio <= 1.15) {
    switch (role) {
      case 'label':
        return { previewX: 0.1, previewY: 0.08, previewWidth: 0.22, previewHeight: 0.05 };
      case 'title':
        return { previewX: 0.1, previewY: 0.16, previewWidth: 0.74, previewHeight: 0.14 };
      case 'accent':
        return { previewX: 0.1, previewY: 0.32, previewWidth: 0.16, previewHeight: 0.012 };
      case 'body':
        return { previewX: 0.1, previewY: 0.36, previewWidth: 0.74, previewHeight: 0.11 };
      case 'list':
        return { previewX: 0.1, previewY: 0.52, previewWidth: 0.42, previewHeight: 0.18 };
      case 'graphic':
        return { previewX: 0.56, previewY: 0.5, previewWidth: 0.28, previewHeight: 0.28 };
      default:
        return { previewX: 0.14, previewY: 0.24, previewWidth: 0.72, previewHeight: 0.18 };
    }
  }

  switch (role) {
    case 'label':
      return { previewX: 0.08, previewY: 0.1, previewWidth: 0.18, previewHeight: 0.05 };
    case 'title':
      return { previewX: 0.08, previewY: 0.17, previewWidth: 0.46, previewHeight: 0.15 };
    case 'accent':
      return { previewX: 0.08, previewY: 0.34, previewWidth: 0.14, previewHeight: 0.012 };
    case 'body':
      return { previewX: 0.08, previewY: 0.38, previewWidth: 0.36, previewHeight: 0.11 };
    case 'list':
      return { previewX: 0.08, previewY: 0.54, previewWidth: 0.34, previewHeight: 0.18 };
    case 'graphic':
      return sceneIndex % 2 === 0
        ? { previewX: 0.62, previewY: 0.16, previewWidth: 0.24, previewHeight: 0.56 }
        : { previewX: 0.58, previewY: 0.2, previewWidth: 0.28, previewHeight: 0.48 };
    default:
      return { previewX: 0.14, previewY: 0.24, previewWidth: 0.72, previewHeight: 0.18 };
  }
};

const deriveDisplayTextFromLabel = (
  clipName: string,
  trackType: TimelineTrackType,
  elementPreset?: string | null,
) => {
  if (trackType === 'audio') {
    return null;
  }

  const explicitMatch = /^(?:hero title|section title|topic header|subtitle|description|body text|quote block|lower third pro|callout bubble)\s*:\s*(.+)$/i.exec(
    clipName.trim(),
  );
  if (explicitMatch?.[1]) {
    return sanitizeNullableText(explicitMatch[1]);
  }

  const descriptor = sanitizeText(elementPreset ?? clipName, clipName).toLowerCase();
  if (trackType === 'subtitle' || isTitleDescriptor(descriptor) || isBodyDescriptor(descriptor)) {
    return sanitizeNullableText(clipName.replace(/\s*\(h\d\)/i, ''));
  }

  return null;
};

const deriveNarrationTextFromLabel = (clipName: string, trackType: TimelineTrackType) => {
  if (trackType !== 'audio') {
    return null;
  }

  const narrationMatch = /^(?:narration|voiceover|озвучка|диктор)\s*:\s*(.+)$/i.exec(clipName.trim());
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

  return Object.values(normalizedContent).some((value) => typeof value === 'string')
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
      typeof style.backgroundOpacity === 'number' ? clamp(style.backgroundOpacity, 0, 1) : null,
    borderRadiusPx:
      typeof style.borderRadiusPx === 'number' ? clamp(style.borderRadiusPx, 0, 64) : null,
    textAlign:
      style.textAlign === 'left' || style.textAlign === 'center' || style.textAlign === 'right'
        ? style.textAlign
        : null,
  };

  return Object.values(normalizedStyle).some((value) => value !== null) ? normalizedStyle : undefined;
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
  if (trackType === 'subtitle') {
    return 'subtitle';
  }

  const descriptor = sanitizeText(elementPreset ?? clipName, clipName).toLowerCase();
  if (isBackgroundDescriptor(descriptor)) {
    return 'background';
  }

  if (descriptor.includes('topic header') || descriptor.includes('label') || descriptor.includes('kicker')) {
    return 'label';
  }

  if (isTitleDescriptor(descriptor)) {
    return descriptor.includes('topic header') ? 'label' : 'title';
  }

  if (isListText(displayText)) {
    return 'list';
  }

  if (descriptor.includes('line accent') || descriptor.includes('line')) {
    return 'accent';
  }

  if (isBodyDescriptor(descriptor)) {
    return 'body';
  }

  if (isGraphicDescriptor(descriptor)) {
    return descriptor.includes('line accent') ? 'accent' : 'graphic';
  }

  return displayText ? 'body' : 'graphic';
};

const normalizeClip = ({
  clip,
  clipIndex,
  trackType,
  sequenceDurationFrames,
  assets,
  userMessage,
  aspectRatio,
}: {
  clip: EditingSchemaClip;
  clipIndex: number;
  trackType: TimelineTrackType;
  sequenceDurationFrames: number;
  assets: AiEditorAssetContext[];
  userMessage: string;
  aspectRatio: number;
}): EditingSchemaClip => {
  const safeDuration = clamp(Math.round(clip.durationFrames), 1, sequenceDurationFrames);
  const safeStart = clamp(Math.round(clip.startFrame), 0, Math.max(sequenceDurationFrames - safeDuration, 0));
  const fallbackName =
    trackType === 'subtitle'
      ? 'Subtitle ' + String(clipIndex + 1)
      : trackType === 'audio'
        ? 'Narration ' + String(clipIndex + 1)
        : 'Scene ' + String(clipIndex + 1);

  const elementPreset = resolveElementPreset(clip);
  const normalizedContent = normalizeClipContent({ clip, trackType, elementPreset });
  const role = detectSceneRole({
    clipName: clip.name,
    trackType,
    elementPreset,
    displayText: normalizedContent?.displayText,
  });
  const defaultLayout =
    clip.source === 'asset' && clip.mediaUrl
      ? { previewX: 0, previewY: 0, previewWidth: 1, previewHeight: 1 }
      : getDefaultRoleLayout(role, aspectRatio, clipIndex);

  const hasExplicitLayout =
    typeof clip.previewX === 'number' &&
    typeof clip.previewY === 'number' &&
    typeof clip.previewWidth === 'number' &&
    typeof clip.previewHeight === 'number';

  let previewX = hasExplicitLayout ? clip.previewX ?? defaultLayout.previewX : defaultLayout.previewX;
  let previewY = hasExplicitLayout ? clip.previewY ?? defaultLayout.previewY : defaultLayout.previewY;
  let previewWidth = hasExplicitLayout ? clip.previewWidth ?? defaultLayout.previewWidth : defaultLayout.previewWidth;
  let previewHeight = hasExplicitLayout ? clip.previewHeight ?? defaultLayout.previewHeight : defaultLayout.previewHeight;

  if (role === 'background') {
    previewX = 0;
    previewY = 0;
    previewWidth = 1;
    previewHeight = 1;
  }

  const theme = getFallbackTheme(userMessage);
  const normalizedElementStyle = normalizeElementStyle(clip.elementStyle);
  let resolvedElementStyle: EditingSchemaElementStyle | undefined = normalizedElementStyle
    ? { ...normalizedElementStyle }
    : undefined;

  if (clip.source === 'element') {
    resolvedElementStyle ??= {};

    if (role === 'title' || role === 'body' || role === 'list' || role === 'label') {
      resolvedElementStyle.textAlign ??= trackType === 'subtitle' ? 'center' : 'left';
      resolvedElementStyle.textColor ??= theme.textColor;
    }

    if (role === 'background') {
      resolvedElementStyle.backgroundColor ??= theme.backgroundColor;
      resolvedElementStyle.fillColor ??= theme.backgroundColor;
    }

    if (role === 'graphic') {
      resolvedElementStyle.fillColor ??= theme.surfaceColor;
      resolvedElementStyle.accentColor ??= theme.accentColor;
      resolvedElementStyle.borderRadiusPx ??= elementPreset === 'Split Screen' ? 28 : 24;
    }

    if (role === 'accent') {
      resolvedElementStyle.fillColor ??= theme.lineColor;
      resolvedElementStyle.backgroundColor ??= theme.lineColor;
      resolvedElementStyle.borderRadiusPx ??= 999;
    }

    if (trackType === 'subtitle') {
      resolvedElementStyle.textAlign ??= 'center';
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
    subtitleOutlineWidth:
      clip.subtitleOutlineWidth === null ? null : clamp(clip.subtitleOutlineWidth, 0, 12),
    subtitleBackgroundOpacity:
      clip.subtitleBackgroundOpacity === null ? null : clamp(clip.subtitleBackgroundOpacity, 0, 1),
    subtitleFontWeight:
      clip.subtitleFontWeight === null
        ? null
        : clamp(Math.round(clip.subtitleFontWeight / 100) * 100, 100, 900),
    subtitleFontSizePx: clip.subtitleFontSizePx === null ? null : clamp(clip.subtitleFontSizePx, 10, 96),
    subtitleBorderRadiusPx:
      clip.subtitleBorderRadiusPx === null ? null : clamp(clip.subtitleBorderRadiusPx, 0, 64),
    subtitlePaddingXPx:
      clip.subtitlePaddingXPx === null ? null : clamp(clip.subtitlePaddingXPx, 0, 64),
    subtitlePaddingYPx:
      clip.subtitlePaddingYPx === null ? null : clamp(clip.subtitlePaddingYPx, 0, 64),
    elementPreset,
    content: normalizedContent,
    elementStyle: resolvedElementStyle,
  };
};

const hasTrackEdits = (schema: Pick<EditingSchema, 'tracks'>) =>
  schema.tracks.some((track) => track.clips.length > 0);

const clipHasNarrativePayload = (
  clip: Pick<EditingSchemaClip, 'content' | 'source' | 'elementPreset'>,
) => {
  if (clip.source === 'asset') {
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
  clip: Pick<EditingSchemaClip, 'previewX' | 'previewY' | 'previewWidth' | 'previewHeight' | 'content' | 'source' | 'elementPreset'>,
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
        'startFrame' | 'durationFrames' | 'previewX' | 'previewY' | 'previewWidth' | 'previewHeight' | 'content' | 'source' | 'elementPreset'
      >
    >;
  }>,
) => {
  const sceneAnchors = new Set<number>();

  tracks.forEach((track) => {
    if (track.type !== 'video') {
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

const buildSceneSpans = (durationFrames: number, count: number) => {
  const spans: Array<{ startFrame: number; durationFrames: number }> = [];
  let cursor = 0;

  for (let index = 0; index < count; index += 1) {
    const remainingScenes = count - index;
    const remainingFrames = durationFrames - cursor;
    const sceneDuration =
      index === count - 1
        ? remainingFrames
        : Math.max(Math.round(remainingFrames / remainingScenes), STARTER_SCENE_MIN_DURATION_FRAMES);

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
  textAlign?: 'left' | 'center' | 'right' | null;
}): EditingSchemaClip => ({
  name,
  startFrame,
  durationFrames,
  source: 'element',
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

const buildStoryboardScenes = (topic: string, isRussian: boolean): StoryboardScene[] => {
  if (isRussian) {
    return [
      {
        label: 'ВСТУПЛЕНИЕ',
        title: topic,
        body: 'Коротко вводим тему, обозначаем пользу и настраиваем зрителя на понятную структуру разбора.',
        list: ['Что это', 'Зачем это нужно', 'Что будет дальше'],
        narration: 'Открываем видео темой ' + topic + ', быстро объясняем контекст и обещаем понятный разбор по шагам.',
        accentPreset: 'Solid Rectangle',
        designIntent: 'Чистый стартовый кадр с сильной левой иерархией и отдельным визуальным блоком справа.',
        motionNote: 'Заголовок входит мягко снизу, текст проявляется спокойно, графика появляется аккуратным scale in.',
      },
      {
        label: 'ОСНОВА',
        title: 'Что это такое',
        body: 'Даём простое определение без перегруза терминами, чтобы зритель сразу ухватил суть.',
        list: ['Простое определение', 'Главный принцип', 'Одна ключевая мысль'],
        narration: 'Формулируем ядро темы ' + topic + ' простыми словами и закладываем основу для следующих сцен.',
        accentPreset: 'Circle Pulse',
        designIntent: 'Образовательный кадр с ясным фокусом на определении и компактной поддерживающей графикой.',
        motionNote: 'Кикер плавно появляется, основной текст заезжает очень коротко, круглый плейсхолдер появляется без резкости.',
      },
      {
        label: 'МЕХАНИКА',
        title: 'Как это работает',
        body: 'Разбиваем идею на короткие понятные шаги, чтобы объяснение читалось как последовательность.',
        list: ['Шаг 1', 'Шаг 2', 'Шаг 3'],
        narration: 'Показываем, как работает ' + topic + ', раскладывая процесс на несколько коротких и логичных частей.',
        accentPreset: 'Triangle Marker',
        designIntent: 'Структурный кадр с заголовком, описанием, списком и контрастной фигурой плейсхолдером.',
        motionNote: 'Линия делает короткий wipe, пункты списка включаются мягко, графический маркер добавляет направление взгляду.',
      },
      {
        label: 'ПРИМЕР',
        title: 'Пример на практике',
        body: 'Закрепляем идею на конкретной ситуации или сравнении, чтобы тема перестала быть абстрактной.',
        list: ['Сценарий', 'Что происходит', 'Почему это важно'],
        narration: 'Показываем ' + topic + ' на практическом примере, чтобы зритель увидел применение, а не только теорию.',
        accentPreset: 'Split Screen',
        designIntent: 'Современный кадр с ощущением демонстрации или сравнения без реальных изображений.',
        motionNote: 'Заголовок и текст входят спокойно, а правый визуальный блок собирается как аккуратная split screen композиция.',
      },
      {
        label: 'ИТОГ',
        title: 'Что запомнить',
        body: 'Фиксируем главный вывод и оставляем зрителю короткое правило, которое легко унести с собой.',
        list: ['Главная мысль', 'Типичная ошибка', 'Финальный вывод'],
        narration: 'Закрываем тему ' + topic + ', коротко повторяем главное и оставляем зрителю ясный вывод.',
        accentPreset: 'Arrow Swipe',
        designIntent: 'Финальная карточка с ощущением завершения и направляющим графическим акцентом.',
        motionNote: 'Финальный заголовок появляется уверенно, список собирается без шума, стрелочный акцент задаёт ощущение завершения сцены.',
      },
    ];
  }

  return [
    {
      label: 'INTRO',
      title: topic,
      body: 'Open with a clean framing of the topic, why it matters, and what the viewer is about to learn.',
      list: ['What it is', 'Why it matters', 'What comes next'],
      narration: 'Open with a clear framing of ' + topic + ', why it matters, and what the viewer should expect next.',
      accentPreset: 'Solid Rectangle',
      designIntent: 'Clean opening frame with a strong left text stack and a separate visual block on the right.',
      motionNote: 'The title enters with a subtle rise, supporting text fades in gently, and the graphic placeholder scales in softly.',
    },
    {
      label: 'CORE',
      title: 'What it is',
      body: 'Define the central concept in direct language before adding details, edge cases, or vocabulary.',
      list: ['Simple definition', 'Core principle', 'One line takeaway'],
      narration: 'Explain the core idea behind ' + topic + ' in plain language so the audience gets the foundation first.',
      accentPreset: 'Circle Pulse',
      designIntent: 'Educational frame that keeps the definition readable and visually focused.',
      motionNote: 'The kicker fades in first, the headline settles in quickly, and the circular placeholder appears without a jolt.',
    },
    {
      label: 'BREAKDOWN',
      title: 'How it works',
      body: 'Break the idea into a few readable beats so the explanation feels structured instead of dense.',
      list: ['Step 1', 'Step 2', 'Step 3'],
      narration: 'Walk through how ' + topic + ' works by splitting the explanation into short logical steps.',
      accentPreset: 'Triangle Marker',
      designIntent: 'Structured explainer frame with a clear title, short description, and scan friendly bullets.',
      motionNote: 'The divider wipes in briefly, bullet points appear softly, and the directional graphic guides the eye.',
    },
    {
      label: 'EXAMPLE',
      title: 'Example in practice',
      body: 'Ground the explanation in a practical scenario or comparison so the concept stops feeling abstract.',
      list: ['Scenario', 'Expected result', 'Why it matters'],
      narration: 'Show ' + topic + ' in action with an example or comparison that makes the explanation concrete.',
      accentPreset: 'Split Screen',
      designIntent: 'Modern comparison frame that suggests a demo or side by side explanation without real media.',
      motionNote: 'Headline and copy enter calmly while the visual block assembles like a clean split screen composition.',
    },
    {
      label: 'TAKEAWAY',
      title: 'What to remember',
      body: 'Close with the key conclusion and leave the viewer with one clear rule of thumb.',
      list: ['Main insight', 'Common mistake', 'Final takeaway'],
      narration: 'Wrap up ' + topic + ' by restating the main lesson and leaving the audience with a clear takeaway.',
      accentPreset: 'Arrow Swipe',
      designIntent: 'Closing card with a directional accent and a concise summary.',
      motionNote: 'The closing title lands confidently, the list resolves quickly, and the directional accent gives the frame a finished feel.',
    },
  ];
};

const createStarterMontageTracks = ({
  durationFrames,
  userMessage,
  aspectRatio,
}: {
  durationFrames: number;
  userMessage: string;
  aspectRatio: number;
}): EditingSchema['tracks'] => {
  const isRussian = prefersRussian(userMessage);
  const topic = deriveTopicTitle(userMessage);
  const scenes = buildStoryboardScenes(topic, isRussian);
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
    designIntent: isRussian ? 'Полноэкранный фон для сгенерированного видео.' : 'Full frame background for the generated video.',
    backgroundColor: theme.backgroundColor,
  });

  const buildLayerClips = (
    role: SceneRole,
    offsetFrames: number,
    makeClip: (scene: StoryboardScene, index: number, startFrame: number, durationFrames: number) => EditingSchemaClip,
  ) =>
    scenes.map((scene, index) => {
      const span = sceneSpans[index]!;
      return makeClip(scene, index, span.startFrame + offsetFrames, Math.max(span.durationFrames - offsetFrames - 6, 18));
    });

  const lineClips = buildLayerClips('accent', 12, (scene, index, startFrame, durationFrames) => {
    const layout = getDefaultRoleLayout('accent', aspectRatio, index);
    return createElementClip({
      name: 'Accent Line ' + String(index + 1),
      elementPreset: 'Line Accent',
      startFrame,
      durationFrames,
      previewX: layout.previewX,
      previewY: layout.previewY,
      previewWidth: layout.previewWidth,
      previewHeight: layout.previewHeight,
      designIntent: scene.designIntent + ' ' + scene.motionNote,
      fillColor: theme.lineColor,
      backgroundColor: theme.lineColor,
      borderRadiusPx: 999,
    });
  });

  const labelClips = buildLayerClips('label', 4, (scene, index, startFrame, durationFrames) => {
    const layout = getDefaultRoleLayout('label', aspectRatio, index);
    return createElementClip({
      name: 'Label ' + String(index + 1),
      elementPreset: 'Topic Header (H3)',
      startFrame,
      durationFrames,
      previewX: layout.previewX,
      previewY: layout.previewY,
      previewWidth: layout.previewWidth,
      previewHeight: layout.previewHeight,
      displayText: scene.label,
      designIntent: scene.designIntent + ' ' + scene.motionNote,
      textColor: theme.accentColor,
      textAlign: 'left',
    });
  });

  const titleClips = buildLayerClips('title', 8, (scene, index, startFrame, durationFrames) => {
    const layout = getDefaultRoleLayout('title', aspectRatio, index);
    return createElementClip({
      name: (index === 0 ? 'Scene Title: ' : 'Section Title: ') + scene.title,
      elementPreset: index === 0 ? 'Hero Title (H1)' : 'Section Title (H2)',
      startFrame,
      durationFrames,
      previewX: layout.previewX,
      previewY: layout.previewY,
      previewWidth: layout.previewWidth,
      previewHeight: layout.previewHeight,
      displayText: scene.title,
      designIntent: scene.designIntent + ' ' + scene.motionNote,
      textColor: theme.textColor,
      textAlign: 'left',
    });
  });

  const bodyClips = buildLayerClips('body', 16, (scene, index, startFrame, durationFrames) => {
    const layout = getDefaultRoleLayout('body', aspectRatio, index);
    return createElementClip({
      name: 'Body Copy ' + String(index + 1),
      elementPreset: 'Description',
      startFrame,
      durationFrames,
      previewX: layout.previewX,
      previewY: layout.previewY,
      previewWidth: layout.previewWidth,
      previewHeight: layout.previewHeight,
      displayText: scene.body,
      narrationText: scene.narration,
      designIntent: scene.designIntent + ' ' + scene.motionNote,
      textColor: theme.textColor,
      textAlign: 'left',
    });
  });

  const listClips = buildLayerClips('list', 22, (scene, index, startFrame, durationFrames) => {
    const layout = getDefaultRoleLayout('list', aspectRatio, index);
    return createElementClip({
      name: 'List ' + String(index + 1),
      elementPreset: 'Body Text',
      startFrame,
      durationFrames,
      previewX: layout.previewX,
      previewY: layout.previewY,
      previewWidth: layout.previewWidth,
      previewHeight: layout.previewHeight,
      displayText: scene.list.map((item) => '• ' + item).join('\n'),
      narrationText: scene.narration,
      designIntent: scene.designIntent + ' ' + scene.motionNote,
      textColor: theme.textColor,
      textAlign: 'left',
    });
  });

  const graphicClips = buildLayerClips('graphic', 14, (scene, index, startFrame, durationFrames) => {
    const layout = getDefaultRoleLayout('graphic', aspectRatio, index);
    return createElementClip({
      name: 'Graphic ' + String(index + 1),
      elementPreset: scene.accentPreset,
      startFrame,
      durationFrames,
      previewX: layout.previewX,
      previewY: layout.previewY,
      previewWidth: layout.previewWidth,
      previewHeight: layout.previewHeight,
      designIntent: scene.designIntent + ' Use geometric placeholders instead of real images. ' + scene.motionNote,
      fillColor: theme.surfaceColor,
      accentColor: theme.accentColor,
      textColor: theme.textColor,
      borderRadiusPx: scene.accentPreset === 'Split Screen' ? 28 : 24,
      textAlign: 'center',
    });
  });

  return [
    { type: 'video', index: 0, clips: [backgroundClip] },
    { type: 'video', index: 1, clips: lineClips },
    { type: 'video', index: 2, clips: labelClips },
    { type: 'video', index: 3, clips: titleClips },
    { type: 'video', index: 4, clips: bodyClips },
    { type: 'video', index: 5, clips: listClips },
    { type: 'video', index: 6, clips: graphicClips },
  ];
};

const getStarterMontageDurationFrames = (currentSequence: TimelineSequence, userMessage: string) => {
  const currentSceneCount = countNarrativeScenes(currentSequence.tracks as never);
  const currentDurationLooksTemplate =
    currentSceneCount <= 2 && currentSequence.durationFrames >= currentSequence.frameRate * 90;

  if (!currentDurationLooksTemplate) {
    return currentSequence.durationFrames;
  }

  const sceneCount = buildStoryboardScenes(deriveTopicTitle(userMessage), prefersRussian(userMessage)).length;
  const targetSeconds = clamp(Math.round(sceneCount * 4.8), 20, 42);
  return Math.max(currentSequence.frameRate * 6, currentSequence.frameRate * targetSeconds);
};

const shouldGenerateStarterMontage = ({ schema, currentSequence, userMessage }: EnsureNonEmptyEditingSchemaForIntentInput) => {
  if (!requestNeedsGeneratedCoverage(userMessage)) {
    return false;
  }

  const generatedSceneCount = countNarrativeScenes(schema.tracks);
  const currentSceneCount = countNarrativeScenes(currentSequence.tracks as never);

  if (generatedSceneCount === 0) {
    return true;
  }

  return generatedSceneCount < 3 && generatedSceneCount <= currentSceneCount + 1;
};

const getClipDisplayText = (clip: Pick<EditingSchemaClip, 'name' | 'content'>) =>
  sanitizeNullableText(clip.content?.displayText) ?? sanitizeNullableText(clip.name);

const mergeSceneAnchors = (anchors: number[]) => {
  const merged: number[] = [];

  for (const anchor of anchors) {
    const previous = merged[merged.length - 1];
    if (typeof previous === 'number' && anchor - previous <= SCENE_GROUPING_TOLERANCE_FRAMES) {
      continue;
    }

    merged.push(anchor);
  }

  return merged;
};

const describeVisual = (
  entry: { clip: EditingSchemaClip; role: SceneRole } | undefined,
  isRussian: boolean,
) => {
  if (!entry) {
    return isRussian ? 'геометрический плейсхолдер' : 'geometric placeholder';
  }

  if (entry.clip.source === 'asset') {
    return isRussian ? 'реальный медиа ассет' : 'real media asset';
  }

  if (sanitizeNullableText(entry.clip.elementPreset)) {
    return sanitizeText(entry.clip.elementPreset, isRussian ? 'геометрический плейсхолдер' : 'geometric placeholder');
  }

  return isRussian ? 'геометрический плейсхолдер' : 'geometric placeholder';
};

const buildMotionDescription = (
  hasTitle: boolean,
  hasBody: boolean,
  hasList: boolean,
  graphicEntry: { clip: EditingSchemaClip; role: SceneRole } | undefined,
  isRussian: boolean,
) => {
  const preset = sanitizeText(graphicEntry?.clip.elementPreset ?? '', '').toLowerCase();
  const hasGraphic = Boolean(graphicEntry);

  if (isRussian) {
    if (preset.includes('arrow')) {
      return 'Заголовок входит мягко, текст проявляется спокойно, графический акцент даёт короткое направленное движение.';
    }

    if (preset.includes('split')) {
      return 'Заголовок и текст входят спокойно, а визуальный блок собирается как аккуратная split screen композиция.';
    }

    if (hasGraphic && hasList) {
      return 'Заголовок появляется с лёгким подъёмом, текст и список входят мягко, графика добавляется аккуратным scale in.';
    }

    if (hasTitle || hasBody) {
      return 'Типографика появляется плавно и последовательно, без тяжёлых или хаотичных анимаций.';
    }

    return 'Сцена держится на спокойных и аккуратных входах без перегруженных переходов.';
  }

  if (preset.includes('arrow')) {
    return 'The headline enters softly, the copy fades in calmly, and the graphic accent adds a short directional motion cue.';
  }

  if (preset.includes('split')) {
    return 'Headline and copy enter calmly while the visual block assembles like a clean split screen composition.';
  }

  if (hasGraphic && hasList) {
    return 'The title rises in subtly, the copy and list fade in gently, and the graphic placeholder scales in without a jump.';
  }

  if (hasTitle || hasBody) {
    return 'Typography enters in a calm sequence with subtle motion rather than heavy animation.';
  }

  return 'The scene uses soft restrained entrances instead of noisy transitions.';
};

const collectScenePlans = (tracks: EditingSchema['tracks'], frameRate: number, userMessage: string): ScenePlanSummary[] => {
  const isRussian = prefersRussian(userMessage);
  const entries = tracks
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
    .filter((entry) => entry.trackType !== 'audio')
    .filter((entry) => entry.clip.durationFrames >= 18)
    .filter((entry) => !(entry.role === 'background' && isFullFrameBackgroundClip(entry.clip)));

  if (entries.length === 0) {
    return [];
  }

  const anchors = mergeSceneAnchors(Array.from(new Set<number>(entries.map((entry) => entry.clip.startFrame))).sort((left, right) => left - right));
  const maxEndFrame = Math.max(...entries.map((entry) => entry.clip.startFrame + entry.clip.durationFrames));

  return anchors.slice(0, 6).map((startFrame, index) => {
    const endFrame = anchors[index + 1] ?? maxEndFrame;
    const sceneEntries = entries.filter(
      (entry) => entry.clip.startFrame < endFrame && entry.clip.startFrame + entry.clip.durationFrames > startFrame,
    );

    const labelEntry = sceneEntries.find((entry) => entry.role === 'label');
    const titleEntry =
      sceneEntries.find((entry) => entry.role === 'title') ??
      sceneEntries.find((entry) => Boolean(getClipDisplayText(entry.clip)));
    const listEntry = sceneEntries.find((entry) => entry.role === 'list');
    const bodyEntry =
      sceneEntries.find((entry) => entry.role === 'body') ??
      sceneEntries.find((entry) => entry !== titleEntry && entry !== listEntry && Boolean(getClipDisplayText(entry.clip)));
    const graphicEntry = sceneEntries.find((entry) => entry.role === 'graphic');

    const title =
      getClipDisplayText(titleEntry?.clip ?? { name: '', content: undefined }) ??
      (isRussian ? 'Сцена ' + String(index + 1) : 'Scene ' + String(index + 1));

    return {
      startFrame,
      endFrame,
      label: getClipDisplayText(labelEntry?.clip ?? { name: '', content: undefined }),
      title,
      body: getClipDisplayText(bodyEntry?.clip ?? { name: '', content: undefined }),
      list: splitListItems(listEntry?.clip.content?.displayText),
      visual: describeVisual(graphicEntry, isRussian),
      motion: buildMotionDescription(Boolean(titleEntry), Boolean(bodyEntry), Boolean(listEntry), graphicEntry, isRussian),
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
    return String(minutes) + ':' + String(remainingSeconds).padStart(2, '0') + '.' + String(tenths);
  };

  return format(startFrame) + '-' + format(Math.max(endFrame - 1, startFrame));
};

const buildStoryboardAssistantMessage = ({
  assistantMessage,
  tracks,
  frameRate,
  aspectRatio,
  userMessage,
}: {
  assistantMessage: string;
  tracks: EditingSchema['tracks'];
  frameRate: number;
  aspectRatio: number;
  userMessage: string;
}) => {
  const isRussian = prefersRussian(userMessage);
  const scenePlans = collectScenePlans(tracks, frameRate, userMessage);
  const intro = sanitizeText(
    assistantMessage,
    isRussian ? 'Собрал структуру видео по запросу.' : 'Built the requested video structure.',
  );

  if (scenePlans.length === 0) {
    return intro;
  }

  const lines: string[] = [intro, ''];
  lines.push(isRussian ? '## План видео' : '## Video plan');
  lines.push((isRussian ? 'Формат: ' : 'Format: ') + getAspectRatioLabel(aspectRatio) + ', ' + getBackgroundSummary(userMessage, isRussian) + '.');
  lines.push(getCompositionSummary(aspectRatio, isRussian));

  scenePlans.forEach((scene, index) => {
    lines.push('');
    lines.push((isRussian ? '### Сцена ' : '### Scene ') + String(index + 1) + ' · ' + formatTimeRange(scene.startFrame, scene.endFrame, frameRate));
    if (scene.label) {
      lines.push((isRussian ? 'Лейбл: ' : 'Label: ') + scene.label);
    }
    lines.push((isRussian ? 'Заголовок: ' : 'Title: ') + scene.title);
    lines.push(getCompositionSummary(aspectRatio, isRussian));
    if (scene.body) {
      lines.push((isRussian ? 'Описание: ' : 'Description: ') + scene.body);
    }
    if (scene.list.length > 0) {
      lines.push((isRussian ? 'Список: ' : 'List: ') + scene.list.join(' | '));
    }
    if (scene.visual) {
      lines.push((isRussian ? 'Графика: ' : 'Visual: ') + scene.visual);
    }
    lines.push((isRussian ? 'Движение: ' : 'Motion: ') + scene.motion);
  });

  return lines.join('\n');
};

export const normalizeEditingSchema = ({ schema, currentSequence, assets, userMessage }: NormalizeEditingSchemaInput): EditingSchema => {
  const requestedDuration =
    typeof schema.durationFrames === 'number' && Number.isFinite(schema.durationFrames)
      ? Math.max(Math.round(schema.durationFrames), 1)
      : null;

  const sequenceDurationFrames = requestedDuration ?? currentSequence.durationFrames;
  const requestedAspectRatio =
    typeof schema.aspectRatio === 'number' && Number.isFinite(schema.aspectRatio) && schema.aspectRatio > 0.1
      ? schema.aspectRatio
      : inferRequestedAspectRatio(userMessage);
  const targetAspectRatio = requestedAspectRatio ?? currentSequence.aspectRatio ?? DEFAULT_VIEWPORT_ASPECT_RATIO;

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
            aspectRatio: targetAspectRatio,
          }),
        )
        .sort((left, right) => left.startFrame - right.startFrame),
    }))
    .sort((left, right) => {
      if (left.type === right.type) {
        return left.index - right.index;
      }

      const order: TimelineTrackType[] = ['video', 'audio', 'subtitle'];
      return order.indexOf(left.type) - order.indexOf(right.type);
    });

  const narrativeSceneCount = countNarrativeScenes(normalizedTracks);
  const baseAssistantMessage = sanitizeText(
    schema.assistantMessage,
    hasTrackEdits({ tracks: normalizedTracks })
      ? prefersRussian(userMessage)
        ? 'Собрал структуру видео по вашему запросу.'
        : 'Built the requested video structure.'
      : prefersRussian(userMessage)
        ? 'Пока не применил изменения к таймлайну. Уточните точную задачу: ' + sanitizeText(userMessage, 'что нужно изменить?')
        : 'No timeline edits applied yet. Clarify the exact edit goal: ' + sanitizeText(userMessage, 'what should I change first?'),
  );

  const shouldAttachStoryboardPlan = hasTrackEdits({ tracks: normalizedTracks }) && (requestNeedsGeneratedCoverage(userMessage) || narrativeSceneCount >= 3);

  return {
    ...schema,
    assistantMessage: shouldAttachStoryboardPlan
      ? buildStoryboardAssistantMessage({
          assistantMessage: baseAssistantMessage,
          tracks: normalizedTracks,
          frameRate: currentSequence.frameRate,
          aspectRatio: targetAspectRatio,
          userMessage,
        })
      : baseAssistantMessage,
    durationFrames: requestedDuration,
    aspectRatio: targetAspectRatio,
    tracks: normalizedTracks,
  };
};

export const ensureNonEmptyEditingSchemaForIntent = ({ schema, currentSequence, userMessage }: EnsureNonEmptyEditingSchemaForIntentInput): EditingSchema => {
  if (shouldGenerateStarterMontage({ schema, currentSequence, userMessage })) {
    const fallbackDurationFrames = schema.durationFrames ?? getStarterMontageDurationFrames(currentSequence, userMessage);
    const fallbackAspectRatio =
      schema.aspectRatio ?? inferRequestedAspectRatio(userMessage) ?? currentSequence.aspectRatio ?? DEFAULT_VIEWPORT_ASPECT_RATIO;
    const fallbackTracks = createStarterMontageTracks({
      durationFrames: fallbackDurationFrames,
      userMessage,
      aspectRatio: fallbackAspectRatio,
    });

    return {
      ...schema,
      durationFrames: fallbackDurationFrames,
      aspectRatio: fallbackAspectRatio,
      assistantMessage: buildStoryboardAssistantMessage({
        assistantMessage: prefersRussian(userMessage)
          ? 'Собрал полноценный сценовый план и разложил тему на понятные визуальные блоки.'
          : 'Built a fuller scene by scene draft and spread the topic across clear visual beats.',
        tracks: fallbackTracks,
        frameRate: currentSequence.frameRate,
        aspectRatio: fallbackAspectRatio,
        userMessage,
      }),
      tracks: fallbackTracks,
    };
  }

  if (hasTrackEdits(schema) || !hasExplicitEditIntent(userMessage)) {
    return schema;
  }

  return {
    ...schema,
    durationFrames: schema.durationFrames,
    assistantMessage: prefersRussian(userMessage)
      ? 'Изменения не были применены автоматически, потому что модель не вернула достаточно точную EditingSchema для этого запроса.'
      : 'No edits were applied automatically because the model did not return a precise enough EditingSchema for this request.',
    tracks: [],
  };
};