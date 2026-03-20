import { EditingSchema } from "@/features/ai-editing/types/editingSchema";
import {
  TimelineClip,
  TimelineClipContent,
  TimelineElementStyle,
  TimelineSequence,
  TimelineTrack,
  TimelineTrackType,
} from "@/features/timeline/types/timeline";

const clamp = (value: number, min: number, max: number) => {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
};

const createTrackId = (trackType: TimelineTrackType, absoluteIndex: number) => {
  const prefix = trackType === "video" ? "v" : trackType === "audio" ? "a" : "s";
  return `track-${prefix}${absoluteIndex + 1}`;
};

const createTrackName = (trackType: TimelineTrackType, indexWithinType: number) => {
  const prefix = trackType === "video" ? "V" : trackType === "audio" ? "A" : "S";
  return `${prefix}${indexWithinType + 1}`;
};

const resolveTrackIndex = (
  tracks: TimelineTrack[],
  trackType: TimelineTrackType,
  indexWithinType: number,
): number => {
  const matchingIndexes = tracks
    .map((track, index) => ({ track, index }))
    .filter((entry) => entry.track.type === trackType)
    .map((entry) => entry.index);

  if (matchingIndexes.length === 0) {
    return -1;
  }

  if (indexWithinType >= 0 && indexWithinType < matchingIndexes.length) {
    return matchingIndexes[indexWithinType] ?? -1;
  }

  return matchingIndexes[0] ?? -1;
};

const ensureTrackIndex = (
  tracks: TimelineTrack[],
  trackType: TimelineTrackType,
  requestedIndexWithinType: number,
): number => {
  const safeIndexWithinType = Math.max(Math.round(requestedIndexWithinType), 0);
  let matchingIndexes = tracks
    .map((track, index) => ({ track, index }))
    .filter((entry) => entry.track.type === trackType)
    .map((entry) => entry.index);

  while (matchingIndexes.length <= safeIndexWithinType) {
    const nextAbsoluteIndex = tracks.length;
    const nextWithinTypeIndex = matchingIndexes.length;

    tracks.push({
      id: createTrackId(trackType, nextAbsoluteIndex),
      name: createTrackName(trackType, nextWithinTypeIndex),
      type: trackType,
      clips: [],
    });

    matchingIndexes = tracks
      .map((track, index) => ({ track, index }))
      .filter((entry) => entry.track.type === trackType)
      .map((entry) => entry.index);
  }

  return resolveTrackIndex(tracks, trackType, safeIndexWithinType);
};

const normalizeContentText = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toTimelineContent = (
  clip: EditingSchema["tracks"][number]["clips"][number],
): TimelineClipContent | undefined => {
  if (!clip.content) {
    return undefined;
  }

  const content: TimelineClipContent = {
    displayText: normalizeContentText(clip.content.displayText),
    narrationText: normalizeContentText(clip.content.narrationText),
    designIntent: normalizeContentText(clip.content.designIntent),
  };

  return Object.values(content).some((value) => typeof value === "string") ? content : undefined;
};

const toTimelineElementStyle = (
  clip: EditingSchema["tracks"][number]["clips"][number],
): TimelineElementStyle | undefined => {
  if (!clip.elementStyle) {
    return undefined;
  }

  const style: TimelineElementStyle = {
    fillColor: normalizeContentText(clip.elementStyle.fillColor),
    accentColor: normalizeContentText(clip.elementStyle.accentColor),
    textColor: normalizeContentText(clip.elementStyle.textColor),
    strokeColor: normalizeContentText(clip.elementStyle.strokeColor),
    backgroundColor: normalizeContentText(clip.elementStyle.backgroundColor),
    backgroundOpacity:
      typeof clip.elementStyle.backgroundOpacity === "number"
        ? clamp(clip.elementStyle.backgroundOpacity, 0, 1)
        : undefined,
    borderRadiusPx:
      typeof clip.elementStyle.borderRadiusPx === "number"
        ? clamp(clip.elementStyle.borderRadiusPx, 0, 64)
        : undefined,
    textAlign:
      clip.elementStyle.textAlign === "left" ||
      clip.elementStyle.textAlign === "center" ||
      clip.elementStyle.textAlign === "right"
        ? clip.elementStyle.textAlign
        : undefined,
  };

  return Object.values(style).some((value) => value !== undefined) ? style : undefined;
};

const toTimelineClip = (
  trackId: string,
  trackType: TimelineTrackType,
  sequenceDurationFrames: number,
  clipIndex: number,
  clip: EditingSchema["tracks"][number]["clips"][number],
): TimelineClip | null => {
  if (!Number.isFinite(clip.startFrame) || !Number.isFinite(clip.durationFrames)) {
    return null;
  }

  const safeDuration = clamp(Math.round(clip.durationFrames), 1, sequenceDurationFrames);
  const safeStart = clamp(Math.round(clip.startFrame), 0, Math.max(sequenceDurationFrames - safeDuration, 0));

  const subtitleDefaults =
    trackType === "subtitle"
      ? {
          previewX: 0.08,
          previewY: 0.76,
          previewWidth: 0.84,
          previewHeight: 0.18,
        }
      : null;

  return {
    id: `clip-ai-${trackId}-${clipIndex}`,
    name: clip.name,
    startFrame: safeStart,
    durationFrames: safeDuration,
    source: clip.source,
    mediaUrl: clip.mediaUrl ?? undefined,
    previewX: clip.previewX ?? subtitleDefaults?.previewX ?? undefined,
    previewY: clip.previewY ?? subtitleDefaults?.previewY ?? undefined,
    previewWidth: clip.previewWidth ?? subtitleDefaults?.previewWidth ?? undefined,
    previewHeight: clip.previewHeight ?? subtitleDefaults?.previewHeight ?? undefined,
    subtitleStyle: {
      subtitleTextColor: clip.subtitleTextColor ?? undefined,
      subtitleOutlineColor: clip.subtitleOutlineColor ?? undefined,
      subtitleOutlineWidth: clip.subtitleOutlineWidth ?? undefined,
      subtitleBackgroundColor: clip.subtitleBackgroundColor ?? undefined,
      subtitleBackgroundOpacity: clip.subtitleBackgroundOpacity ?? undefined,
      subtitleFontWeight: clip.subtitleFontWeight ?? undefined,
      subtitleFontSizePx: clip.subtitleFontSizePx ?? undefined,
      subtitleBorderRadiusPx: clip.subtitleBorderRadiusPx ?? undefined,
      subtitlePaddingXPx: clip.subtitlePaddingXPx ?? undefined,
      subtitlePaddingYPx: clip.subtitlePaddingYPx ?? undefined,
    },
    elementPreset:
      typeof clip.elementPreset === "string" && clip.elementPreset.trim().length > 0
        ? clip.elementPreset.trim()
        : undefined,
    content: toTimelineContent(clip),
    elementStyle: toTimelineElementStyle(clip),
  };
};

export const applyEditingSchemaToTimeline = (
  baseSequence: TimelineSequence,
  schema: EditingSchema,
): TimelineSequence => {
  const targetDurationFrames =
    typeof schema.durationFrames === "number" && Number.isFinite(schema.durationFrames)
      ? Math.max(Math.round(schema.durationFrames), 1)
      : baseSequence.durationFrames;

  const nextTracks = baseSequence.tracks.map((track) => ({
    ...track,
    clips: [...track.clips],
  }));

  for (const plannedTrack of schema.tracks) {
    const targetTrackIndex = ensureTrackIndex(nextTracks, plannedTrack.type, plannedTrack.index);

    if (targetTrackIndex < 0) {
      continue;
    }

    const targetTrack = nextTracks[targetTrackIndex];
    if (!targetTrack) {
      continue;
    }

    const mappedClips = plannedTrack.clips
      .map((clip, clipIndex) => toTimelineClip(targetTrack.id, plannedTrack.type, targetDurationFrames, clipIndex, clip))
      .filter((clip): clip is TimelineClip => clip !== null)
      .sort((left, right) => left.startFrame - right.startFrame);

    nextTracks[targetTrackIndex] = {
      ...targetTrack,
      clips: mappedClips,
    };
  }

  return {
    ...baseSequence,
    durationFrames: targetDurationFrames,
    tracks: nextTracks,
  };
};
