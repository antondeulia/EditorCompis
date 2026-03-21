import { TimelineSequence } from "@/features/timeline/types/timeline";

export interface CreativeDirectionContext {
  planningSteps: string[];
  visualControls: string[];
  designPrinciples: string[];
  styleVocabulary: {
    typography: string[];
    colorAndSurface: string[];
    composition: string[];
    motion: string[];
  };
  sequenceSnapshot: {
    aspectRatio: number | null;
    durationFrames: number;
    frameRate: number;
    trackCount: number;
  };
}

const STYLE_SIGNAL_PATTERNS = {
  minimal: /\b(minimal|clean|simple|calm|restrained|premium|editorial|аккурат|минимал|чист|сдержан|премиум)\b/i,
  bold: /\b(bold|loud|dramatic|energetic|dynamic|punchy|aggressive|смел|ярк|дерз|энергич|динамич)\b/i,
  playful: /\b(playful|fun|friendly|cute|bright|soft|friendly|игрив|весел|мягк|дружелюб)\b/i,
  corporate: /\b(corporate|business|professional|saas|startup|enterprise|делов|бизнес|корпорат|профессионал)\b/i,
  cinematic: /\b(cinematic|film|trailer|moody|atmospheric|киношн|кинематограф|атмосфер|трейлер)\b/i,
};

const pickToneHints = (userMessage: string) => {
  const hints: string[] = [];

  if (STYLE_SIGNAL_PATTERNS.minimal.test(userMessage)) {
    hints.push("Lean toward restrained typography, cleaner spacing, and fewer decorative shapes.");
  }

  if (STYLE_SIGNAL_PATTERNS.bold.test(userMessage)) {
    hints.push("Allow stronger contrast, larger scale jumps, heavier weights, and more assertive composition.");
  }

  if (STYLE_SIGNAL_PATTERNS.playful.test(userMessage)) {
    hints.push("Allow softer geometry, brighter accents, and friendlier rhythm if it helps the idea.");
  }

  if (STYLE_SIGNAL_PATTERNS.corporate.test(userMessage)) {
    hints.push("Favor clarity, trust, hierarchy, and polished surfaces over novelty for novelty's sake.");
  }

  if (STYLE_SIGNAL_PATTERNS.cinematic.test(userMessage)) {
    hints.push("Let atmosphere, scale, depth, and motion cues carry more of the emotion.");
  }

  return hints;
};

export const buildCreativeDirectionContext = (
  userMessage: string,
  currentSequence: TimelineSequence,
): CreativeDirectionContext => ({
  planningSteps: [
    "Parse the user's goal, audience, platform, and emotional tone before deciding visuals.",
    "Choose an appropriate visual language for this request instead of defaulting to one composition template.",
    "Plan each scene with a clear job: setup, explanation, comparison, proof, payoff, or transition.",
    "Use typography, color, spacing, scale, shape, and motion intentionally to support meaning.",
    "Keep contrast and readability high, but do not flatten style into generic safe layouts.",
    ...pickToneHints(userMessage),
  ],
  visualControls: [
    "You may choose colors, type scale, font weight, text alignment, padding, corner radius, opacity, and layout density per scene.",
    "You may vary scene composition when the idea benefits from it: centered, asymmetrical, split, stacked, modular, poster-like, or kinetic.",
    "You may use backgrounds, cards, overlays, lines, shapes, and placeholder graphics when they improve communication or mood.",
    "You may keep scenes minimal when the message is already strong and decoration would reduce clarity.",
  ],
  designPrinciples: [
    "Different scenes can share one art direction while still having distinct visual roles.",
    "Strong hierarchy matters more than preset labels.",
    "Readable does not mean bland.",
    "Avoid accidental sameness across scenes unless repetition is clearly intentional.",
  ],
  styleVocabulary: {
    typography: [
      "fontFamily",
      "fontSizePx",
      "fontWeight",
      "lineHeight",
      "letterSpacingEm",
      "textAlign",
    ],
    colorAndSurface: [
      "textColor",
      "fillColor",
      "accentColor",
      "strokeColor",
      "strokeWidthPx",
      "backgroundColor",
      "backgroundOpacity",
      "opacity",
    ],
    composition: [
      "previewX",
      "previewY",
      "previewWidth",
      "previewHeight",
      "paddingXPx",
      "paddingYPx",
      "borderRadiusPx",
    ],
    motion: [
      "Use content.designIntent to describe entrance, rhythm, transition behavior, or emphasis intent.",
    ],
  },
  sequenceSnapshot: {
    aspectRatio: currentSequence.aspectRatio ?? null,
    durationFrames: currentSequence.durationFrames,
    frameRate: currentSequence.frameRate,
    trackCount: currentSequence.tracks.length,
  },
});

