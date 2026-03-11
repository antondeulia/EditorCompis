"use client";

import { useCallback } from "react";
import { editableOverlayKinds, timelineTrackableKinds } from "../model/constants";
import { SelectedTimelineTrack } from "../model/types";
import { clamp, getElementTimelineStart, getTextMinimumHeightForWidth, getTextMinimumWidth } from "../lib/utils";
import { canAddAssetToTimeline, createElementFromAsset, getNextTimelineLane } from "../lib/asset-timeline";
import { VideoElement } from "../model/schema";
import { ensureFallbackScene } from "./editorSchemaActionUtils";
import { UseEditorSchemaActionsParams } from "./useEditorSchemaActions.types";

export function useEditorSchemaActions({
  currentFrame,
  selectedTimelineTrack,
  selectedOverlayElement,
  resolveAssetById,
  setVideoSchema,
  setSelectedElementKey,
  setSelectedTimelineTrack,
}: UseEditorSchemaActionsParams) {
  const updateElementPosition = useCallback(
    (sceneId: string, elementIndex: number, nextX: number, nextY: number) => {
      setVideoSchema((prev) => ({
        ...prev,
        scenes: prev.scenes.map((scene) => {
          if (scene.id !== sceneId) {
            return scene;
          }

          return {
            ...scene,
            elements: scene.elements.map((element, index) => {
              if (index !== elementIndex) {
                return element;
              }

              const minX = editableOverlayKinds.has(element.kind) ? -element.width : 0;
              const minY = editableOverlayKinds.has(element.kind) ? -element.height : 0;
              const maxX = editableOverlayKinds.has(element.kind) ? prev.width : Math.max(0, prev.width - element.width);
              const maxY =
                editableOverlayKinds.has(element.kind) ? prev.height : Math.max(0, prev.height - element.height);
              const boundedX = clamp(nextX, minX, maxX);
              const boundedY = clamp(nextY, minY, maxY);
              const deltaX = boundedX - element.x;
              const deltaY = boundedY - element.y;

              return {
                ...element,
                x: boundedX,
                y: boundedY,
                animations: element.animations?.map((animation) => {
                  if (animation.type !== "move") {
                    return animation;
                  }

                  return {
                    ...animation,
                    from: {
                      x: animation.from.x + deltaX,
                      y: animation.from.y + deltaY,
                    },
                    to: {
                      x: animation.to.x + deltaX,
                      y: animation.to.y + deltaY,
                    },
                  };
                }),
              };
            }),
          };
        }),
      }));
    },
    [setVideoSchema],
  );

  const updateElementBounds = useCallback(
    (
      sceneId: string,
      elementIndex: number,
      nextX: number,
      nextY: number,
      nextWidth: number,
      nextHeight: number,
    ) => {
      setVideoSchema((prev) => ({
        ...prev,
        scenes: prev.scenes.map((scene) => {
          if (scene.id !== sceneId) {
            return scene;
          }

          return {
            ...scene,
            elements: scene.elements.map((element, index) => {
              if (index !== elementIndex || !editableOverlayKinds.has(element.kind)) {
                return element;
              }

              const minWidth = element.kind === "text" ? getTextMinimumWidth(element) : 36;
              const boundedWidth = clamp(Math.round(nextWidth), minWidth, prev.width * 2);
              const minHeight = element.kind === "text" ? getTextMinimumHeightForWidth(element, boundedWidth) : 24;
              const boundedHeight = clamp(Math.round(nextHeight), minHeight, prev.height * 2);
              const minX = -boundedWidth;
              const minY = -boundedHeight;
              const maxX = prev.width;
              const maxY = prev.height;

              return {
                ...element,
                x: clamp(Math.round(nextX), minX, maxX),
                y: clamp(Math.round(nextY), minY, maxY),
                width: boundedWidth,
                height: boundedHeight,
              };
            }),
          };
        }),
      }));
    },
    [setVideoSchema],
  );

  const addTextTrack = useCallback(() => {
    let nextSelected: string | null = null;

    setVideoSchema((prev) => {
      const safeSchema = ensureFallbackScene(prev);
      const targetScene = safeSchema.scenes[0];
      const globalStart = clamp(currentFrame, 0, Math.max(0, prev.durationInFrames - 1));
      const duration = Math.max(30, Math.min(180, prev.durationInFrames - globalStart));
      const id = `text-${Date.now().toString(36)}`;

      return {
        ...safeSchema,
        scenes: safeSchema.scenes.map((scene) => {
          if (scene.id !== targetScene.id) {
            return scene;
          }
          nextSelected = `${scene.id}:${scene.elements.length}`;

          return {
            ...scene,
            elements: [
              ...scene.elements,
              {
                id,
                kind: "text",
                text: "New text",
                startFrame: 0,
                timelineStartFrame: globalStart,
                durationInFrames: duration,
                x: 120,
                y: 180,
                width: 560,
                height: 120,
                color: "#ffffff",
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1.05,
                textAlign: "left",
              },
            ],
          };
        }),
      };
    });

    if (nextSelected) {
      setSelectedElementKey(nextSelected);
    }
  }, [currentFrame, setSelectedElementKey, setVideoSchema]);

  const addShapeTrack = useCallback(
    (shape: "rect" | "circle") => {
      let nextSelected: string | null = null;

      setVideoSchema((prev) => {
        const safeSchema = ensureFallbackScene(prev);
        const targetScene = safeSchema.scenes[0];
        const globalStart = clamp(currentFrame, 0, Math.max(0, safeSchema.durationInFrames - 1));
        const duration = Math.max(30, Math.min(180, safeSchema.durationInFrames - globalStart));
        const id = `shape-${Date.now().toString(36)}`;

        return {
          ...safeSchema,
          scenes: safeSchema.scenes.map((scene) => {
            if (scene.id !== targetScene.id) {
              return scene;
            }

            nextSelected = `${scene.id}:${scene.elements.length}`;
            return {
              ...scene,
              elements: [
                ...scene.elements,
                {
                  id,
                  kind: "shape",
                  shape,
                  fill: shape === "circle" ? "rgba(59, 130, 246, 0.85)" : "rgba(139, 92, 246, 0.85)",
                  startFrame: 0,
                  timelineStartFrame: globalStart,
                  durationInFrames: duration,
                  x: shape === "circle" ? 380 : 210,
                  y: 520,
                  width: shape === "circle" ? 280 : 620,
                  height: 280,
                  borderRadius: shape === "circle" ? undefined : 22,
                },
              ],
            };
          }),
        };
      });

      if (nextSelected) {
        setSelectedElementKey(nextSelected);
      }
    },
    [currentFrame, setSelectedElementKey, setVideoSchema],
  );

  const addAssetTrack = useCallback((assetId: string, requestedStartFrame?: number, requestedLane?: number) => {
    const asset = resolveAssetById(assetId);
    if (!asset || !canAddAssetToTimeline(asset)) {
      return;
    }

    let nextSelected: SelectedTimelineTrack | null = null;

    setVideoSchema((prev) => {
      const safeSchema = ensureFallbackScene(prev);
      const targetScene = safeSchema.scenes[0];
      const startFrame = clamp(
        Math.round(requestedStartFrame ?? currentFrame),
        0,
        Math.max(0, safeSchema.durationInFrames - 1),
      );
      const lane =
        requestedLane === undefined
          ? getNextTimelineLane(safeSchema, targetScene.id)
          : Math.max(0, Math.round(requestedLane));
      const createdElement = createElementFromAsset({
        asset,
        schema: safeSchema,
        startFrame,
        lane,
      });

      if (!createdElement) {
        return prev;
      }

      return {
        ...safeSchema,
        scenes: safeSchema.scenes.map((scene) => {
          if (scene.id !== targetScene.id) {
            return scene;
          }

          const elementIndex = scene.elements.length;
          nextSelected = {
            kind: "element",
            sceneId: scene.id,
            elementIndex,
          };

          return {
            ...scene,
            elements: [...scene.elements, createdElement],
          };
        }),
      };
    });

    if (nextSelected?.kind === "element") {
      setSelectedTimelineTrack(nextSelected);
      setSelectedElementKey(`${nextSelected.sceneId}:${nextSelected.elementIndex}`);
    }
  }, [currentFrame, resolveAssetById, setSelectedElementKey, setSelectedTimelineTrack, setVideoSchema]);

  const deleteSceneTrack = useCallback((sceneId: string) => {
    setVideoSchema((prev) => {
      if (!prev.scenes.some((scene) => scene.id === sceneId)) {
        return prev;
      }

      const nextScenes = prev.scenes.filter((scene) => scene.id !== sceneId);
      return {
        ...prev,
        scenes: nextScenes,
      };
    });
    setSelectedElementKey((prev) => (prev?.startsWith(`${sceneId}:`) ? null : prev));
    setSelectedTimelineTrack((prev) => {
      if (!prev) {
        return prev;
      }

      if (prev.sceneId !== sceneId) {
        return prev;
      }

      return null;
    });
  }, [setSelectedElementKey, setSelectedTimelineTrack, setVideoSchema]);

  const deleteElementTrack = useCallback((sceneId: string, elementIndex: number) => {
    setVideoSchema((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => {
        if (scene.id !== sceneId) {
          return scene;
        }

        return {
          ...scene,
          elements: scene.elements.filter((_, index) => index !== elementIndex),
        };
      }),
    }));
    setSelectedElementKey((prev) => {
      if (!prev) {
        return prev;
      }

      const [selectedSceneId, selectedIndexToken] = prev.split(":");
      const selectedIndex = Number(selectedIndexToken);
      if (selectedSceneId !== sceneId || !Number.isInteger(selectedIndex)) {
        return prev;
      }

      if (selectedIndex === elementIndex) {
        return null;
      }

      if (selectedIndex > elementIndex) {
        return `${sceneId}:${selectedIndex - 1}`;
      }

      return prev;
    });
    setSelectedTimelineTrack((prev) => {
      if (!prev || prev.kind !== "element" || prev.sceneId !== sceneId) {
        return prev;
      }

      if (prev.elementIndex === elementIndex) {
        return null;
      }

      if (prev.elementIndex > elementIndex) {
        return {
          ...prev,
          elementIndex: prev.elementIndex - 1,
        };
      }

      return prev;
    });
  }, [setSelectedElementKey, setSelectedTimelineTrack, setVideoSchema]);

  const splitElementTrack = useCallback((sceneId: string, elementIndex: number, splitFrame: number) => {
    let nextSelected: SelectedTimelineTrack | null = null;

    setVideoSchema((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => {
        if (scene.id !== sceneId) {
          return scene;
        }

        const targetElement = scene.elements[elementIndex];
        if (!targetElement || !timelineTrackableKinds.has(targetElement.kind)) {
          return scene;
        }

        const elementStartFrame = getElementTimelineStart(scene.startFrame, targetElement);
        const elementEndFrame = elementStartFrame + Math.max(1, targetElement.durationInFrames);
        if (splitFrame <= elementStartFrame || splitFrame >= elementEndFrame) {
          return scene;
        }

        const firstDuration = splitFrame - elementStartFrame;
        const secondDuration = elementEndFrame - splitFrame;
        if (firstDuration < 1 || secondDuration < 1) {
          return scene;
        }

        const nextElements = [...scene.elements];
        const firstPart: VideoElement = {
          ...targetElement,
          durationInFrames: firstDuration,
        };
        const secondPart: VideoElement = {
          ...targetElement,
          id: `${targetElement.id}-part-${Date.now().toString(36)}`,
          timelineStartFrame: splitFrame,
          durationInFrames: secondDuration,
        };

        nextElements.splice(elementIndex, 1, firstPart, secondPart);
        nextSelected = {
          kind: "element",
          sceneId,
          elementIndex: elementIndex + 1,
        };

        return {
          ...scene,
          elements: nextElements,
        };
      }),
    }));

    if (nextSelected?.kind === "element") {
      setSelectedTimelineTrack(nextSelected);
      setSelectedElementKey(`${nextSelected.sceneId}:${nextSelected.elementIndex}`);
    }
  }, [setSelectedElementKey, setSelectedTimelineTrack, setVideoSchema]);

  const splitSelectedTimelineTrack = useCallback(() => {
    if (!selectedTimelineTrack || selectedTimelineTrack.kind !== "element") {
      return;
    }

    splitElementTrack(selectedTimelineTrack.sceneId, selectedTimelineTrack.elementIndex, currentFrame);
  }, [currentFrame, selectedTimelineTrack, splitElementTrack]);

  const deleteSelectedTimelineTrack = useCallback(() => {
    if (!selectedTimelineTrack) {
      return;
    }

    if (selectedTimelineTrack.kind === "scene") {
      deleteSceneTrack(selectedTimelineTrack.sceneId);
      return;
    }

    deleteElementTrack(selectedTimelineTrack.sceneId, selectedTimelineTrack.elementIndex);
  }, [deleteElementTrack, deleteSceneTrack, selectedTimelineTrack]);

  const clearSelectionFocus = useCallback(() => {
    setSelectedTimelineTrack(null);
    setSelectedElementKey(null);
  }, [setSelectedElementKey, setSelectedTimelineTrack]);

  const updateSelectedTextElement = useCallback(
    (updater: (element: Extract<VideoElement, { kind: "text" }>) => Extract<VideoElement, { kind: "text" }>) => {
      if (!selectedOverlayElement || selectedOverlayElement.element.kind !== "text") {
        return;
      }

      const { sceneId, elementIndex } = selectedOverlayElement;

      setVideoSchema((prev) => ({
        ...prev,
        scenes: prev.scenes.map((scene) => {
          if (scene.id !== sceneId) {
            return scene;
          }

          return {
            ...scene,
            elements: scene.elements.map((element, index) => {
              if (index !== elementIndex || element.kind !== "text") {
                return element;
              }

              return updater(element);
            }),
          };
        }),
      }));
    },
    [selectedOverlayElement, setVideoSchema],
  );

  return {
    updateElementPosition,
    updateElementBounds,
    addTextTrack,
    addShapeTrack,
    addAssetTrack,
    deleteSceneTrack,
    deleteElementTrack,
    splitElementTrack,
    splitSelectedTimelineTrack,
    deleteSelectedTimelineTrack,
    clearSelectionFocus,
    updateSelectedTextElement,
  };
}



