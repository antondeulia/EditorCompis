import { TimelineClip, TimelineSequence, TimelineTrackType } from "@/features/timeline/types/timeline";

interface SceneEntry {
  trackType: TimelineTrackType;
  clip: TimelineClip;
  role: "background" | "title" | "body" | "graphic" | "subtitle";
}

export interface TimelineSceneSummary {
  startSeconds: number;
  endSeconds: number;
  title: string;
  text: string[];
  visuals: string[];
}

const SCENE_GROUPING_TOLERANCE_FRAMES = 18;

const sanitize = (value: string | undefined) => {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const isFullFrameBackground = (clip: TimelineClip) => {
  const previewX = clip.previewX ?? 0;
  const previewY = clip.previewY ?? 0;
  const previewWidth = clip.previewWidth ?? 0;
  const previewHeight = clip.previewHeight ?? 0;

  return (
    previewX <= 0.04 &&
    previewY <= 0.04 &&
    previewWidth >= 0.92 &&
    previewHeight >= 0.92 &&
    !sanitize(clip.content?.displayText) &&
    !sanitize(clip.content?.narrationText)
  );
};

const detectRole = (clip: TimelineClip, trackType: TimelineTrackType): SceneEntry["role"] => {
  if (trackType === "subtitle") {
    return "subtitle";
  }

  const descriptor = `${clip.name} ${clip.elementPreset ?? ""}`.toLowerCase();
  if (isFullFrameBackground(clip) || /background|backdrop/.test(descriptor)) {
    return "background";
  }

  if (/hero title|section title|topic header|title|header|heading/.test(descriptor)) {
    return "title";
  }

  if (/rectangle|circle|triangle|line accent|callout|progress|split|arrow|burst|shape|graphic/.test(descriptor)) {
    return "graphic";
  }

  return "body";
};

const mergeAnchors = (anchors: number[]) => {
  const merged: number[] = [];

  for (const anchor of anchors) {
    const previous = merged[merged.length - 1];
    if (typeof previous === "number" && anchor - previous <= SCENE_GROUPING_TOLERANCE_FRAMES) {
      continue;
    }

    merged.push(anchor);
  }

  return merged;
};

const describeClip = (clip: TimelineClip) =>
  sanitize(clip.content?.displayText) ?? sanitize(clip.elementPreset) ?? sanitize(clip.name);

export const buildSequenceSceneSummary = (sequence: TimelineSequence): TimelineSceneSummary[] => {
  const entries: SceneEntry[] = sequence.tracks
    .flatMap((track) =>
      track.clips.map((clip) => ({
        trackType: track.type,
        clip,
        role: detectRole(clip, track.type),
      })),
    )
    .filter((entry) => entry.clip.durationFrames >= 18)
    .filter((entry) => !(entry.role === "background" && isFullFrameBackground(entry.clip)));

  if (entries.length === 0) {
    return [];
  }

  const anchors = mergeAnchors(
    Array.from(new Set(entries.map((entry) => entry.clip.startFrame))).sort((left, right) => left - right),
  );
  const maxEndFrame = Math.max(...entries.map((entry) => entry.clip.startFrame + entry.clip.durationFrames));

  return anchors.slice(0, 8).map((startFrame, index) => {
    const endFrame = anchors[index + 1] ?? maxEndFrame;
    const sceneEntries = entries.filter(
      (entry) => entry.clip.startFrame < endFrame && entry.clip.startFrame + entry.clip.durationFrames > startFrame,
    );

    const titleEntry =
      sceneEntries.find((entry) => entry.role === "title") ??
      sceneEntries.find((entry) => typeof describeClip(entry.clip) === "string");

    const text = sceneEntries
      .filter((entry) => entry.role === "title" || entry.role === "body" || entry.role === "subtitle")
      .map((entry) => describeClip(entry.clip))
      .filter((value): value is string => Boolean(value))
      .slice(0, 4);

    const visuals = sceneEntries
      .filter((entry) => entry.role === "graphic")
      .map((entry) => describeClip(entry.clip))
      .filter((value): value is string => Boolean(value))
      .slice(0, 3);

    return {
      startSeconds: Number((startFrame / sequence.frameRate).toFixed(2)),
      endSeconds: Number((Math.max(endFrame - 1, startFrame) / sequence.frameRate).toFixed(2)),
      title: describeClip(titleEntry?.clip ?? { id: "", name: `Scene ${index + 1}`, startFrame: 0, durationFrames: 0 }) ?? `Scene ${index + 1}`,
      text,
      visuals,
    };
  });
};
