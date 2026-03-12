"use client";

import { PointerEvent, RefObject } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { ActiveOverlayElement, CompositionViewport } from "../../model/types";
import { VideoElement, VideoSchema } from "../../model/schema";
import { VideoComposition } from "../../remotion/VideoComposition";
import { overlayResizeHandles } from "../../model/constants";
import styles from "../../styles/editor.module.css";

type PreviewStageProps = {
  playerRef: RefObject<PlayerRef | null>;
  previewCanvasRef: RefObject<HTMLDivElement | null>;
  compositionViewport: CompositionViewport;
  videoSchema: VideoSchema;
  activeOverlayElements: ActiveOverlayElement[];
  selectedElementKey: string | null;
  getElementLabel: (element: VideoElement) => string;
  onOverlayDragStart: (
    event: PointerEvent<HTMLButtonElement>,
    sceneId: string,
    elementIndex: number,
    element: VideoElement,
    renderedX: number,
    renderedY: number,
  ) => void;
  onOverlayResizeStart: (
    event: PointerEvent<HTMLElement>,
    sceneId: string,
    elementIndex: number,
    element: VideoElement,
    directionX: -1 | 0 | 1,
    directionY: -1 | 0 | 1,
  ) => void;
  onOverlaySelect: (sceneId: string, elementIndex: number, key: string) => void;
  onOverlayClearSelection: () => void;
};

export function PreviewStage({
  playerRef,
  previewCanvasRef,
  compositionViewport,
  videoSchema,
  activeOverlayElements,
  selectedElementKey,
  getElementLabel,
  onOverlayDragStart,
  onOverlayResizeStart,
  onOverlaySelect,
  onOverlayClearSelection,
}: PreviewStageProps) {
  return (
    <section className={styles.previewArea}>
      <div className={styles.previewStage}>
        <div className={styles.previewCanvas} ref={previewCanvasRef}>
          <div
            className={styles.previewViewport}
            style={{
              left: `${compositionViewport.left}px`,
              top: `${compositionViewport.top}px`,
              width: `${compositionViewport.width}px`,
              height: `${compositionViewport.height}px`,
            }}
          >
            <Player
              ref={playerRef}
              component={VideoComposition}
              inputProps={{ schema: videoSchema }}
              durationInFrames={videoSchema.durationInFrames}
              fps={videoSchema.fps}
              compositionWidth={videoSchema.width}
              compositionHeight={videoSchema.height}
              controls={false}
              loop={false}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 12,
                overflow: "hidden",
                background: "transparent",
              }}
              clickToPlay={false}
            />

            <div
              className={styles.previewOverlayLayer}
              onPointerDown={(event) => {
                if (event.target !== event.currentTarget) {
                  return;
                }

                onOverlayClearSelection();
              }}
            >
              {activeOverlayElements.map(({ sceneId, elementIndex, renderedX, renderedY, element }) => {
                const key = `${sceneId}:${elementIndex}`;
                const isSelected = selectedElementKey === key;
                const left = (renderedX / videoSchema.width) * 100;
                const top = (renderedY / videoSchema.height) * 100;
                const width = (element.width / videoSchema.width) * 100;
                const height = (element.height / videoSchema.height) * 100;
                const title = `${element.kind} / ${getElementLabel(element)}`;

                return (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.overlayHandle} ${isSelected ? styles.overlayHandleSelected : ""}`}
                    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                    data-selection-anchor="true"
                    data-overlay-item="true"
                    onPointerDown={(event) => onOverlayDragStart(event, sceneId, elementIndex, element, renderedX, renderedY)}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onOverlaySelect(sceneId, elementIndex, key);
                    }}
                    title={title}
                    aria-label={`Drag ${title}`}
                  >
                    {isSelected ? (
                      <>
                        <span className={styles.overlaySizeLabel}>
                          {Math.round(element.width)} x {Math.round(element.height)} px
                        </span>
                        {overlayResizeHandles.map((handle) => (
                          <span
                            key={`${key}-${handle.key}`}
                            className={`${styles.overlayResizeHandle} ${styles[`overlayResizeHandle${handle.key.toUpperCase()}`]}`}
                            onPointerDown={(event) =>
                              onOverlayResizeStart(event, sceneId, elementIndex, element, handle.directionX, handle.directionY)
                            }
                          />
                        ))}
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


