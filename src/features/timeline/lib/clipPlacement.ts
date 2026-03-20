import { SidebarTimelineItem } from "@/features/timeline/lib/dragTransfer";
import { TimelineClip, TimelineTrack } from "@/features/timeline/types/timeline";

import { getPreviewDefaultsForSidebarItem } from "./previewLayout";

export const MIN_CLIP_DURATION_FRAMES = 6;

export interface SnapResult {
  offsetFrames: number;
  guideFrame: number | null;
}

export const sortClipsByStartFrame = (clips: TimelineClip[]) =>
  [...clips].sort((left, right) => left.startFrame - right.startFrame);

export const collectSnapFrames = (
  tracks: TimelineTrack[],
  sequenceDurationFrames: number,
  excludedClipIds: ReadonlySet<string>,
): number[] => {
  const frames = new Set<number>([0, sequenceDurationFrames]);

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (excludedClipIds.has(clip.id)) {
        continue;
      }

      frames.add(clip.startFrame);
      frames.add(clip.startFrame + clip.durationFrames);
    }
  }

  return Array.from(frames);
};

export const getBestSnap = (
  anchors: number[],
  candidates: number[],
  thresholdFrames: number,
): SnapResult => {
  let bestOffset: number | null = null;
  let bestGuideFrame: number | null = null;

  for (const anchor of anchors) {
    for (const candidate of candidates) {
      const offsetFrames = candidate - anchor;
      if (Math.abs(offsetFrames) > thresholdFrames) {
        continue;
      }

      if (bestOffset === null || Math.abs(offsetFrames) < Math.abs(bestOffset)) {
        bestOffset = offsetFrames;
        bestGuideFrame = candidate;
      }
    }
  }

  return {
    offsetFrames: bestOffset ?? 0,
    guideFrame: bestGuideFrame,
  };
};

export const createTimelineClipFromSidebarItem = ({
  id,
  item,
  startFrame,
  durationFrames,
}: {
  id: string;
  item: SidebarTimelineItem;
  startFrame: number;
  durationFrames: number;
}): TimelineClip => {
  const previewLayout = getPreviewDefaultsForSidebarItem(item);

  return {
    id,
    name: item.label,
    startFrame,
    durationFrames,
    source: item.source,
    mediaUrl: item.mediaUrl,
    previewX: previewLayout.previewX,
    previewY: previewLayout.previewY,
    previewWidth: previewLayout.previewWidth,
    previewHeight: previewLayout.previewHeight,
  };
};

export const insertClipIntoTrack = (
  tracks: TimelineTrack[],
  trackIndex: number,
  clip: TimelineClip,
): TimelineTrack[] =>
  tracks.map((track, currentTrackIndex) => {
    if (currentTrackIndex !== trackIndex) {
      return track;
    }

    return {
      ...track,
      clips: sortClipsByStartFrame([...track.clips, clip]),
    };
  });

export const moveClipToTrack = ({
  tracks,
  clipId,
  targetTrackIndex,
  clip,
}: {
  tracks: TimelineTrack[];
  clipId: string;
  targetTrackIndex: number;
  clip: TimelineClip;
}): TimelineTrack[] => {
  const tracksWithoutClip = tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((currentClip) => currentClip.id !== clipId),
  }));

  return insertClipIntoTrack(tracksWithoutClip, targetTrackIndex, clip);
};
