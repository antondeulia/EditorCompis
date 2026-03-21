import { EditingSchema, EditingSchemaClip } from "@/features/ai-editing/types/editingSchema";
import { TimelineSequence } from "@/features/timeline/types/timeline";

import { RequestAnalysis, clamp } from "./requestAnalysis";
import { buildSceneBlueprints, createSceneLabel } from "./contentPlanBuilder";

export type SceneRole =
  | "background"
  | "label"
  | "title"
  | "body"
  | "list"
  | "graphic"
  | "accent"
  | "subtitle";
export type SceneLayoutVariant = "split-left" | "split-right" | "stacked" | "poster" | "center-focus";

export interface StoryboardScene {
  label: string;
  title: string;
  body: string;
  list: string[];
  narration: string;
  accentPreset: string;
  designIntent: string;
  motionNote: string;
  layoutVariant: SceneLayoutVariant;
  visual: string;
}

const STARTER_SCENE_MIN_DURATION_FRAMES = 84;

export const getCompositionSummary = (aspectRatio: number, language: RequestAnalysis["language"]) => {
  if (aspectRatio < 0.85) {
    return language === "ru"
      ? "Вертикальная композиция: настоящий портретный кадр 9:16, высокий стек сверху вниз и важный контент внутри portrait safe-area без имитации горизонтального холста."
      : "Vertical composition: a true 9:16 portrait frame, tall top-to-bottom hierarchy, and important content kept inside portrait safe areas without faking a landscape canvas.";
  }

  if (aspectRatio <= 1.15) {
    return language === "ru"
      ? "Почти квадратная композиция: сильная верхняя иерархия, компактный текст и отдельная графическая зона без перегруза кадра."
      : "Near-square composition: strong top hierarchy, compact copy, and a separate graphic zone without crowding the frame.";
  }

  return language === "ru"
    ? "Широкая 16:9 композиция, которая реально использует горизонтальный кадр: широкие текстовые зоны, split-сцены и полноформатные акценты вместо узких карточек по центру."
    : "Wide 16:9 composition that genuinely uses the horizontal frame: broad text zones, split scenes, and full-width accents instead of narrow centered cards.";
};

export const getSceneLayoutVariant = (
  sceneIndex: number,
  aspectRatio: number,
): SceneLayoutVariant => {
  if (aspectRatio < 0.85) {
    return sceneIndex % 2 === 0 ? "stacked" : "center-focus";
  }

  if (aspectRatio <= 1.15) {
    return sceneIndex % 2 === 0 ? "poster" : "stacked";
  }

  const variants: SceneLayoutVariant[] = [
    "split-left",
    "stacked",
    "split-right",
    "poster",
    "split-left",
    "stacked",
  ];
  return variants[sceneIndex % variants.length] ?? "split-left";
};

const getDefaultRoleLayout = (
  role: SceneRole,
  aspectRatio: number,
  sceneIndex: number,
): { previewX: number; previewY: number; previewWidth: number; previewHeight: number } => {
  if (role === "background") {
    return { previewX: 0, previewY: 0, previewWidth: 1, previewHeight: 1 };
  }

  if (role === "subtitle") {
    return aspectRatio < 1
      ? { previewX: 0.08, previewY: 0.84, previewWidth: 0.84, previewHeight: 0.1 }
      : { previewX: 0.1, previewY: 0.82, previewWidth: 0.8, previewHeight: 0.1 };
  }

  if (aspectRatio < 0.85) {
    switch (role) {
      case "label":
        return { previewX: 0.1, previewY: 0.08, previewWidth: 0.28, previewHeight: 0.05 };
      case "title":
        return { previewX: 0.1, previewY: 0.16, previewWidth: 0.8, previewHeight: 0.13 };
      case "accent":
        return { previewX: 0.1, previewY: 0.31, previewWidth: 0.18, previewHeight: 0.012 };
      case "body":
        return { previewX: 0.1, previewY: 0.35, previewWidth: 0.8, previewHeight: 0.11 };
      case "list":
        return { previewX: 0.1, previewY: 0.5, previewWidth: 0.8, previewHeight: 0.16 };
      case "graphic":
        return sceneIndex % 2 === 0
          ? { previewX: 0.16, previewY: 0.7, previewWidth: 0.68, previewHeight: 0.18 }
          : { previewX: 0.12, previewY: 0.68, previewWidth: 0.76, previewHeight: 0.2 };
      default:
        return { previewX: 0.12, previewY: 0.22, previewWidth: 0.76, previewHeight: 0.18 };
    }
  }

  if (aspectRatio <= 1.15) {
    switch (role) {
      case "label":
        return { previewX: 0.1, previewY: 0.08, previewWidth: 0.22, previewHeight: 0.05 };
      case "title":
        return { previewX: 0.1, previewY: 0.16, previewWidth: 0.74, previewHeight: 0.14 };
      case "accent":
        return { previewX: 0.1, previewY: 0.32, previewWidth: 0.16, previewHeight: 0.012 };
      case "body":
        return { previewX: 0.1, previewY: 0.36, previewWidth: 0.74, previewHeight: 0.11 };
      case "list":
        return { previewX: 0.1, previewY: 0.52, previewWidth: 0.42, previewHeight: 0.18 };
      case "graphic":
        return { previewX: 0.56, previewY: 0.5, previewWidth: 0.28, previewHeight: 0.28 };
      default:
        return { previewX: 0.14, previewY: 0.24, previewWidth: 0.72, previewHeight: 0.18 };
    }
  }

  switch (role) {
    case "label":
      return { previewX: 0.08, previewY: 0.1, previewWidth: 0.18, previewHeight: 0.05 };
    case "title":
      return { previewX: 0.08, previewY: 0.17, previewWidth: 0.52, previewHeight: 0.15 };
    case "accent":
      return { previewX: 0.08, previewY: 0.34, previewWidth: 0.14, previewHeight: 0.012 };
    case "body":
      return { previewX: 0.08, previewY: 0.38, previewWidth: 0.42, previewHeight: 0.11 };
    case "list":
      return { previewX: 0.08, previewY: 0.54, previewWidth: 0.4, previewHeight: 0.18 };
    case "graphic":
      return sceneIndex % 2 === 0
        ? { previewX: 0.58, previewY: 0.14, previewWidth: 0.28, previewHeight: 0.6 }
        : { previewX: 0.56, previewY: 0.18, previewWidth: 0.3, previewHeight: 0.52 };
    default:
      return { previewX: 0.14, previewY: 0.24, previewWidth: 0.72, previewHeight: 0.18 };
  }
};

export const getRoleLayoutForVariant = (
  role: SceneRole,
  aspectRatio: number,
  layoutVariant: SceneLayoutVariant,
  sceneIndex = 0,
): { previewX: number; previewY: number; previewWidth: number; previewHeight: number } => {
  if (role === "background" || role === "subtitle") {
    return getDefaultRoleLayout(role, aspectRatio, sceneIndex);
  }

  if (aspectRatio < 0.85) {
    return getDefaultRoleLayout(role, aspectRatio, sceneIndex);
  }

  switch (layoutVariant) {
    case "split-right":
      switch (role) {
        case "label":
          return { previewX: 0.62, previewY: 0.1, previewWidth: 0.2, previewHeight: 0.05 };
        case "title":
          return { previewX: 0.5, previewY: 0.18, previewWidth: 0.32, previewHeight: 0.16 };
        case "accent":
          return { previewX: 0.68, previewY: 0.36, previewWidth: 0.14, previewHeight: 0.012 };
        case "body":
          return { previewX: 0.5, previewY: 0.4, previewWidth: 0.32, previewHeight: 0.11 };
        case "list":
          return { previewX: 0.5, previewY: 0.56, previewWidth: 0.3, previewHeight: 0.18 };
        case "graphic":
          return { previewX: 0.1, previewY: 0.18, previewWidth: 0.3, previewHeight: 0.58 };
        default:
          return getDefaultRoleLayout(role, aspectRatio, sceneIndex);
      }
    case "stacked":
      switch (role) {
        case "label":
          return { previewX: 0.1, previewY: 0.08, previewWidth: 0.18, previewHeight: 0.05 };
        case "title":
          return { previewX: 0.1, previewY: 0.16, previewWidth: 0.74, previewHeight: 0.14 };
        case "accent":
          return { previewX: 0.1, previewY: 0.32, previewWidth: 0.16, previewHeight: 0.012 };
        case "body":
          return { previewX: 0.1, previewY: 0.38, previewWidth: 0.74, previewHeight: 0.09 };
        case "list":
          return { previewX: 0.1, previewY: 0.5, previewWidth: 0.72, previewHeight: 0.14 };
        case "graphic":
          return { previewX: 0.2, previewY: 0.68, previewWidth: 0.6, previewHeight: 0.18 };
        default:
          return getDefaultRoleLayout(role, aspectRatio, sceneIndex);
      }
    case "poster":
      switch (role) {
        case "label":
          return { previewX: 0.12, previewY: 0.1, previewWidth: 0.24, previewHeight: 0.05 };
        case "title":
          return { previewX: 0.12, previewY: 0.2, previewWidth: 0.68, previewHeight: 0.18 };
        case "accent":
          return { previewX: 0.12, previewY: 0.4, previewWidth: 0.18, previewHeight: 0.012 };
        case "body":
          return { previewX: 0.12, previewY: 0.46, previewWidth: 0.5, previewHeight: 0.1 };
        case "list":
          return { previewX: 0.12, previewY: 0.6, previewWidth: 0.34, previewHeight: 0.14 };
        case "graphic":
          return { previewX: 0.64, previewY: 0.42, previewWidth: 0.2, previewHeight: 0.28 };
        default:
          return getDefaultRoleLayout(role, aspectRatio, sceneIndex);
      }
    case "center-focus":
      switch (role) {
        case "label":
          return { previewX: 0.34, previewY: 0.08, previewWidth: 0.32, previewHeight: 0.05 };
        case "title":
          return { previewX: 0.12, previewY: 0.18, previewWidth: 0.76, previewHeight: 0.16 };
        case "accent":
          return { previewX: 0.24, previewY: 0.36, previewWidth: 0.52, previewHeight: 0.012 };
        case "body":
          return { previewX: 0.16, previewY: 0.42, previewWidth: 0.68, previewHeight: 0.09 };
        case "list":
          return { previewX: 0.18, previewY: 0.55, previewWidth: 0.64, previewHeight: 0.14 };
        case "graphic":
          return { previewX: 0.22, previewY: 0.72, previewWidth: 0.56, previewHeight: 0.14 };
        default:
          return getDefaultRoleLayout(role, aspectRatio, sceneIndex);
      }
    case "split-left":
    default:
      return getDefaultRoleLayout(role, aspectRatio, sceneIndex);
  }
};

export const getSceneTextAlign = (layoutVariant: SceneLayoutVariant): "left" | "center" =>
  layoutVariant === "center-focus" ? "center" : "left";

export const getLayoutSummary = (
  layoutVariant: SceneLayoutVariant,
  language: RequestAnalysis["language"],
) => {
  switch (layoutVariant) {
    case "split-right":
      return language === "ru"
        ? "графика слева, текст справа"
        : "graphic on the left, text on the right";
    case "stacked":
      return language === "ru"
        ? "stacked-кадр: текст сверху, визуал ниже"
        : "stacked frame: text above, visual below";
    case "poster":
      return language === "ru"
        ? "poster-like кадр с крупным заголовком и отдельным акцентом"
        : "poster-like frame with a large headline and a separate accent";
    case "center-focus":
      return language === "ru"
        ? "широкая центрированная композиция вокруг одной ключевой идеи"
        : "wide centered composition focused on one key idea";
    case "split-left":
    default:
      return language === "ru"
        ? "текст слева, графика справа"
        : "text on the left, graphic on the right";
  }
};

export const buildStoryboardScenes = (
  analysis: RequestAnalysis,
  userMessage: string,
  aspectRatio: number,
): StoryboardScene[] =>
  buildSceneBlueprints(analysis, userMessage).map((scene, index) => ({
    label: createSceneLabel(index, analysis.language),
    layoutVariant: getSceneLayoutVariant(index, aspectRatio),
    ...scene,
  }));

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
          strokeWidthPx: null,
          backgroundColor: backgroundColor ?? null,
          backgroundOpacity: null,
          opacity: null,
          borderRadiusPx: borderRadiusPx ?? null,
          textAlign: textAlign ?? null,
          fontFamily: null,
          fontSizePx: null,
          fontWeight: null,
          lineHeight: null,
          letterSpacingEm: null,
          paddingXPx: null,
          paddingYPx: null,
        }
      : undefined,
});

export const createStarterMontageTracks = ({
  durationFrames,
  userMessage,
  aspectRatio,
  analysis,
}: {
  durationFrames: number;
  userMessage: string;
  aspectRatio: number;
  analysis: RequestAnalysis;
}): EditingSchema["tracks"] => {
  const scenes = buildStoryboardScenes(analysis, userMessage, aspectRatio);
  const sceneSpans = buildSceneSpans(durationFrames, scenes.length);
  const theme = analysis.theme;

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
    designIntent:
      analysis.language === "ru"
        ? "Полноэкранный фон, который удерживает визуальное направление сгенерированного ролика."
        : "Full-frame background that anchors the visual direction of the generated video.",
    fillColor: theme.backgroundColor,
    backgroundColor: theme.backgroundColor,
  });

  const buildLayerClips = (
    offsetFrames: number,
    makeClip: (scene: StoryboardScene, index: number, startFrame: number, durationFrames: number) => EditingSchemaClip,
  ) =>
    scenes.map((scene, index) => {
      const span = sceneSpans[index];
      if (!span) {
        throw new Error("Missing scene span for generated storyboard clip.");
      }

      return makeClip(
        scene,
        index,
        span.startFrame + offsetFrames,
        Math.max(span.durationFrames - offsetFrames - 6, 18),
      );
    });

  const lineClips = buildLayerClips(12, (scene, index, startFrame, durationFrames) => {
    const layout = getRoleLayoutForVariant("accent", aspectRatio, scene.layoutVariant, index);
    return createElementClip({
      name: `Accent Line ${index + 1}`,
      elementPreset: "Line Accent",
      startFrame,
      durationFrames,
      previewX: layout.previewX,
      previewY: layout.previewY,
      previewWidth: layout.previewWidth,
      previewHeight: layout.previewHeight,
      designIntent: `${scene.designIntent} ${scene.motionNote}`,
      fillColor: theme.lineColor,
      backgroundColor: theme.lineColor,
      borderRadiusPx: 999,
    });
  });

  const labelClips = buildLayerClips(4, (scene, index, startFrame, durationFrames) => {
    const layout = getRoleLayoutForVariant("label", aspectRatio, scene.layoutVariant, index);
    return createElementClip({
      name: `Label ${index + 1}`,
      elementPreset: "Topic Header (H3)",
      startFrame,
      durationFrames,
      previewX: layout.previewX,
      previewY: layout.previewY,
      previewWidth: layout.previewWidth,
      previewHeight: layout.previewHeight,
      displayText: scene.label,
      designIntent: `${scene.designIntent} ${scene.motionNote}`,
      textColor: theme.accentColor,
      textAlign: getSceneTextAlign(scene.layoutVariant),
    });
  });

  const titleClips = buildLayerClips(8, (scene, index, startFrame, durationFrames) => {
    const layout = getRoleLayoutForVariant("title", aspectRatio, scene.layoutVariant, index);
    return createElementClip({
      name: `${index === 0 ? "Scene Title" : "Section Title"}: ${scene.title}`,
      elementPreset: index === 0 ? "Hero Title (H1)" : "Section Title (H2)",
      startFrame,
      durationFrames,
      previewX: layout.previewX,
      previewY: layout.previewY,
      previewWidth: layout.previewWidth,
      previewHeight: layout.previewHeight,
      displayText: scene.title,
      designIntent: `${scene.designIntent} ${scene.motionNote}`,
      textColor: theme.textColor,
      backgroundColor: theme.surfaceColor,
      borderRadiusPx: 22,
      textAlign: getSceneTextAlign(scene.layoutVariant),
    });
  });

  const bodyClips = buildLayerClips(16, (scene, index, startFrame, durationFrames) => {
    const layout = getRoleLayoutForVariant("body", aspectRatio, scene.layoutVariant, index);
    return createElementClip({
      name: `Body Copy ${index + 1}`,
      elementPreset: "Description",
      startFrame,
      durationFrames,
      previewX: layout.previewX,
      previewY: layout.previewY,
      previewWidth: layout.previewWidth,
      previewHeight: layout.previewHeight,
      displayText: scene.body,
      designIntent: `${scene.designIntent} ${scene.motionNote}`,
      textColor: theme.textColor,
      backgroundColor: theme.surfaceColor,
      borderRadiusPx: 18,
      textAlign: getSceneTextAlign(scene.layoutVariant),
    });
  });

  const listClips = buildLayerClips(22, (scene, index, startFrame, durationFrames) => {
    const layout = getRoleLayoutForVariant("list", aspectRatio, scene.layoutVariant, index);
    return createElementClip({
      name: `List ${index + 1}`,
      elementPreset: "Body Text",
      startFrame,
      durationFrames,
      previewX: layout.previewX,
      previewY: layout.previewY,
      previewWidth: layout.previewWidth,
      previewHeight: layout.previewHeight,
      displayText: scene.list.map((item) => `- ${item}`).join("\n"),
      designIntent: `${scene.designIntent} ${scene.motionNote}`,
      textColor: theme.textColor,
      backgroundColor: theme.surfaceColor,
      borderRadiusPx: 18,
      textAlign: getSceneTextAlign(scene.layoutVariant),
    });
  });

  const graphicClips = buildLayerClips(14, (scene, index, startFrame, durationFrames) => {
    const layout = getRoleLayoutForVariant("graphic", aspectRatio, scene.layoutVariant, index);
    return createElementClip({
      name: `Graphic ${index + 1}`,
      elementPreset: scene.accentPreset,
      startFrame,
      durationFrames,
      previewX: layout.previewX,
      previewY: layout.previewY,
      previewWidth: layout.previewWidth,
      previewHeight: layout.previewHeight,
      displayText: scene.label,
      designIntent: `${scene.designIntent} Visual role: ${scene.visual}. Use geometric placeholders instead of real images. ${scene.motionNote}`,
      fillColor: theme.surfaceColor,
      accentColor: theme.accentColor,
      textColor: theme.textColor,
      borderRadiusPx: scene.accentPreset === "Split Screen" ? 28 : 24,
      textAlign: scene.layoutVariant === "center-focus" ? "center" : "left",
    });
  });

  return [
    { type: "video", index: 0, clips: [backgroundClip] },
    { type: "video", index: 1, clips: lineClips },
    { type: "video", index: 2, clips: labelClips },
    { type: "video", index: 3, clips: titleClips },
    { type: "video", index: 4, clips: bodyClips },
    { type: "video", index: 5, clips: listClips },
    { type: "video", index: 6, clips: graphicClips },
  ];
};

export const getStarterMontageDurationFrames = (
  currentSequence: TimelineSequence,
  userMessage: string,
  analysis: RequestAnalysis,
) => {
  const sceneCount = buildStoryboardScenes(analysis, userMessage, analysis.aspectRatio ?? 16 / 9).length;
  const targetSeconds = clamp(Math.round(sceneCount * 4.6), 24, 40);
  return Math.max(currentSequence.frameRate * 6, currentSequence.frameRate * targetSeconds);
};








