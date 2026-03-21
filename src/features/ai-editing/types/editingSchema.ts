import { TimelineTextAlign, TimelineTrackType } from "@/features/timeline/types/timeline";

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
  strokeWidthPx?: number | null;
  backgroundColor?: string | null;
  backgroundOpacity?: number | null;
  opacity?: number | null;
  borderRadiusPx?: number | null;
  textAlign?: TimelineTextAlign | null;
  fontFamily?: string | null;
  fontSizePx?: number | null;
  fontWeight?: number | null;
  lineHeight?: number | null;
  letterSpacingEm?: number | null;
  paddingXPx?: number | null;
  paddingYPx?: number | null;
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
  aspectRatio?: number | null;
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
    (value.strokeWidthPx === undefined || isNullableNumber(value.strokeWidthPx)) &&
    (value.backgroundColor === undefined || isNullableString(value.backgroundColor)) &&
    (value.backgroundOpacity === undefined || isNullableNumber(value.backgroundOpacity)) &&
    (value.opacity === undefined || isNullableNumber(value.opacity)) &&
    (value.borderRadiusPx === undefined || isNullableNumber(value.borderRadiusPx)) &&
    (value.textAlign === undefined || value.textAlign === null || isTextAlign(value.textAlign)) &&
    (value.fontFamily === undefined || isNullableString(value.fontFamily)) &&
    (value.fontSizePx === undefined || isNullableNumber(value.fontSizePx)) &&
    (value.fontWeight === undefined || isNullableNumber(value.fontWeight)) &&
    (value.lineHeight === undefined || isNullableNumber(value.lineHeight)) &&
    (value.letterSpacingEm === undefined || isNullableNumber(value.letterSpacingEm)) &&
    (value.paddingXPx === undefined || isNullableNumber(value.paddingXPx)) &&
    (value.paddingYPx === undefined || isNullableNumber(value.paddingYPx))
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

  if (
    value.aspectRatio !== undefined &&
    value.aspectRatio !== null &&
    (!isFiniteNumber(value.aspectRatio) || value.aspectRatio <= 0.1)
  ) {
    return false;
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

const nullableStringSchema = { anyOf: [{ type: "string" }, { type: "null" }] };
const nullableNumberSchema = (minimum?: number, maximum?: number) => ({
  anyOf: [
    {
      type: "number",
      ...(typeof minimum === "number" ? { minimum } : {}),
      ...(typeof maximum === "number" ? { maximum } : {}),
    },
    { type: "null" },
  ],
});

export const EDITING_SCHEMA_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["assistantMessage", "version", "durationFrames", "aspectRatio", "tracks"],
  properties: {
    assistantMessage: { type: "string", minLength: 1 },
    version: { type: "string", enum: ["1.0"] },
    durationFrames: {
      anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
    },
    aspectRatio: {
      anyOf: [{ type: "number", exclusiveMinimum: 0.1, maximum: 10 }, { type: "null" }],
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
                mediaUrl: nullableStringSchema,
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
                subtitleTextColor: nullableStringSchema,
                subtitleOutlineColor: nullableStringSchema,
                subtitleOutlineWidth: nullableNumberSchema(0, 12),
                subtitleBackgroundColor: nullableStringSchema,
                subtitleBackgroundOpacity: nullableNumberSchema(0, 1),
                subtitleFontWeight: nullableNumberSchema(100, 900),
                subtitleFontSizePx: nullableNumberSchema(10, 160),
                subtitleBorderRadiusPx: nullableNumberSchema(0, 64),
                subtitlePaddingXPx: nullableNumberSchema(0, 64),
                subtitlePaddingYPx: nullableNumberSchema(0, 64),
                elementPreset: nullableStringSchema,
                content: {
                  anyOf: [
                    {
                      type: "object",
                      additionalProperties: false,
                      required: ["displayText", "narrationText", "designIntent"],
                      properties: {
                        displayText: nullableStringSchema,
                        narrationText: nullableStringSchema,
                        designIntent: nullableStringSchema,
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
                        "strokeWidthPx",
                        "backgroundColor",
                        "backgroundOpacity",
                        "opacity",
                        "borderRadiusPx",
                        "textAlign",
                        "fontFamily",
                        "fontSizePx",
                        "fontWeight",
                        "lineHeight",
                        "letterSpacingEm",
                        "paddingXPx",
                        "paddingYPx"
                      ],
                      properties: {
                        fillColor: nullableStringSchema,
                        accentColor: nullableStringSchema,
                        textColor: nullableStringSchema,
                        strokeColor: nullableStringSchema,
                        strokeWidthPx: nullableNumberSchema(0, 24),
                        backgroundColor: nullableStringSchema,
                        backgroundOpacity: nullableNumberSchema(0, 1),
                        opacity: nullableNumberSchema(0, 1),
                        borderRadiusPx: nullableNumberSchema(0, 128),
                        textAlign: {
                          anyOf: [{ type: "string", enum: ["left", "center", "right"] }, { type: "null" }]
                        },
                        fontFamily: nullableStringSchema,
                        fontSizePx: nullableNumberSchema(8, 240),
                        fontWeight: nullableNumberSchema(100, 900),
                        lineHeight: nullableNumberSchema(0.8, 3),
                        letterSpacingEm: nullableNumberSchema(-0.2, 0.5),
                        paddingXPx: nullableNumberSchema(0, 160),
                        paddingYPx: nullableNumberSchema(0, 160),
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

