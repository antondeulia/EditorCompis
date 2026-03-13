import { VideoSchema } from "./schema";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonRecord | JsonValue[];
type JsonRecord = { [key: string]: JsonValue };

const TRANSITION_TYPES = new Set([
  "cut",
  "fade",
  "dissolve",
  "wipe-left",
  "wipe-right",
  "slide-left",
  "slide-right",
  "zoom-in",
  "zoom-out",
  "blur",
]);

const EASINGS = new Set(["linear", "ease-in-out", "ease-out"]);
const ELEMENT_KINDS = new Set(["text", "shape", "video", "image"]);
const PLATFORM_PRESETS = new Set([
  "youtube-16-9",
  "youtube-shorts-9-16",
  "tiktok-9-16",
  "instagram-reels-9-16",
  "instagram-feed-1-1",
  "facebook-16-9",
  "custom",
]);

function isRecord(value: JsonValue | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: JsonValue | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeFiniteNumber(value: JsonValue | undefined): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isString(value: JsonValue | undefined): value is string {
  return typeof value === "string";
}

function isEasing(value: JsonValue | undefined): boolean {
  return value === undefined || (isString(value) && EASINGS.has(value));
}

function isTransition(value: JsonValue | undefined): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.type) &&
    TRANSITION_TYPES.has(value.type) &&
    isNonNegativeFiniteNumber(value.durationInFrames) &&
    isEasing(value.easing)
  );
}

function isPoint(value: JsonValue | undefined): boolean {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isAnimation(value: JsonValue | undefined): boolean {
  if (!isRecord(value) || !isString(value.type)) {
    return false;
  }

  const hasFrameWindow =
    isNonNegativeFiniteNumber(value.startFrame) && isNonNegativeFiniteNumber(value.durationInFrames);
  if (!hasFrameWindow || !isEasing(value.easing)) {
    return false;
  }

  switch (value.type) {
    case "fade":
    case "scale":
    case "rotate":
    case "zoom-in":
    case "zoom-out":
      return isFiniteNumber(value.from) && isFiniteNumber(value.to);
    case "move":
    case "pan":
      return isPoint(value.from) && isPoint(value.to);
    default:
      return false;
  }
}

function isSceneEffect(value: JsonValue | undefined): boolean {
  if (!isRecord(value) || !isString(value.type)) {
    return false;
  }

  switch (value.type) {
    case "blur":
    case "vignette":
      return isNonNegativeFiniteNumber(value.amount);
    case "brightness":
    case "contrast":
    case "saturation":
      return isFiniteNumber(value.value);
    case "hue-rotate":
      return isFiniteNumber(value.degrees);
    default:
      return false;
  }
}

function isAudioTrack(value: JsonValue | undefined): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const validKind =
    value.kind === "voiceover" || value.kind === "music" || value.kind === "sfx";

  return (
    isString(value.id) &&
    validKind &&
    isString(value.src) &&
    (value.assetId === undefined || isString(value.assetId)) &&
    (value.source === undefined ||
      value.source === "library" ||
      value.source === "user-upload" ||
      value.source === "generated") &&
    isNonNegativeFiniteNumber(value.startFrame) &&
    isNonNegativeFiniteNumber(value.durationInFrames) &&
    (value.volume === undefined || isFiniteNumber(value.volume)) &&
    (value.fadeInFrames === undefined || isNonNegativeFiniteNumber(value.fadeInFrames)) &&
    (value.fadeOutFrames === undefined || isNonNegativeFiniteNumber(value.fadeOutFrames))
  );
}

function isCameraKeyframe(value: JsonValue | undefined): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonNegativeFiniteNumber(value.frame) &&
    (value.zoom === undefined || isFiniteNumber(value.zoom)) &&
    (value.panX === undefined || isFiniteNumber(value.panX)) &&
    (value.panY === undefined || isFiniteNumber(value.panY)) &&
    (value.rotation === undefined || isFiniteNumber(value.rotation)) &&
    isEasing(value.easing)
  );
}

function hasBaseElementShape(value: JsonValue | undefined): value is JsonRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.kind) &&
    ELEMENT_KINDS.has(value.kind) &&
    isNonNegativeFiniteNumber(value.startFrame) &&
    isNonNegativeFiniteNumber(value.durationInFrames) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isNonNegativeFiniteNumber(value.width) &&
    isNonNegativeFiniteNumber(value.height)
  );
}

function isValidElement(value: JsonValue | undefined): boolean {
  if (!hasBaseElementShape(value)) {
    return false;
  }

  const baseChecks =
    (value.animations === undefined ||
      (Array.isArray(value.animations) && value.animations.every(isAnimation))) &&
    (value.effects === undefined || (Array.isArray(value.effects) && value.effects.every(isSceneEffect))) &&
    isTransition(value.transitionIn) &&
    isTransition(value.transitionOut) &&
    (value.objectFit === undefined ||
      value.objectFit === "cover" ||
      value.objectFit === "contain" ||
      value.objectFit === "fill") &&
    (value.blendMode === undefined ||
      value.blendMode === "normal" ||
      value.blendMode === "multiply" ||
      value.blendMode === "screen" ||
      value.blendMode === "overlay" ||
      value.blendMode === "darken" ||
      value.blendMode === "lighten");

  if (!baseChecks) {
    return false;
  }

  switch (value.kind) {
    case "text":
      return isString(value.text);
    case "shape":
      return (
        (value.shape === "rect" || value.shape === "circle") &&
        isString(value.fill)
      );
    case "video":
      return (
        isString(value.src) &&
        (value.assetId === undefined || isString(value.assetId)) &&
        (value.source === undefined ||
          value.source === "library" ||
          value.source === "user-upload" ||
          value.source === "generated")
      );
    case "image":
      return (
        isString(value.src) &&
        (value.assetId === undefined || isString(value.assetId)) &&
        (value.source === undefined ||
          value.source === "library" ||
          value.source === "user-upload" ||
          value.source === "generated")
      );
    default:
      return false;
  }
}

function isValidScene(value: JsonValue | undefined): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.name) &&
    isNonNegativeFiniteNumber(value.startFrame) &&
    isNonNegativeFiniteNumber(value.durationInFrames) &&
    Array.isArray(value.elements) &&
    value.elements.every(isValidElement) &&
    isTransition(value.transitionIn) &&
    isTransition(value.transitionOut) &&
    (value.cameraKeyframes === undefined ||
      (Array.isArray(value.cameraKeyframes) && value.cameraKeyframes.every(isCameraKeyframe))) &&
    (value.effects === undefined || (Array.isArray(value.effects) && value.effects.every(isSceneEffect))) &&
    (value.audioTracks === undefined ||
      (Array.isArray(value.audioTracks) && value.audioTracks.every(isAudioTrack)))
  );
}

function isValidFormat(value: JsonValue | undefined): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.preset) &&
    PLATFORM_PRESETS.has(value.preset) &&
    isNonNegativeFiniteNumber(value.width) &&
    isNonNegativeFiniteNumber(value.height) &&
    isNonNegativeFiniteNumber(value.fps) &&
    (value.safeAreaInsets === undefined ||
      (isRecord(value.safeAreaInsets) &&
        isNonNegativeFiniteNumber(value.safeAreaInsets.top) &&
        isNonNegativeFiniteNumber(value.safeAreaInsets.right) &&
        isNonNegativeFiniteNumber(value.safeAreaInsets.bottom) &&
        isNonNegativeFiniteNumber(value.safeAreaInsets.left)))
  );
}

function isValidGlobalTransitions(value: JsonValue | undefined): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return isTransition(value.sceneDefaultIn) && isTransition(value.sceneDefaultOut);
}

export function isVideoSchema(value: JsonValue | undefined): value is VideoSchema {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    (value.version === undefined || value.version === 1) &&
    isString(value.title) &&
    isNonNegativeFiniteNumber(value.fps) &&
    isNonNegativeFiniteNumber(value.width) &&
    isNonNegativeFiniteNumber(value.height) &&
    isNonNegativeFiniteNumber(value.durationInFrames) &&
    isString(value.backgroundColor) &&
    Array.isArray(value.scenes) &&
    value.scenes.every(isValidScene) &&
    isValidFormat(value.format) &&
    isValidGlobalTransitions(value.globalTransitions) &&
    (value.audioTracks === undefined ||
      (Array.isArray(value.audioTracks) && value.audioTracks.every(isAudioTrack)))
  );
}
