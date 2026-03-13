"use client";

import { useCallback, useMemo } from "react";
import { timelineTrackableKinds } from "../model/constants";
import { VideoElement, VideoSchema } from "../model/schema";
import { ActiveOverlayElement, OverlayTrack, TrackVisualKind } from "../model/types";
import {
  getElementEffectiveTimelineRange,
  getElementLabel,
  getScenePrimaryElement,
  getRenderedElementPosition,
  isFrameInRange,
} from "../lib/utils";
import styles from "../styles/editor.module.css";

type SelectedOverlayElement =
  | {
      sceneId: string;
      elementIndex: number;
      element: VideoElement;
    }
  | null;

type SceneTrack = {
  id: string;
  name: string;
  lane: number;
  startFrame: number;
  durationInFrames: number;
  trimStartFrames: number;
  trimEndFrames: number;
  start: number;
  width: number;
  meta: string;
  visualKind: TrackVisualKind;
  previewSrc?: string;
};

type InspectorRow = {
  id: string;
  label: string;
  meta: string;
};

type Params = {
  videoSchema: VideoSchema;
  fps: number;
  currentFrame: number;
  timelineFrameSpan: number;
  selectedElementKey: string | null;
};

function toSafeNonNegativeInt(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(value));
}

function toSafePositiveInt(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.round(value));
}

export function useEditorDerivedState({
  videoSchema,
  fps,
  currentFrame,
  timelineFrameSpan,
  selectedElementKey,
}: Params) {
  const isTimelineOverlayElement = useCallback((element: VideoElement) => {
    if (!timelineTrackableKinds.has(element.kind)) {
      return false;
    }

    if (element.kind !== "video") {
      return true;
    }

    return element.timelineStartFrame !== undefined;
  }, []);

  const getSceneClipKindClassName = useCallback((kind: TrackVisualKind) => {
    switch (kind) {
      case "text":
        return styles.sceneClipText;
      case "shape":
        return styles.sceneClipShape;
      case "audio":
        return styles.sceneClipAudio;
      default:
        return styles.sceneClipVideo;
    }
  }, []);

  const getElementClipKindClassName = useCallback((kind: TrackVisualKind) => {
    switch (kind) {
      case "text":
        return styles.elementClipText;
      case "shape":
        return styles.elementClipShape;
      case "audio":
        return styles.elementClipAudio;
      default:
        return styles.elementClipVideo;
    }
  }, []);

  const sceneTracks = useMemo<SceneTrack[]>(() => {
    const tracks = videoSchema.scenes.flatMap((scene, sceneIndex) => {
      const primaryElement =
        scene.elements.find((element) => !isTimelineOverlayElement(element))
        ?? getScenePrimaryElement(scene)
        ?? scene.elements[0];
      const visualKind: TrackVisualKind =
        primaryElement?.kind === "video" || primaryElement?.kind === "image"
          ? primaryElement.kind
          : primaryElement?.kind === "text"
            ? "text"
            : primaryElement?.kind === "shape"
              ? "shape"
              : "video";
      const previewSrc =
        primaryElement?.kind === "video" || primaryElement?.kind === "image" ? primaryElement.src : undefined;
      const lane = toSafeNonNegativeInt(scene.timelineLane, sceneIndex);
      const startFrame = toSafeNonNegativeInt(scene.startFrame, 0);
      const durationInFrames = toSafePositiveInt(scene.durationInFrames, fps);
      const trimStartFrames = toSafeNonNegativeInt(scene.timelineTrimStartFrames, 0);
      const trimEndFrames = toSafeNonNegativeInt(scene.timelineTrimEndFrames, 0);

      return [{
        id: scene.id,
        name: scene.name,
        lane,
        startFrame,
        durationInFrames,
        trimStartFrames,
        trimEndFrames,
        start: (startFrame / timelineFrameSpan) * 100,
        width: (durationInFrames / timelineFrameSpan) * 100,
        meta: [
          `${(durationInFrames / fps).toFixed(1)}s`,
          scene.transitionIn || scene.transitionOut ? "transition" : null,
          scene.cameraKeyframes?.length ? `camera:${scene.cameraKeyframes.length}` : null,
          scene.effects?.length ? `effects:${scene.effects.length}` : null,
          scene.audioTracks?.length ? `audio:${scene.audioTracks.length}` : null,
        ].filter(Boolean).join(" • "),
        visualKind,
        previewSrc,
      }];
    });

    tracks.sort((a, b) => a.lane - b.lane || a.startFrame - b.startFrame || a.id.localeCompare(b.id));
    return tracks;
  }, [fps, isTimelineOverlayElement, timelineFrameSpan, videoSchema.scenes]);

  const overlayTracks = useMemo<OverlayTrack[]>(() => {
    const tracks: OverlayTrack[] = [];
    let fallbackLane = 0;

    for (const scene of videoSchema.scenes) {
      scene.elements.forEach((element, elementIndex) => {
        if (!isTimelineOverlayElement(element)) {
          return;
        }

        const timelineRange = getElementEffectiveTimelineRange(
          scene.startFrame,
          scene.durationInFrames,
          element,
          undefined,
          { constrainToScene: false },
        );
        if (!Number.isFinite(timelineRange.startFrame) || !Number.isFinite(timelineRange.durationInFrames)) {
          return;
        }

        if (timelineRange.durationInFrames <= 0) {
          return;
        }

        const globalStartFrame = toSafeNonNegativeInt(timelineRange.startFrame, 0);
        const globalDuration = toSafePositiveInt(timelineRange.durationInFrames, fps);
        const trimStartFrames = toSafeNonNegativeInt(element.timelineTrimStartFrames, 0);
        const trimEndFrames = toSafeNonNegativeInt(element.timelineTrimEndFrames, 0);
        const lane = toSafeNonNegativeInt(element.timelineLane, fallbackLane);
        tracks.push({
          trackType: "element",
          sceneId: scene.id,
          sceneName: scene.name,
          elementId: element.id,
          elementIndex,
          lane,
          elementKind: element.kind,
          elementName: getElementLabel(element),
          startFrame: globalStartFrame,
          durationInFrames: globalDuration,
          trimStartFrames,
          trimEndFrames,
          start: (globalStartFrame / timelineFrameSpan) * 100,
          width: (globalDuration / timelineFrameSpan) * 100,
          meta: `${(globalDuration / fps).toFixed(1)}s`,
          visualKind:
            element.kind === "video" || element.kind === "image"
              ? element.kind
              : element.kind === "text"
                ? "text"
                : "shape",
          previewSrc: element.kind === "video" || element.kind === "image" ? element.src : undefined,
        });
        fallbackLane += 1;
      });

      for (const track of scene.audioTracks ?? []) {
        const startFrame = Math.max(0, scene.startFrame + track.startFrame);
        const durationInFrames = Math.max(1, track.durationInFrames);
        tracks.push({
          trackType: "audio",
          sceneId: scene.id,
          sceneName: scene.name,
          elementId: track.id,
          elementIndex: -1,
          lane: fallbackLane,
          elementKind: "audio",
          elementName: track.src.split("/").pop() ?? track.id,
          startFrame,
          durationInFrames,
          trimStartFrames: 0,
          trimEndFrames: 0,
          start: (startFrame / timelineFrameSpan) * 100,
          width: (durationInFrames / timelineFrameSpan) * 100,
          meta: `${(durationInFrames / fps).toFixed(1)}s • ${track.kind}`,
          visualKind: "audio",
          previewSrc: track.src,
          readonly: true,
        });
        fallbackLane += 1;
      }
    }

    for (const track of videoSchema.audioTracks ?? []) {
      const startFrame = toSafeNonNegativeInt(track.startFrame, 0);
      const durationInFrames = toSafePositiveInt(track.durationInFrames, fps);
      tracks.push({
        trackType: "audio",
        sceneId: "__master__",
        sceneName: "Master",
        elementId: track.id,
        elementIndex: -1,
        lane: fallbackLane,
        elementKind: "audio",
        elementName: track.src.split("/").pop() ?? track.id,
        startFrame,
        durationInFrames,
        trimStartFrames: 0,
        trimEndFrames: 0,
        start: (startFrame / timelineFrameSpan) * 100,
        width: (durationInFrames / timelineFrameSpan) * 100,
        meta: `${(durationInFrames / fps).toFixed(1)}s • ${track.kind}`,
        visualKind: "audio",
        previewSrc: track.src,
        readonly: true,
      });
      fallbackLane += 1;
    }

    tracks.sort(
      (a, b) =>
        a.lane - b.lane
        || a.startFrame - b.startFrame
        || a.sceneId.localeCompare(b.sceneId)
        || a.elementIndex - b.elementIndex,
    );
    return tracks;
  }, [fps, isTimelineOverlayElement, timelineFrameSpan, videoSchema.audioTracks, videoSchema.scenes]);

  const activeOverlayElements = useMemo<ActiveOverlayElement[]>(() => {
    const overlays: ActiveOverlayElement[] = [];

    for (const scene of videoSchema.scenes) {
      scene.elements.forEach((element, elementIndex) => {
        if (!isTimelineOverlayElement(element)) {
          return;
        }

        const timelineRange = getElementEffectiveTimelineRange(
          scene.startFrame,
          scene.durationInFrames,
          element,
          videoSchema.durationInFrames,
          { constrainToScene: false },
        );
        if (!isFrameInRange(currentFrame, timelineRange.startFrame, timelineRange.durationInFrames)) {
          return;
        }
        const localFrame = currentFrame - timelineRange.startFrame;
        const renderedPosition = getRenderedElementPosition(element, localFrame);

        overlays.push({
          sceneId: scene.id,
          sceneName: scene.name,
          elementIndex,
          renderedX: renderedPosition.x,
          renderedY: renderedPosition.y,
          element,
        });
      });
    }

    return overlays;
  }, [currentFrame, isTimelineOverlayElement, videoSchema.durationInFrames, videoSchema.scenes]);

  const selectedOverlayElement = useMemo<SelectedOverlayElement>(() => {
    if (!selectedElementKey) {
      return null;
    }

    const [sceneId, elementIndexToken] = selectedElementKey.split(":");
    const elementIndex = Number(elementIndexToken);
    if (!Number.isInteger(elementIndex)) {
      return null;
    }

    const scene = videoSchema.scenes.find((item) => item.id === sceneId);
    if (!scene) {
      return null;
    }

    const element = scene.elements[elementIndex];
    if (!element || !isTimelineOverlayElement(element)) {
      return null;
    }

    return {
      sceneId,
      elementIndex,
      element,
    };
  }, [isTimelineOverlayElement, selectedElementKey, videoSchema.scenes]);

  const inspectorRows = useMemo<InspectorRow[]>(
    () => [
      ...videoSchema.scenes.map((scene) => ({
        id: scene.id,
        label: "<Scene>",
        meta: `${scene.name} - ${(scene.durationInFrames / fps).toFixed(1)}s`,
      })),
      ...overlayTracks.map((track) => ({
        id: track.trackType === "audio" ? `${track.sceneId}:audio:${track.elementId}` : `${track.sceneId}:${track.elementIndex}`,
        label: `<${track.elementKind}>`,
        meta: `${track.sceneName} / ${track.elementName}`,
      })),
    ],
    [fps, overlayTracks, videoSchema.scenes],
  );

  return {
    sceneTracks,
    overlayTracks,
    activeOverlayElements,
    selectedOverlayElement,
    inspectorRows,
    getSceneClipKindClassName,
    getElementClipKindClassName,
  };
}
