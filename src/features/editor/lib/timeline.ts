import { SidebarTimelineItem } from "@/features/timeline/lib/dragTransfer";
import {
  MIN_CLIP_DURATION_FRAMES,
  createTimelineClipFromSidebarItem,
  insertClipIntoTrack,
} from "@/features/timeline/lib/clipPlacement";
import { TimelineSequence } from "@/features/timeline/types/timeline";

export const isTimelineSequence = (
  value: unknown,
): value is TimelineSequence => {
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
      (typedTrack.type !== "video" &&
        typedTrack.type !== "audio" &&
        typedTrack.type !== "subtitle") ||
      !Array.isArray(typedTrack.clips)
    ) {
      return false;
    }

    return typedTrack.clips.every((clip) => {
      if (!clip || typeof clip !== "object") {
        return false;
      }

      const typedClip =
        clip as Partial<TimelineSequence["tracks"][number]["clips"][number]>;
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

export const hasTimelineChanged = (
  before: TimelineSequence,
  after: TimelineSequence,
) => JSON.stringify(before) !== JSON.stringify(after);

export const appendTimelineItemToSequence = (
  sequence: TimelineSequence,
  item: SidebarTimelineItem,
): TimelineSequence | null => {
  const targetTrackIndex = sequence.tracks.findIndex(
    (track) => track.type === item.mediaType,
  );
  if (targetTrackIndex < 0) {
    return null;
  }

  const durationFrames = Math.max(
    Math.round(item.durationFrames),
    MIN_CLIP_DURATION_FRAMES,
  );
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
  const nextClip = createTimelineClipFromSidebarItem({
    id: `clip-click-${crypto.randomUUID()}`,
    item,
    startFrame,
    durationFrames: boundedDurationFrames,
  });

  return {
    ...sequence,
    tracks: insertClipIntoTrack(sequence.tracks, targetTrackIndex, nextClip),
  };
};
