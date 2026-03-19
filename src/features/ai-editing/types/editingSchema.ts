import { TimelineTrackType } from "@/features/timeline/types/timeline";

export type EditingClipSource = "timeline" | "asset" | "element";

export interface EditingSchemaClip {
  name: string;
  startFrame: number;
  durationFrames: number;
  source: EditingClipSource;
  mediaUrl: string | null;
  previewX: number | null;
  previewY: number | null;
  previewWidth: number | null;
  previewHeight: number | null;
}

export interface EditingSchemaTrack {
  type: TimelineTrackType;
  index: number;
  clips: EditingSchemaClip[];
}

export interface EditingSchema {
  version: "1.0";
  assistantMessage: string;
  durationFrames: number | null;
  tracks: EditingSchemaTrack[];
}

interface GenericRecord {
  [key: string]: unknown;
}

const isRecord = (value: unknown): value is GenericRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isClipSource = (value: unknown): value is EditingClipSource =>
  value === "timeline" || value === "asset" || value === "element";

const isTrackType = (value: unknown): value is TimelineTrackType =>
  value === "video" || value === "audio" || value === "subtitle";

export const isEditingSchema = (value: unknown): value is EditingSchema => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.version !== "1.0" || typeof value.assistantMessage !== "string") {
    return false;
  }

  if (value.durationFrames !== null) {
    if (!isFiniteNumber(value.durationFrames) || value.durationFrames <= 0) {
      return false;
    }
  }

  if (!Array.isArray(value.tracks)) {
    return false;
  }

  return value.tracks.every((track) => {
    if (!isRecord(track)) {
      return false;
    }

    if (!isTrackType(track.type) || !isFiniteNumber(track.index) || !Array.isArray(track.clips)) {
      return false;
    }

    return track.clips.every((clip) => {
      if (!isRecord(clip)) {
        return false;
      }

      if (
        typeof clip.name !== "string" ||
        !isFiniteNumber(clip.startFrame) ||
        !isFiniteNumber(clip.durationFrames) ||
        !isClipSource(clip.source)
      ) {
        return false;
      }

      if (clip.mediaUrl !== null && typeof clip.mediaUrl !== "string") {
        return false;
      }

      const maybeNumbers = [
        clip.previewX,
        clip.previewY,
        clip.previewWidth,
        clip.previewHeight,
      ];

      return maybeNumbers.every((candidate) => candidate === null || isFiniteNumber(candidate));
    });
  });
};

export const EDITING_SCHEMA_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["version", "assistantMessage", "durationFrames", "tracks"],
  properties: {
    version: { type: "string", enum: ["1.0"] },
    assistantMessage: { type: "string", minLength: 1 },
    durationFrames: {
      anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
    },
    tracks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "index", "clips"],
        properties: {
          type: { type: "string", enum: ["video", "audio", "subtitle"] },
          index: { type: "integer", minimum: 0 },
          clips: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "name",
                "startFrame",
                "durationFrames",
                "source",
                "mediaUrl",
                "previewX",
                "previewY",
                "previewWidth",
                "previewHeight",
              ],
              properties: {
                name: { type: "string", minLength: 1 },
                startFrame: { type: "integer", minimum: 0 },
                durationFrames: { type: "integer", minimum: 1 },
                source: { type: "string", enum: ["timeline", "asset", "element"] },
                mediaUrl: {
                  anyOf: [{ type: "string" }, { type: "null" }],
                },
                previewX: {
                  anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }],
                },
                previewY: {
                  anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }],
                },
                previewWidth: {
                  anyOf: [{ type: "number", minimum: 0.08, maximum: 1 }, { type: "null" }],
                },
                previewHeight: {
                  anyOf: [{ type: "number", minimum: 0.08, maximum: 1 }, { type: "null" }],
                },
              },
            },
          },
        },
      },
    },
  },
};
