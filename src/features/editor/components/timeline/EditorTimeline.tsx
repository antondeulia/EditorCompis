"use client";

import { CSSProperties, DragEvent, PointerEvent, RefObject, useState } from "react";
import { TimelineInspector } from "./TimelineInspector/TimelineInspector";
import { TrackVisual } from "./TrackVisual";
import { OverlayTrack, SelectedTimelineTrack, TrackVisualKind } from "../../model/types";
import styles from "../../styles/editor.module.css";

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

type EditorTimelineProps = {
  isInspectorCollapsed: boolean;
  boundedInspectorWidth: number;
  currentTimeLabel: string;
  isInspectorResizing: boolean;
  onInspectorResizeStart: (event: PointerEvent<HTMLButtonElement>) => void;
  inspectorRows: InspectorRow[];
  timelineMainRef: RefObject<HTMLDivElement | null>;
  timelineTracksRef: RefObject<HTMLDivElement | null>;
  scrubZoneRef: RefObject<HTMLButtonElement | null>;
  timelineContentWidth: string;
  timelineScrollLeft: number;
  timelineRulerMarks: Array<{
    frame: number;
    timeSeconds: number;
    label: string;
  }>;
  timelineDurationSeconds: number;
  currentTime: number;
  onSeek: (nextTime: number) => void;
  onBeginScrub: (clientX: number) => void;
  sceneTracks: SceneTrack[];
  overlayTracks: OverlayTrack[];
  selectedTimelineTrack: SelectedTimelineTrack | null;
  selectedElementKey: string | null;
  fps: number;
  suppressTrackClickUntilRef: RefObject<number>;
  getSceneClipKindClassName: (kind: TrackVisualKind) => string;
  getElementClipKindClassName: (kind: TrackVisualKind) => string;
  onBeginTimelineClipDrag: (
    event: PointerEvent<HTMLElement>,
    state:
      | {
          kind: "scene";
          sceneId: string;
          startFrame: number;
          startLane: number;
          maxLane: number;
          startClientX: number;
          startClientY: number;
        }
      | {
          kind: "element";
          sceneId: string;
          elementIndex: number;
          startFrame: number;
          startLane: number;
          maxLane: number;
          startClientX: number;
          startClientY: number;
        },
  ) => void;
  onBeginTimelineClipTrim: (
    event: PointerEvent<HTMLElement>,
    state:
      | {
          kind: "scene";
          sceneId: string;
          edge: "left" | "right";
          startFrame: number;
          durationInFrames: number;
          trimStartFrames: number;
          trimEndFrames: number;
          sourceStartFrame: number;
          sourceEndFrame: number;
          startClientX: number;
        }
      | {
          kind: "element";
          sceneId: string;
          elementIndex: number;
          edge: "left" | "right";
          startFrame: number;
          durationInFrames: number;
          trimStartFrames: number;
          trimEndFrames: number;
          sourceStartFrame: number;
          sourceEndFrame: number;
          startClientX: number;
        },
  ) => void;
  onSelectSceneTrack: (sceneId: string) => void;
  onSelectElementTrack: (sceneId: string, elementIndex: number) => void;
  onDropAssetToTimeline: (assetId: string, clientX: number, clientY: number) => void;
  playheadLeftPx: number;
};

export function EditorTimeline({
  isInspectorCollapsed,
  boundedInspectorWidth,
  currentTimeLabel,
  isInspectorResizing,
  onInspectorResizeStart,
  inspectorRows,
  timelineMainRef,
  timelineTracksRef,
  scrubZoneRef,
  timelineContentWidth,
  timelineScrollLeft,
  timelineRulerMarks,
  timelineDurationSeconds,
  currentTime,
  onSeek,
  onBeginScrub,
  sceneTracks,
  overlayTracks,
  selectedTimelineTrack,
  selectedElementKey,
  fps,
  suppressTrackClickUntilRef,
  getSceneClipKindClassName,
  getElementClipKindClassName,
  onBeginTimelineClipDrag,
  onBeginTimelineClipTrim,
  onSelectSceneTrack,
  onSelectElementTrack,
  onDropAssetToTimeline,
  playheadLeftPx,
}: EditorTimelineProps) {
  const laneDragExpansion = 24;
  const [isAssetDropTarget, setIsAssetDropTarget] = useState(false);
  const minScenePlaceholderRows = sceneTracks.length > 0 ? 2 : 0;
  const minOverlayPlaceholderRows = 2;
  const timelineFrameSpan = Math.max(1, Math.round(fps * timelineDurationSeconds));
  const secondTicks: Array<{ frame: number; second: number; isMajor: boolean }> = [];
  for (let second = 0; second <= timelineDurationSeconds + 0.0001; second += 1) {
    const frame = Math.min(Math.round(second * fps), Math.max(timelineFrameSpan - 1, 0));
    secondTicks.push({
      frame,
      second,
      isMajor: Math.round(second) % 5 === 0,
    });
  }
  const maxSceneLane = sceneTracks.reduce((maxLane, track) => Math.max(maxLane, track.lane), -1);
  const maxOverlayLane = overlayTracks.reduce((maxLane, track) => Math.max(maxLane, track.lane), -1);
  const sceneLaneCount = Math.max(maxSceneLane + 1, minScenePlaceholderRows);
  const overlayLaneCount = Math.max(maxOverlayLane + 1, minOverlayPlaceholderRows);
  const sceneLanes = Array.from({ length: sceneLaneCount }, (_, lane) => ({
    lane,
    tracks: sceneTracks
      .filter((track) => track.lane === lane)
      .sort((a, b) => a.startFrame - b.startFrame || a.id.localeCompare(b.id)),
  }));
  const overlayLanes = Array.from({ length: overlayLaneCount }, (_, lane) => ({
    lane,
    tracks: overlayTracks
      .filter((track) => track.lane === lane)
      .sort(
        (a, b) =>
          a.startFrame - b.startFrame
          || a.sceneId.localeCompare(b.sceneId)
          || a.elementIndex - b.elementIndex,
      ),
  }));

  return (
    <section className={styles.timeline}>
      <div
        className={styles.timelineBody}
        style={
          {
            "--inspector-width": isInspectorCollapsed ? "0px" : `${boundedInspectorWidth}px`,
            "--inspector-min": isInspectorCollapsed ? "0px" : "250px",
          } as CSSProperties
        }
      >
        {!isInspectorCollapsed ? (
          <TimelineInspector
            currentTimeLabel={currentTimeLabel}
            isResizing={isInspectorResizing}
            onResizeStart={onInspectorResizeStart}
            rows={inspectorRows}
          />
        ) : null}
        <div className={styles.timelineMain} ref={timelineMainRef}>
          <div
            className={styles.timelineHeader}
            style={{
              width: timelineContentWidth,
              transform: `translateX(${-timelineScrollLeft}px)`,
            }}
          >
            {secondTicks.map((tick) => (
              <span
                key={`tick-${tick.frame}-${tick.second}`}
                className={`${styles.timelineTick} ${tick.isMajor ? styles.timelineTickMajor : ""}`}
                style={{ left: `${(tick.frame / timelineFrameSpan) * 100}%` }}
                aria-hidden="true"
              />
            ))}
            {timelineRulerMarks.map((mark) => (
              <span
                key={`${mark.frame}-${mark.timeSeconds}`}
                className={styles.timelineMark}
                style={{ left: `${(mark.frame / timelineFrameSpan) * 100}%` }}
              >
                {mark.label}
              </span>
            ))}
          </div>
          <div className={styles.tracks} ref={timelineTracksRef}>
            <div
              className={`${styles.tracksContent} ${isAssetDropTarget ? styles.tracksContentAssetDropTarget : ""}`}
              style={{ width: timelineContentWidth }}
              onDragOver={(event: DragEvent<HTMLDivElement>) => {
                if (!event.dataTransfer.types.includes("application/editor-asset-id")) {
                  return;
                }

                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                if (!isAssetDropTarget) {
                  setIsAssetDropTarget(true);
                }
              }}
              onDragLeave={() => {
                if (isAssetDropTarget) {
                  setIsAssetDropTarget(false);
                }
              }}
              onDrop={(event: DragEvent<HTMLDivElement>) => {
                const assetId = event.dataTransfer.getData("application/editor-asset-id");
                if (!assetId) {
                  return;
                }

                event.preventDefault();
                setIsAssetDropTarget(false);
                onDropAssetToTimeline(assetId, event.clientX, event.clientY);
              }}
            >
              <input
                type="range"
                min={0}
                max={timelineDurationSeconds || 0}
                step={0.001}
                value={timelineDurationSeconds ? currentTime : 0}
                onChange={(event) => onSeek(Number(event.target.value))}
                className={styles.timelineScrubber}
                aria-label="Timeline scrubber"
              />
              <button
                type="button"
                className={styles.timelineScrubZone}
                ref={scrubZoneRef}
                onPointerDown={(event) => onBeginScrub(event.clientX)}
                aria-label="Seek timeline"
              />
              {sceneLanes.map(({ lane, tracks }) => (
                <div className={styles.trackRow} key={`scene-lane-${lane}`}>
                  <div className={styles.trackLane}>
                    {tracks.map((track) => {
                      const isSelected =
                        selectedTimelineTrack?.kind === "scene" && selectedTimelineTrack.sceneId === track.id;
                      const sourceStartFrame = track.startFrame - track.trimStartFrames;
                      const sourceEndFrame = track.startFrame + track.durationInFrames + track.trimEndFrames;

                      return (
                        <div
                          key={`scene-${track.id}`}
                          className={`${styles.clip} ${styles.sceneClip} ${getSceneClipKindClassName(track.visualKind)} ${isSelected ? styles.sceneClipSelected : ""}`}
                          style={{
                            left: `${track.start}%`,
                            width: `${track.width}%`,
                          }}
                          data-selection-anchor="true"
                          onPointerDown={(event) =>
                            onBeginTimelineClipDrag(event, {
                              kind: "scene",
                              sceneId: track.id,
                              startFrame: track.startFrame,
                              startLane: track.lane,
                              maxLane: Math.max(sceneLaneCount - 1 + laneDragExpansion, 0),
                              startClientX: event.clientX,
                              startClientY: event.clientY,
                            })
                          }
                          onClick={() => {
                            if (Date.now() < (suppressTrackClickUntilRef.current ?? 0)) {
                              return;
                            }

                            onSelectSceneTrack(track.id);
                          }}
                        >
                          <button
                            type="button"
                            className={`${styles.clipTrimHandle} ${styles.clipTrimHandleLeft}`}
                            onPointerDown={(event) =>
                              onBeginTimelineClipTrim(event, {
                                kind: "scene",
                                sceneId: track.id,
                                edge: "left",
                                startFrame: track.startFrame,
                                durationInFrames: track.durationInFrames,
                                trimStartFrames: track.trimStartFrames,
                                trimEndFrames: track.trimEndFrames,
                                sourceStartFrame,
                                sourceEndFrame,
                                startClientX: event.clientX,
                              })
                            }
                            aria-label={`Trim start of ${track.name}`}
                          />
                          <button
                            type="button"
                            className={`${styles.clipTrimHandle} ${styles.clipTrimHandleRight}`}
                            onPointerDown={(event) =>
                              onBeginTimelineClipTrim(event, {
                                kind: "scene",
                                sceneId: track.id,
                                edge: "right",
                                startFrame: track.startFrame,
                                durationInFrames: track.durationInFrames,
                                trimStartFrames: track.trimStartFrames,
                                trimEndFrames: track.trimEndFrames,
                                sourceStartFrame,
                                sourceEndFrame,
                                startClientX: event.clientX,
                              })
                            }
                            aria-label={`Trim end of ${track.name}`}
                          />
                          <TrackVisual
                            kind={track.visualKind}
                            title={track.name}
                            src={track.previewSrc}
                            waveformSeed={track.id}
                            durationInFrames={track.durationInFrames}
                            trimStartFrames={track.trimStartFrames}
                            fps={fps}
                          />
                          <span className={styles.clipTitle}>
                            {track.name} ({track.meta})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {overlayLanes.map(({ lane, tracks }) => (
                <div className={styles.trackRow} key={`element-lane-${lane}`}>
                  <div className={styles.trackLane}>
                    {tracks.map((track) => {
                      const trackKey = `${track.sceneId}:${track.elementIndex}`;
                      const isSelected = selectedElementKey === trackKey;
                      const sourceStartFrame = track.startFrame - track.trimStartFrames;
                      const sourceEndFrame = track.startFrame + track.durationInFrames + track.trimEndFrames;

                      return (
                        <div
                          key={`element-${trackKey}`}
                          className={`${styles.clip} ${styles.elementClip} ${getElementClipKindClassName(track.visualKind)} ${isSelected ? styles.elementClipSelected : ""}`}
                          style={{
                            left: `${track.start}%`,
                            width: `${track.width}%`,
                          }}
                          data-selection-anchor="true"
                          onClick={() => {
                            if (Date.now() < (suppressTrackClickUntilRef.current ?? 0)) {
                              return;
                            }

                            onSelectElementTrack(track.sceneId, track.elementIndex);
                          }}
                          onPointerDown={(event) =>
                            onBeginTimelineClipDrag(event, {
                              kind: "element",
                              sceneId: track.sceneId,
                              elementIndex: track.elementIndex,
                              startFrame: track.startFrame,
                              startLane: track.lane,
                              maxLane: Math.max(overlayLaneCount - 1 + laneDragExpansion, 0),
                              startClientX: event.clientX,
                              startClientY: event.clientY,
                            })
                          }
                        >
                          <button
                            type="button"
                            className={`${styles.clipTrimHandle} ${styles.clipTrimHandleLeft}`}
                            onPointerDown={(event) =>
                              onBeginTimelineClipTrim(event, {
                                kind: "element",
                                sceneId: track.sceneId,
                                elementIndex: track.elementIndex,
                                edge: "left",
                                startFrame: track.startFrame,
                                durationInFrames: track.durationInFrames,
                                trimStartFrames: track.trimStartFrames,
                                trimEndFrames: track.trimEndFrames,
                                sourceStartFrame,
                                sourceEndFrame,
                                startClientX: event.clientX,
                              })
                            }
                            aria-label={`Trim start of ${track.elementKind} track`}
                          />
                          <button
                            type="button"
                            className={`${styles.clipTrimHandle} ${styles.clipTrimHandleRight}`}
                            onPointerDown={(event) =>
                              onBeginTimelineClipTrim(event, {
                                kind: "element",
                                sceneId: track.sceneId,
                                elementIndex: track.elementIndex,
                                edge: "right",
                                startFrame: track.startFrame,
                                durationInFrames: track.durationInFrames,
                                trimStartFrames: track.trimStartFrames,
                                trimEndFrames: track.trimEndFrames,
                                sourceStartFrame,
                                sourceEndFrame,
                                startClientX: event.clientX,
                              })
                            }
                            aria-label={`Trim end of ${track.elementKind} track`}
                          />
                          <TrackVisual
                            kind={track.visualKind}
                            title={track.elementName}
                            src={track.previewSrc}
                            waveformSeed={track.elementId}
                            durationInFrames={track.durationInFrames}
                            trimStartFrames={track.trimStartFrames}
                            fps={fps}
                          />
                          <span className={styles.clipTitle}>
                            {track.elementKind}: {track.elementName} ({track.meta})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.playheadLayer}>
            <button
              type="button"
              className={styles.playhead}
              onPointerDown={(event) => onBeginScrub(event.clientX)}
              aria-label="Drag playhead"
              style={
                {
                  "--playhead-left": `${playheadLeftPx}px`,
                } as CSSProperties
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}


