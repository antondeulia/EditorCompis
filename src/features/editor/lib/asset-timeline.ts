import { AssetItem } from "../model/types";
import { AudioTrack, VideoElement, VideoSchema } from "../model/schema";

type CreateElementParams = {
  asset: AssetItem;
  schema: VideoSchema;
  startFrame: number;
  lane: number;
};

function makeElementId(prefix: "image" | "video") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultMediaDuration(schema: VideoSchema, startFrame: number) {
  const maxDuration = Math.max(1, schema.durationInFrames - startFrame);
  return Math.max(30, Math.min(150, maxDuration));
}

function resolveAssetDurationInFrames(asset: AssetItem, schema: VideoSchema, startFrame: number) {
  const fromMetadata =
    typeof asset.durationInSeconds === "number" && Number.isFinite(asset.durationInSeconds)
      ? Math.round(asset.durationInSeconds * schema.fps)
      : null;
  const preferred = fromMetadata !== null ? Math.max(1, fromMetadata) : getDefaultMediaDuration(schema, startFrame);
  return Math.max(1, Math.min(preferred, schema.durationInFrames - startFrame));
}

export function canAddAssetToTimeline(asset: AssetItem) {
  return asset.kind === "video" || asset.kind === "image" || asset.kind === "audio";
}

export function createElementFromAsset({
  asset,
  schema,
  startFrame,
  lane,
}: CreateElementParams): VideoElement | null {
  if (!asset.src || !canAddAssetToTimeline(asset)) {
    return null;
  }

  if (asset.kind === "video") {
    return {
      id: makeElementId("video"),
      kind: "video",
      src: asset.src,
      assetId: asset.id,
      source: asset.source === "server" ? "user-upload" : "library",
      objectFit: "cover",
      startFrame: 0,
      timelineStartFrame: startFrame,
      timelineLane: lane,
      durationInFrames: resolveAssetDurationInFrames(asset, schema, startFrame),
      x: 0,
      y: 0,
      width: schema.width,
      height: schema.height,
    };
  }

  return {
    id: makeElementId("image"),
    kind: "image",
    src: asset.src,
    assetId: asset.id,
    source: asset.source === "server" ? "user-upload" : "library",
    objectFit: "cover",
    startFrame: 0,
    timelineStartFrame: startFrame,
    timelineLane: lane,
    durationInFrames: getDefaultMediaDuration(schema, startFrame),
    x: Math.round(schema.width * 0.08),
    y: Math.round(schema.height * 0.08),
    width: Math.round(schema.width * 0.84),
    height: Math.round(schema.height * 0.84),
    borderRadius: 20,
  };
}

export function createAudioTrackFromAsset({
  asset,
  schema,
  startFrame,
}: Omit<CreateElementParams, "lane">): AudioTrack | null {
  if (!asset.src || asset.kind !== "audio") {
    return null;
  }

  return {
    id: `audio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind: "music",
    src: asset.src,
    assetId: asset.id,
    source: asset.source === "server" ? "user-upload" : "library",
    startFrame,
    durationInFrames: resolveAssetDurationInFrames(asset, schema, startFrame),
  };
}

export function getNextTimelineLane(schema: VideoSchema, sceneId: string) {
  const scene = schema.scenes.find((item) => item.id === sceneId);
  if (!scene) {
    return 0;
  }

  return scene.elements.reduce((maxLane, element) => {
    return Math.max(maxLane, element.timelineLane ?? -1);
  }, -1) + 1;
}
