export interface FallbackTheme {
  backgroundPreset: string;
  backgroundColor: string;
  textColor: string;
  surfaceColor: string;
  accentColor: string;
  lineColor: string;
}

export type RequestLanguage = "ru" | "en";
export type BackgroundKind = "purple" | "light" | "dark" | "neutral";
export type RequestOrientation = "landscape" | "portrait" | "square";

export interface RequestAnalysis {
  language: RequestLanguage;
  hasExplicitEditIntent: boolean;
  needsGeneratedCoverage: boolean;
  aspectRatio: number | null;
  aspectRatioLabel: string | null;
  orientation: RequestOrientation | null;
  topic: string;
  background: BackgroundKind;
  backgroundSummary: string;
  theme: FallbackTheme;
  visualSignals: string[];
}

export const DEFAULT_VIEWPORT_ASPECT_RATIO = 16 / 9;

const ENGLISH_EDIT_INTENT_PATTERN =
  /\b(make|create|build|generate|edit|montage|video|scene|storyboard|rebuild|add|insert|subtitle|captions?|animate|animation|transition|timing|pace|layout|style|trim|cut|lesson|tutorial|guide|explainer|presentation)\b/i;
const RUSSIAN_EDIT_INTENT_PATTERN =
  /\b(сделай|сделать|создай|создать|собери|собрать|смонтируй|смонтировать|ролик|видео|сцену|сцены|субтитры|титры|анимацию|переход|тайминг|темп|монтаж|урок|гайд|объясни|презентац)\b/i;
const SMALL_TALK_ONLY_PATTERN = /^(hi|hello|hey|yo|привет|здравствуйте|добрый день)[!.,\s]*$/i;

const GENERATED_VIDEO_REQUEST_PATTERN =
  /\b(full|complete|educational|explain|explainer|lesson|tutorial|guide|overview|walkthrough|presentation|storyboard|topic|script)\b/i;
const RUSSIAN_GENERATED_VIDEO_REQUEST_PATTERN =
  /\b(полный|полноценный|обзор|объясни|объяснение|урок|гайд|презентац|сценар|структур|тему|по теме)\b/i;

const EXPLICIT_ASPECT_RATIO_PATTERN = /(?:^|[^\d])(\d{1,2})\s*(?::|x|\/)\s*(\d{1,2})(?:[^\d]|$)/i;
const SPACED_ASPECT_RATIO_PATTERN = /(?:^|[^\d])(21|16|9|4|5|1)\s+(21|16|9|4|5|1)(?:[^\d]|$)/i;
const EXPLICIT_RESOLUTION_PATTERN = /(?:^|[^\d])(\d{3,5})\s*(?:x|X|\u00D7)\s*(\d{3,5})(?:\s*px)?(?:[^\d]|$)/i;
const LABELED_SPACED_RESOLUTION_PATTERN =
  /\b(?:resolution|size|canvas|format|render|output|\u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u0438\u0435|\u0444\u043e\u0440\u043c\u0430\u0442|\u0440\u0430\u0437\u043c\u0435\u0440(?:\s+\u043a\u0430\u0434\u0440\u0430)?|\u043a\u0430\u0434\u0440)\s*(?::|=)?\s*(\d{3,5})\s+(\d{3,5})\b/i;
const VERTICAL_FORMAT_PATTERN =
  /(vertical|portrait|tiktok|reels?|shorts?|stories?|snapchat|вертикаль|вертикальный|портрет|сторис|шортс|рилс)/i;
const SQUARE_FORMAT_PATTERN = /(square|instagram post|feed post|квадрат|квадратный)/i;
const LANDSCAPE_FORMAT_PATTERN =
  /(horizontal|landscape|widescreen|youtube|горизонталь|горизонтальный|широкий формат|ютуб)/i;

const LIGHT_BACKGROUND_PATTERN = /(white background|white bg|light background|белый фон|светлый фон)/i;
const DARK_BACKGROUND_PATTERN = /(dark background|black background|темный фон|тёмный фон|черный фон|чёрный фон)/i;
const PURPLE_BACKGROUND_PATTERN = /(purple|violet|lavender|фиолет|сиренев)/i;
const CYRILLIC_PATTERN = /[А-Яа-яЁё]/;

const VISUAL_SIGNAL_MAP = [
  {
    pattern: /\b(minimal|clean|simple|calm|restrained|premium|editorial|минимал|чист|аккурат|сдержан|премиум)\b/i,
    en: "clean editorial style",
    ru: "чистый редакционный стиль",
  },
  {
    pattern: /\b(bold|dramatic|dynamic|energetic|punchy|aggressive|смел|ярк|дерз|энергич|контраст)\b/i,
    en: "bold high-contrast delivery",
    ru: "смелая контрастная подача",
  },
  {
    pattern: /\b(playful|friendly|fun|cute|soft|игрив|мягк|дружелюб|легк)\b/i,
    en: "lighter playful rhythm",
    ru: "более лёгкий и дружелюбный ритм",
  },
  {
    pattern: /\b(corporate|business|professional|saas|startup|enterprise|делов|бизнес|корпорат|профессионал)\b/i,
    en: "professional product feel",
    ru: "профессиональная продуктовая подача",
  },
  {
    pattern: /\b(cinematic|film|trailer|moody|atmospheric|киношн|кинематограф|атмосфер|трейлер)\b/i,
    en: "cinematic motion cues",
    ru: "кинематографичные motion-акценты",
  },
];

export const clamp = (value: number, min: number, max: number) => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

export const sanitizeText = (value: string | null | undefined, fallback: string) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export const sanitizeNullableText = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const prefersRussian = (userMessage: string) => CYRILLIC_PATTERN.test(userMessage);

const parseAspectRatioMatch = (match: RegExpExecArray | null) => {
  if (!match) {
    return null;
  }

  const width = Number.parseFloat(match[1] ?? "");
  const height = Number.parseFloat(match[2] ?? "");
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return width / height;
};

const greatestCommonDivisor = (left: number, right: number): number => {
  let a = Math.abs(Math.round(left));
  let b = Math.abs(Math.round(right));

  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a || 1;
};

const normalizeResolutionRatio = (width: number, height: number) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const divisor = greatestCommonDivisor(width, height);
  const reducedWidth = width / divisor;
  const reducedHeight = height / divisor;
  return reducedHeight > 0 ? reducedWidth / reducedHeight : null;
};

const parseResolutionMatch = (match: RegExpExecArray | null) => {
  if (!match) {
    return null;
  }

  const width = Number.parseInt(match[1] ?? "", 10);
  const height = Number.parseInt(match[2] ?? "", 10);
  return normalizeResolutionRatio(width, height);
};

const resolveExplicitAspectRatio = (userMessage: string) =>
  parseAspectRatioMatch(EXPLICIT_ASPECT_RATIO_PATTERN.exec(userMessage)) ??
  parseAspectRatioMatch(SPACED_ASPECT_RATIO_PATTERN.exec(userMessage));

const resolveExplicitResolutionAspectRatio = (userMessage: string) =>
  parseResolutionMatch(EXPLICIT_RESOLUTION_PATTERN.exec(userMessage)) ??
  parseResolutionMatch(LABELED_SPACED_RESOLUTION_PATTERN.exec(userMessage));

const sanitizeTopicCandidate = (value: string) =>
  value
    .replace(EXPLICIT_ASPECT_RATIO_PATTERN, " ")
    .replace(SPACED_ASPECT_RATIO_PATTERN, " ")
    .replace(EXPLICIT_RESOLUTION_PATTERN, " ")
    .replace(LABELED_SPACED_RESOLUTION_PATTERN, " ")
    .replace(
      /\b(?:vertical|portrait|horizontal|landscape|widescreen|square|youtube|tiktok|reels?|shorts?|stories?|white background|light background|dark background|black background|purple background)\b/gi,
      " ",
    )
    .replace(
      /\b(?:вертикаль|вертикальный|портрет|горизонталь|горизонтальный|квадрат|ютуб|тикток|рилс|шортс|сторис|белый фон|светлый фон|темный фон|тёмный фон|черный фон|чёрный фон|фиолетовый фон)\b/gi,
      " ",
    )
    .replace(/\b(?:видео|ролик|video|scene|scenes|format|фон|background|формат|разрешение|orientation)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,\-:;/.\\\s]+|[,\-:;/.\\\s]+$/g, "")
    .trim();

const hasExplicitEditIntent = (userMessage: string) => {
  const message = userMessage.trim();
  if (!message || SMALL_TALK_ONLY_PATTERN.test(message)) {
    return false;
  }

  return ENGLISH_EDIT_INTENT_PATTERN.test(message) || RUSSIAN_EDIT_INTENT_PATTERN.test(message);
};

const requestNeedsGeneratedCoverage = (userMessage: string) => {
  if (!hasExplicitEditIntent(userMessage)) {
    return false;
  }

  return (
    GENERATED_VIDEO_REQUEST_PATTERN.test(userMessage) ||
    RUSSIAN_GENERATED_VIDEO_REQUEST_PATTERN.test(userMessage) ||
    Boolean(resolveExplicitAspectRatio(userMessage) ?? resolveExplicitResolutionAspectRatio(userMessage)) ||
    PURPLE_BACKGROUND_PATTERN.test(userMessage)
  );
};

const inferRequestedAspectRatio = (userMessage: string): number | null => {
  const explicitAspectRatio =
    resolveExplicitAspectRatio(userMessage) ?? resolveExplicitResolutionAspectRatio(userMessage);
  if (explicitAspectRatio) {
    return explicitAspectRatio;
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

export const getOrientationFromAspectRatio = (aspectRatio: number): RequestOrientation => {
  if (aspectRatio < 0.9) {
    return "portrait";
  }

  if (aspectRatio <= 1.1) {
    return "square";
  }

  return "landscape";
};

export const getAspectRatioLabel = (aspectRatio: number) => {
  const presets = [
    { label: "16:9", value: 16 / 9 },
    { label: "9:16", value: 9 / 16 },
    { label: "1:1", value: 1 },
    { label: "4:5", value: 4 / 5 },
    { label: "21:9", value: 21 / 9 },
  ];

  const matchedPreset = presets.find((preset) => Math.abs(preset.value - aspectRatio) <= 0.02);
  if (matchedPreset) {
    return matchedPreset.label;
  }

  const width = Math.max(1, Math.round(aspectRatio * 100));
  return `${width}:100`;
};

const deriveTopicTitle = (userMessage: string) => {
  const topicalMatch =
    /(?:topic|theme|about|on|for|video about|video on|про|о|об|на тему|по теме)\s+([^.!?\n]+)/i.exec(userMessage)?.[1] ??
    null;
  if (topicalMatch?.trim()) {
    const topicFromMatch = sanitizeTopicCandidate(topicalMatch);
    if (topicFromMatch) {
      return topicFromMatch;
    }
  }

  const sanitized = userMessage.replace(/\s+/g, " ").trim();
  if (!sanitized) {
    return "Video Outline";
  }

  const prefixRemoved = sanitized.replace(
    /^(please|pls|hey|hi|hello|привет|здравствуйте|сделай|сделать|создай|создать|собери|собрать)\s+/i,
    "",
  );
  const candidate = sanitizeTopicCandidate(prefixRemoved || sanitized) || prefixRemoved || sanitized;
  return candidate.length > 72 ? `${candidate.slice(0, 69)}...` : candidate;
};

const resolveBackgroundKind = (userMessage: string): BackgroundKind => {
  if (PURPLE_BACKGROUND_PATTERN.test(userMessage)) {
    return "purple";
  }

  if (LIGHT_BACKGROUND_PATTERN.test(userMessage)) {
    return "light";
  }

  if (DARK_BACKGROUND_PATTERN.test(userMessage)) {
    return "dark";
  }

  return "neutral";
};

const getFallbackTheme = (background: BackgroundKind): FallbackTheme => {
  if (background === "purple") {
    return {
      backgroundPreset: "Solid Rectangle",
      backgroundColor: "#6D28D9",
      textColor: "#F8FAFC",
      surfaceColor: "#7C3AED",
      accentColor: "#FDE68A",
      lineColor: "#C4B5FD",
    };
  }

  if (background === "light") {
    return {
      backgroundPreset: "White Background",
      backgroundColor: "#FFFFFF",
      textColor: "#101828",
      surfaceColor: "#E8EEF9",
      accentColor: "#2563EB",
      lineColor: "#0EA5E9",
    };
  }

  if (background === "dark") {
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
    surfaceColor: "#DBEAFE",
    accentColor: "#2563EB",
    lineColor: "#60A5FA",
  };
};

const getBackgroundSummary = (background: BackgroundKind, language: RequestLanguage) => {
  if (background === "purple") {
    return language === "ru" ? "фиолетовый фон" : "purple background";
  }

  if (background === "light") {
    return language === "ru" ? "светлый фон" : "light background";
  }

  if (background === "dark") {
    return language === "ru" ? "тёмный фон" : "dark background";
  }

  return language === "ru" ? "нейтральный фон" : "neutral background";
};

const collectVisualSignals = (userMessage: string, language: RequestLanguage) =>
  VISUAL_SIGNAL_MAP.filter((entry) => entry.pattern.test(userMessage)).map((entry) =>
    language === "ru" ? entry.ru : entry.en,
  );

export const analyzeUserRequest = (userMessage: string): RequestAnalysis => {
  const language: RequestLanguage = prefersRussian(userMessage) ? "ru" : "en";
  const background = resolveBackgroundKind(userMessage);
  const aspectRatio = inferRequestedAspectRatio(userMessage);
  const orientation = aspectRatio ? getOrientationFromAspectRatio(aspectRatio) : null;

  return {
    language,
    hasExplicitEditIntent: hasExplicitEditIntent(userMessage),
    needsGeneratedCoverage: requestNeedsGeneratedCoverage(userMessage),
    aspectRatio,
    aspectRatioLabel: aspectRatio ? getAspectRatioLabel(aspectRatio) : null,
    orientation,
    topic: deriveTopicTitle(userMessage),
    background,
    backgroundSummary: getBackgroundSummary(background, language),
    theme: getFallbackTheme(background),
    visualSignals: collectVisualSignals(userMessage, language),
  };
};

