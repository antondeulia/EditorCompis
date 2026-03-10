"use client";

import { useCallback, useMemo } from "react";
import { editableOverlayKinds } from "../model/constants";
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

export function useEditorDerivedState({
  videoSchema,
  fps,
  currentFrame,
  timelineFrameSpan,
  selectedElementKey,
}: Params) {
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
        scene.elements.find((element) => !editableOverlayKinds.has(element.kind))
        ?? getScenePrimaryElement(scene);
      if (!primaryElement || editableOverlayKinds.has(primaryElement.kind)) {
        return [];
      }
      const visualKind: TrackVisualKind =
        primaryElement?.kind === "video" || primaryElement?.kind === "image"
          ? primaryElement.kind
          : primaryElement?.kind === "text"
            ? "text"
            : "shape";
      const previewSrc =
        primaryElement?.kind === "video" || primaryElement?.kind === "image" ? primaryElement.src : undefined;

      return [{
        id: scene.id,
        name: scene.name,
        lane: scene.timelineLane ?? sceneIndex,
        startFrame: scene.startFrame,
        durationInFrames: scene.durationInFrames,
        trimStartFrames: Math.max(0, scene.timelineTrimStartFrames ?? 0),
        trimEndFrames: Math.max(0, scene.timelineTrimEndFrames ?? 0),
        start: (scene.startFrame / timelineFrameSpan) * 100,
        width: (scene.durationInFrames / timelineFrameSpan) * 100,
        meta: `${(scene.durationInFrames / fps).toFixed(1)}s`,
        visualKind,
        previewSrc,
      }];
    });

    tracks.sort((a, b) => a.lane - b.lane || a.startFrame - b.startFrame || a.id.localeCompare(b.id));
    return tracks;
  }, [fps, timelineFrameSpan, videoSchema.scenes]);

  const overlayTracks = useMemo<OverlayTrack[]>(() => {
    const tracks: OverlayTrack[] = [];
    let fallbackLane = 0;

    for (const scene of videoSchema.scenes) {
      scene.elements.forEach((element, elementIndex) => {
        if (!editableOverlayKinds.has(element.kind)) {
          return;
        }

        const timelineRange = getElementEffectiveTimelineRange(
          scene.startFrame,
          scene.durationInFrames,
          element,
          undefined,
          { constrainToScene: false },
        );
        if (timelineRange.durationInFrames <= 0) {
          return;
        }

        const globalStartFrame = timelineRange.startFrame;
        const globalDuration = timelineRange.durationInFrames;
        const trimStartFrames = Math.max(0, element.timelineTrimStartFrames ?? 0);
        const trimEndFrames = Math.max(0, element.timelineTrimEndFrames ?? 0);
        tracks.push({
          sceneId: scene.id,
          sceneName: scene.name,
          elementId: element.id,
          elementIndex,
          lane: element.timelineLane ?? fallbackLane,
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
    }

    tracks.sort(
      (a, b) =>
        a.lane - b.lane
        || a.startFrame - b.startFrame
        || a.sceneId.localeCompare(b.sceneId)
        || a.elementIndex - b.elementIndex,
    );
    return tracks;
  }, [fps, timelineFrameSpan, videoSchema.scenes]);

  const activeOverlayElements = useMemo<ActiveOverlayElement[]>(() => {
    const overlays: ActiveOverlayElement[] = [];

    for (const scene of videoSchema.scenes) {
      scene.elements.forEach((element, elementIndex) => {
        if (!editableOverlayKinds.has(element.kind)) {
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
  }, [currentFrame, videoSchema.durationInFrames, videoSchema.scenes]);

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
    if (!element || !editableOverlayKinds.has(element.kind)) {
      return null;
    }

    return {
      sceneId,
      elementIndex,
      element,
    };
  }, [selectedElementKey, videoSchema.scenes]);

  const inspectorRows = useMemo<InspectorRow[]>(
    () => [
      ...videoSchema.scenes.map((scene) => ({
        id: scene.id,
        label: "<Scene>",
        meta: `${scene.name} - ${(scene.durationInFrames / fps).toFixed(1)}s`,
      })),
      ...overlayTracks.map((track) => ({
        id: `${track.sceneId}:${track.elementIndex}`,
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
