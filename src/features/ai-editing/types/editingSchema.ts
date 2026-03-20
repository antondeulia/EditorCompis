import { TimelineTrackType, TimelineTextAlign } from "@/features/timeline/types/timeline";

export type EditingClipSource = "timeline" | "asset" | "element";

export interface EditingSchemaClipContent {
  displayText?: string | null;
  narrationText?: string | null;
  designIntent?: string | null;
}

export interface EditingSchemaElementStyle {
  fillColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  strokeColor?: string | null;
  backgroundColor?: string | null;
  backgroundOpacity?: number | null;
  borderRadiusPx?: number | null;
  textAlign?: TimelineTextAlign | null;
}

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
  subtitleTextColor: string | null;
  subtitleOutlineColor: string | null;
  subtitleOutlineWidth: number | null;
  subtitleBackgroundColor: string | null;
  subtitleBackgroundOpacity: number | null;
  subtitleFontWeight: number | null;
  subtitleFontSizePx: number | null;
  subtitleBorderRadiusPx: number | null;
  subtitlePaddingXPx: number | null;
  subtitlePaddingYPx: number | null;
  elementPreset?: string | null;
  content?: EditingSchemaClipContent | null;
  elementStyle?: EditingSchemaElementStyle | null;
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

const isNullableString = (value: unknown) => value === null || typeof value === "string";
const isNullableNumber = (value: unknown) => value === null || isFiniteNumber(value);
const isTextAlign = (value: unknown): value is TimelineTextAlign =>
  value === "left" || value === "center" || value === "right";

const isClipSource = (value: unknown): value is EditingClipSource =>
  value === "timeline" || value === "asset" || value === "element";

const isTrackType = (value: unknown): value is TimelineTrackType =>
  value === "video" || value === "audio" || value === "subtitle";

const isClipContent = (value: unknown): value is EditingSchemaClipContent => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.displayText === undefined || isNullableString(value.displayText)) &&
    (value.narrationText === undefined || isNullableString(value.narrationText)) &&
    (value.designIntent === undefined || isNullableString(value.designIntent))
  );
};

const isElementStyle = (value: unknown): value is EditingSchemaElementStyle => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.fillColor === undefined || isNullableString(value.fillColor)) &&
    (value.accentColor === undefined || isNullableString(value.accentColor)) &&
    (value.textColor === undefined || isNullableString(value.textColor)) &&
    (value.strokeColor === undefined || isNullableString(value.strokeColor)) &&
    (value.backgroundColor === undefined || isNullableString(value.backgroundColor)) &&
    (value.backgroundOpacity === undefined || isNullableNumber(value.backgroundOpacity)) &&
    (value.borderRadiusPx === undefined || isNullableNumber(value.borderRadiusPx)) &&
    (value.textAlign === undefined || value.textAlign === null || isTextAlign(value.textAlign))
  );
};

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
        clip.subtitleOutlineWidth,
        clip.subtitleBackgroundOpacity,
        clip.subtitleFontWeight,
        clip.subtitleFontSizePx,
        clip.subtitleBorderRadiusPx,
        clip.subtitlePaddingXPx,
        clip.subtitlePaddingYPx,
      ];

      if (!maybeNumbers.every((candidate) => candidate === null || isFiniteNumber(candidate))) {
        return false;
      }

      if (
        !((clip.subtitleTextColor === null || typeof clip.subtitleTextColor === "string") &&
          (clip.subtitleOutlineColor === null || typeof clip.subtitleOutlineColor === "string") &&
          (clip.subtitleBackgroundColor === null || typeof clip.subtitleBackgroundColor === "string"))
      ) {
        return false;
      }

      if (
        !(clip.elementPreset === undefined || clip.elementPreset === null || typeof clip.elementPreset === "string")
      ) {
        return false;
      }

      if (!(clip.content === undefined || clip.content === null || isClipContent(clip.content))) {
        return false;
      }

      if (!(clip.elementStyle === undefined || clip.elementStyle === null || isElementStyle(clip.elementStyle))) {
        return false;
      }

      return true;
    });
  });
};

export const EDITING_SCHEMA_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["assistantMessage", "version", "durationFrames", "tracks"],
  properties: {
    assistantMessage: { type: "string", minLength: 1 },
    version: { type: "string", enum: ["1.0"] },
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
                "subtitleTextColor",
                "subtitleOutlineColor",
                "subtitleOutlineWidth",
                "subtitleBackgroundColor",
                "subtitleBackgroundOpacity",
                "subtitleFontWeight",
                "subtitleFontSizePx",
                "subtitleBorderRadiusPx",
                "subtitlePaddingXPx",
                "subtitlePaddingYPx",
                "elementPreset",
                "content",
                "elementStyle"
              ],
              properties: {
                name: { type: "string", minLength: 1 },
                startFrame: { type: "integer", minimum: 0 },
                durationFrames: { type: "integer", minimum: 1 },
                source: { type: "string", enum: ["timeline", "asset", "element"] },
                mediaUrl: {
                  anyOf: [{ type: "string" }, { type: "null" }]
                },
                previewX: {
                  anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }]
                },
                previewY: {
                  anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }]
                },
                previewWidth: {
                  anyOf: [{ type: "number", minimum: 0.08, maximum: 1 }, { type: "null" }]
                },
                previewHeight: {
                  anyOf: [{ type: "number", minimum: 0.08, maximum: 1 }, { type: "null" }]
                },
                subtitleTextColor: {
                  anyOf: [{ type: "string" }, { type: "null" }]
                },
                subtitleOutlineColor: {
                  anyOf: [{ type: "string" }, { type: "null" }]
                },
                subtitleOutlineWidth: {
                  anyOf: [{ type: "number", minimum: 0, maximum: 12 }, { type: "null" }]
                },
                subtitleBackgroundColor: {
                  anyOf: [{ type: "string" }, { type: "null" }]
                },
                subtitleBackgroundOpacity: {
                  anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }]
                },
                subtitleFontWeight: {
                  anyOf: [{ type: "number", minimum: 100, maximum: 900 }, { type: "null" }]
                },
                subtitleFontSizePx: {
                  anyOf: [{ type: "number", minimum: 10, maximum: 96 }, { type: "null" }]
                },
                subtitleBorderRadiusPx: {
                  anyOf: [{ type: "number", minimum: 0, maximum: 64 }, { type: "null" }]
                },
                subtitlePaddingXPx: {
                  anyOf: [{ type: "number", minimum: 0, maximum: 64 }, { type: "null" }]
                },
                subtitlePaddingYPx: {
                  anyOf: [{ type: "number", minimum: 0, maximum: 64 }, { type: "null" }]
                },
                elementPreset: {
                  anyOf: [{ type: "string" }, { type: "null" }]
                },
                content: {
                  anyOf: [
                    {
                      type: "object",
                      additionalProperties: false,
                      required: ["displayText", "narrationText", "designIntent"],
                      properties: {
                        displayText: {
                          anyOf: [{ type: "string" }, { type: "null" }]
                        },
                        narrationText: {
                          anyOf: [{ type: "string" }, { type: "null" }]
                        },
                        designIntent: {
                          anyOf: [{ type: "string" }, { type: "null" }]
                        }
                      }
                    },
                    { type: "null" }
                  ]
                },
                elementStyle: {
                  anyOf: [
                    {
                      type: "object",
                      additionalProperties: false,
                      required: [
                        "fillColor",
                        "accentColor",
                        "textColor",
                        "strokeColor",
                        "backgroundColor",
                        "backgroundOpacity",
                        "borderRadiusPx",
                        "textAlign"
                      ],
                      properties: {
                        fillColor: {
                          anyOf: [{ type: "string" }, { type: "null" }]
                        },
                        accentColor: {
                          anyOf: [{ type: "string" }, { type: "null" }]
                        },
                        textColor: {
                          anyOf: [{ type: "string" }, { type: "null" }]
                        },
                        strokeColor: {
                          anyOf: [{ type: "string" }, { type: "null" }]
                        },
                        backgroundColor: {
                          anyOf: [{ type: "string" }, { type: "null" }]
                        },
                        backgroundOpacity: {
                          anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }]
                        },
                        borderRadiusPx: {
                          anyOf: [{ type: "number", minimum: 0, maximum: 64 }, { type: "null" }]
                        },
                        textAlign: {
                          anyOf: [{ type: "string", enum: ["left", "center", "right"] }, { type: "null" }]
                        }
                      }
                    },
                    { type: "null" }
                  ]
                }
              }
            }
          }
        }
      }
    }
  }
};



