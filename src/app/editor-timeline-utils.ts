import { SidebarTimelineItem } from "@/features/timeline/lib/dragTransfer";
import { TimelineSequence } from "@/features/timeline/types/timeline";

const TEXT_PRESET_PATTERN = /(title|subtitle|header|text|quote|description|body|h1|h2|h3)/i;

export const isTimelineSequence = (value: unknown): value is TimelineSequence => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TimelineSequence>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.frameRate !== "number" ||
    !Number.isFinite(candidate.frameRate) ||
    candidate.frameRate <= 0 ||
    typeof candidate.durationFrames !== "number" ||
    !Number.isFinite(candidate.durationFrames) ||
    candidate.durationFrames <= 0 ||
    !Array.isArray(candidate.tracks)
  ) {
    return false;
  }

  return candidate.tracks.every((track) => {
    if (!track || typeof track !== "object") {
      return false;
    }

    const typedTrack = track as Partial<TimelineSequence["tracks"][number]>;
    if (
      typeof typedTrack.id !== "string" ||
      typeof typedTrack.name !== "string" ||
      (typedTrack.type !== "video" && typedTrack.type !== "audio" && typedTrack.type !== "subtitle") ||
      !Array.isArray(typedTrack.clips)
    ) {
      return false;
    }

    return typedTrack.clips.every((clip) => {
      if (!clip || typeof clip !== "object") {
        return false;
      }

      const typedClip = clip as Partial<TimelineSequence["tracks"][number]["clips"][number]>;
      return (
        typeof typedClip.id === "string" &&
        typeof typedClip.name === "string" &&
        typeof typedClip.startFrame === "number" &&
        Number.isFinite(typedClip.startFrame) &&
        typeof typedClip.durationFrames === "number" &&
        Number.isFinite(typedClip.durationFrames) &&
        typedClip.durationFrames > 0
      );
    });
  });
};

export const hasTimelineChanged = (before: TimelineSequence, after: TimelineSequence) =>
  JSON.stringify(before) !== JSON.stringify(after);

export const getPreviewDefaultsForItem = (item: SidebarTimelineItem) => {
  if (item.source === "asset" && item.mediaType === "video") {
    return {
      previewX: 0,
      previewY: 0,
      previewWidth: 1,
      previewHeight: 1,
    };
  }

  const loweredLabel = item.label.toLowerCase();
  if (TEXT_PRESET_PATTERN.test(loweredLabel)) {
    if (loweredLabel.includes("subtitle")) {
      return { previewX: 0.26, previewY: 0.78, previewWidth: 0.48, previewHeight: 0.11 };
    }

    if (loweredLabel.includes("h1") || loweredLabel.includes("hero")) {
      return { previewX: 0.28, previewY: 0.1, previewWidth: 0.44, previewHeight: 0.14 };
    }

    if (loweredLabel.includes("h2") || loweredLabel.includes("h3") || loweredLabel.includes("header")) {
      return { previewX: 0.3, previewY: 0.18, previewWidth: 0.4, previewHeight: 0.12 };
    }

    return { previewX: 0.28, previewY: 0.3, previewWidth: 0.44, previewHeight: 0.16 };
  }

  if (loweredLabel.includes("circle")) {
    return { previewX: 0.39, previewY: 0.32, previewWidth: 0.22, previewHeight: 0.22 };
  }

  if (loweredLabel.includes("triangle")) {
    return { previewX: 0.35, previewY: 0.36, previewWidth: 0.3, previewHeight: 0.22 };
  }

  if (loweredLabel.includes("line")) {
    return { previewX: 0.25, previewY: 0.47, previewWidth: 0.5, previewHeight: 0.07 };
  }

  return { previewX: 0.33, previewY: 0.3, previewWidth: 0.34, previewHeight: 0.2 };
};

export const appendTimelineItemToSequence = (
  sequence: TimelineSequence,
  item: SidebarTimelineItem,
): TimelineSequence | null => {
  const targetTrackIndex = sequence.tracks.findIndex((track) => track.type === item.mediaType);
  if (targetTrackIndex < 0) {
    return null;
  }

  const durationFrames = Math.max(Math.round(item.durationFrames), 6);
  const boundedDurationFrames = Math.min(durationFrames, sequence.durationFrames);
  const targetTrack = sequence.tracks[targetTrackIndex];
  const nextStartFrame = targetTrack.clips.reduce(
    (maxFrame, clip) => Math.max(maxFrame, clip.startFrame + clip.durationFrames),
    0,
  );
  const startFrame = Math.min(
    Math.max(nextStartFrame, 0),
    Math.max(sequence.durationFrames - boundedDurationFrames, 0),
  );
  const previewDefaults = getPreviewDefaultsForItem(item);

  const nextClip = {
    id: `clip-click-${crypto.randomUUID()}`,
    name: item.label,
    startFrame,
    durationFrames: boundedDurationFrames,
    source: item.source,
    mediaUrl: item.mediaUrl,
    previewX: previewDefaults.previewX,
    previewY: previewDefaults.previewY,
    previewWidth: previewDefaults.previewWidth,
    previewHeight: previewDefaults.previewHeight,
  };

  return {
    ...sequence,
    tracks: sequence.tracks.map((track, index) =>
      index !== targetTrackIndex
        ? track
        : {
            ...track,
            clips: [...track.clips, nextClip].sort((left, right) => left.startFrame - right.startFrame),
          },
    ),
  };
};
