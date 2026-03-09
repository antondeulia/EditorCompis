import { ElementAnimation, VideoElement, VideoSchema } from "../model/schema";
import { AssetItem } from "../model/types";
import { editableOverlayKinds } from "../model/constants";

let textMeasureContext: CanvasRenderingContext2D | null = null;

function getTextContext() {
  if (textMeasureContext) {
    return textMeasureContext;
  }

  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  textMeasureContext = canvas.getContext("2d");
  return textMeasureContext;
}

function measureTextWidth(ctx: CanvasRenderingContext2D, text: string, letterSpacing: number) {
  if (!text) {
    return 0;
  }

  return ctx.measureText(text).width + Math.max(0, text.length - 1) * letterSpacing;
}

export function getTextMinimumWidth(element: Extract<VideoElement, { kind: "text" }>) {
  const ctx = getTextContext();
  const fontSize = element.fontSize ?? 44;
  const fontWeight = element.fontWeight ?? 600;
  const fontFamily = element.fontFamily ?? "sans-serif";
  const letterSpacing = element.letterSpacing ?? 0;
  const padding = element.padding ?? 0;

  if (!ctx) {
    return Math.max(36, Math.round(fontSize * 1.2 + padding * 2));
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const tokens = element.text.split(/\s+/).filter(Boolean);
  const longestTokenWidth = tokens.reduce((maxWidth, token) => {
    return Math.max(maxWidth, measureTextWidth(ctx, token, letterSpacing));
  }, 0);
  const fallbackWidth = measureTextWidth(ctx, "MM", letterSpacing);

  return Math.max(36, Math.ceil(Math.max(longestTokenWidth, fallbackWidth) + padding * 2));
}

export function getTextMinimumHeightForWidth(element: Extract<VideoElement, { kind: "text" }>, width: number) {
  const ctx = getTextContext();
  const fontSize = element.fontSize ?? 44;
  const fontWeight = element.fontWeight ?? 600;
  const fontFamily = element.fontFamily ?? "sans-serif";
  const letterSpacing = element.letterSpacing ?? 0;
  const lineHeightPx = fontSize * (element.lineHeight ?? 1.2);
  const padding = element.padding ?? 0;
  const minWidth = getTextMinimumWidth(element);
  const innerWidth = Math.max(1, Math.max(width, minWidth) - padding * 2);

  if (!ctx) {
    return Math.max(24, Math.ceil(lineHeightPx + padding * 2));
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const paragraphs = element.text.split(/\r?\n/);
  const spaceWidth = measureTextWidth(ctx, " ", letterSpacing);
  let lineCount = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lineCount += 1;
      continue;
    }

    let currentLineWidth = 0;
    let paragraphLineCount = 1;
    for (const word of words) {
      const wordWidth = measureTextWidth(ctx, word, letterSpacing);
      if (currentLineWidth === 0) {
        currentLineWidth = wordWidth;
        continue;
      }

      const nextLineWidth = currentLineWidth + spaceWidth + wordWidth;
      if (nextLineWidth <= innerWidth) {
        currentLineWidth = nextLineWidth;
      } else {
        paragraphLineCount += 1;
        currentLineWidth = wordWidth;
      }
    }

    lineCount += paragraphLineCount;
  }

  return Math.max(24, Math.ceil(lineCount * lineHeightPx + padding * 2));
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "File";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00.00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function resolveAnimationEasing(name?: ElementAnimation["easing"]) {
  if (name === "ease-in-out") {
    return (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
  }

  if (name === "ease-out") {
    return (t: number) => 1 - (1 - t) ** 3;
  }

  return (t: number) => t;
}

export function getRenderedElementPosition(element: VideoElement, localFrame: number) {
  let x = element.x;
  let y = element.y;

  for (const animation of element.animations ?? []) {
    if (animation.type !== "move") {
      continue;
    }

    const durationInFrames = Math.max(1, animation.durationInFrames);
    const progress = clamp01((localFrame - animation.startFrame) / durationInFrames);
    const eased = resolveAnimationEasing(animation.easing)(progress);
    x = animation.from.x + (animation.to.x - animation.from.x) * eased;
    y = animation.from.y + (animation.to.y - animation.from.y) * eased;
  }

  return { x, y };
}

export function collectAssetsFromSchema(schema: VideoSchema): AssetItem[] {
  const assets: AssetItem[] = [];

  for (const scene of schema.scenes) {
    for (const element of scene.elements) {
      if (element.kind !== "video" && element.kind !== "image") {
        continue;
      }

      assets.push({
        id: `${scene.id}-${element.id}`,
        name: element.src.split("/").pop() ?? element.id,
        kind: element.kind,
        src: element.src,
        sizeLabel: element.kind === "video" ? "Video" : "Image",
      });
    }
  }

  return assets;
}

export function getElementLabel(element: VideoElement) {
  if (element.kind === "text") {
    return element.text.slice(0, 26) || "Text";
  }

  if (element.kind === "shape") {
    return element.shape === "circle" ? "Circle" : "Rectangle";
  }

  if (element.kind === "image") {
    return element.src.split("/").pop() ?? "Image";
  }

  return element.src.split("/").pop() ?? "Video";
}

export function getScenePrimaryElement(scene: VideoSchema["scenes"][number]) {
  return scene.elements.find((element) => element.kind === "video")
    ?? scene.elements.find((element) => element.kind === "image")
    ?? scene.elements.find((element) => element.kind === "text")
    ?? scene.elements.find((element) => element.kind === "shape")
    ?? null;
}

export function getElementTimelineStart(sceneStartFrame: number, element: VideoElement) {
  if (editableOverlayKinds.has(element.kind)) {
    return element.timelineStartFrame ?? sceneStartFrame + element.startFrame;
  }

  return sceneStartFrame + element.startFrame;
}

export function normalizeOverlayTimeline(schema: VideoSchema): VideoSchema {
  return {
    ...schema,
    scenes: schema.scenes.map((scene) => ({
      ...scene,
      elements: scene.elements.map((element) => {
        if (!editableOverlayKinds.has(element.kind) || element.timelineStartFrame !== undefined) {
          return element;
        }

        return {
          ...element,
          timelineStartFrame: scene.startFrame + element.startFrame,
        };
      }),
    })),
  };
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}



