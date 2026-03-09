"use client";

import { CSSProperties, PointerEvent, RefObject } from "react";
import { TimelineInspector } from "./TimelineInspector/TimelineInspector";
import { TrackVisual } from "./TrackVisual";
import { OverlayTrack, SelectedTimelineTrack, TrackVisualKind } from "../editor-types";
import styles from "../page.module.css";

type SceneTrack = {
  id: string;
  name: string;
  startFrame: number;
  durationInFrames: number;
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
  isTimelineResizing: boolean;
  onTimelineResizeStart: (event: PointerEvent<HTMLButtonElement>) => void;
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
  timelineMarks: string[];
  timelineDurationSeconds: number;
  currentTime: number;
  onSeek: (nextTime: number) => void;
  onBeginScrub: (clientX: number) => void;
  sceneTracks: SceneTrack[];
  overlayTracks: OverlayTrack[];
  selectedTimelineTrack: SelectedTimelineTrack | null;
  selectedElementKey: string | null;
  timelineZoomScale: number;
  fps: number;
  currentFrame: number;
  suppressTrackClickUntilRef: RefObject<number>;
  getSceneClipKindClassName: (kind: TrackVisualKind) => string;
  getElementClipKindClassName: (kind: TrackVisualKind) => string;
  onBeginTimelineClipDrag: (
    event: PointerEvent<HTMLElement>,
    state:
      | { kind: "scene"; sceneId: string; startFrame: number; startClientX: number }
      | { kind: "element"; sceneId: string; elementIndex: number; startFrame: number; startClientX: number },
  ) => void;
  onSelectSceneTrack: (sceneId: string) => void;
  onSelectElementTrack: (sceneId: string, elementIndex: number) => void;
  onDeleteSceneTrack: (sceneId: string) => void;
  onDeleteElementTrack: (sceneId: string, elementIndex: number) => void;
  onSplitElementTrack: (sceneId: string, elementIndex: number, frame: number) => void;
  onAddTextTrack: () => void;
  playheadLeftPx: number;
};

export function EditorTimeline({
  isTimelineResizing,
  onTimelineResizeStart,
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
  timelineMarks,
  timelineDurationSeconds,
  currentTime,
  onSeek,
  onBeginScrub,
  sceneTracks,
  overlayTracks,
  selectedTimelineTrack,
  selectedElementKey,
  timelineZoomScale,
  fps,
  currentFrame,
  suppressTrackClickUntilRef,
  getSceneClipKindClassName,
  getElementClipKindClassName,
  onBeginTimelineClipDrag,
  onSelectSceneTrack,
  onSelectElementTrack,
  onDeleteSceneTrack,
  onDeleteElementTrack,
  onSplitElementTrack,
  onAddTextTrack,
  playheadLeftPx,
}: EditorTimelineProps) {
  return (
    <section className={styles.timeline}>
      <button
        type="button"
        className={`${styles.timelineResizeHandle} ${isTimelineResizing ? styles.timelineResizeHandleActive : ""}`}
        onPointerDown={onTimelineResizeStart}
        aria-label="Resize timeline height"
      />
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
            {timelineMarks.map((mark, index) => (
              <span key={`${mark}-${index}`}>{mark}</span>
            ))}
          </div>
          <div className={styles.tracks} ref={timelineTracksRef}>
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
              style={{ width: timelineContentWidth, right: "auto" }}
              onPointerDown={(event) => onBeginScrub(event.clientX)}
              aria-label="Seek timeline"
            />
            {sceneTracks.map((track) => {
              const isSelected = selectedTimelineTrack?.kind === "scene" && selectedTimelineTrack.sceneId === track.id;

              return (
                <div className={styles.trackRow} key={`scene-${track.id}`}>
                  <div className={styles.trackLane}>
                    <div
                      className={`${styles.clip} ${styles.sceneClip} ${getSceneClipKindClassName(track.visualKind)} ${isSelected ? styles.sceneClipSelected : ""}`}
                      style={{
                        left: `${track.start * timelineZoomScale}%`,
                        width: `${track.width * timelineZoomScale}%`,
                      }}
                      data-selection-anchor="true"
                      onPointerDown={(event) =>
                        onBeginTimelineClipDrag(event, {
                          kind: "scene",
                          sceneId: track.id,
                          startFrame: track.startFrame,
                          startClientX: event.clientX,
                        })
                      }
                      onClick={() => {
                        if (Date.now() < (suppressTrackClickUntilRef.current ?? 0)) {
                          return;
                        }

                        onSelectSceneTrack(track.id);
                      }}
                    >
                      <TrackVisual
                        kind={track.visualKind}
                        title={track.name}
                        src={track.previewSrc}
                        waveformSeed={track.id}
                        durationInFrames={track.durationInFrames}
                        fps={fps}
                      />
                      <span className={styles.clipTitle}>
                        {track.name} ({track.meta})
                      </span>
                      <button
                        type="button"
                        className={styles.clipDeleteButton}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onDeleteSceneTrack(track.id);
                        }}
                        aria-label={`Delete ${track.name} track`}
                        title="Delete track"
                      >
                        x
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {overlayTracks.map((track) => {
              const trackKey = `${track.sceneId}:${track.elementIndex}`;
              const isSelected = selectedElementKey === trackKey;

              return (
                <div className={styles.trackRow} key={`element-${trackKey}`}>
                  <div className={styles.trackLane}>
                    <div
                      className={`${styles.clip} ${styles.elementClip} ${getElementClipKindClassName(track.visualKind)} ${isSelected ? styles.elementClipSelected : ""} ${isSelected ? styles.clipHasSplitAction : ""}`}
                      style={{
                        left: `${track.start * timelineZoomScale}%`,
                        width: `${track.width * timelineZoomScale}%`,
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
                          startClientX: event.clientX,
                        })
                      }
                    >
                      <TrackVisual
                        kind={track.visualKind}
                        title={track.elementName}
                        src={track.previewSrc}
                        waveformSeed={track.elementId}
                        durationInFrames={track.durationInFrames}
                        fps={fps}
                      />
                      <span className={styles.clipTitle}>
                        {track.elementKind}: {track.elementName} ({track.meta})
                      </span>
                      <button
                        type="button"
                        className={styles.clipDeleteButton}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onDeleteElementTrack(track.sceneId, track.elementIndex);
                        }}
                        aria-label={`Delete ${track.elementKind} track`}
                        title="Delete track"
                      >
                        x
                      </button>
                      {isSelected ? (
                        <button
                          type="button"
                          className={styles.clipSplitButton}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onSplitElementTrack(track.sceneId, track.elementIndex, currentFrame);
                          }}
                          aria-label={`Split ${track.elementKind} track at playhead`}
                          title="Split at playhead"
                        >
                          split
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className={`${styles.trackRow} ${styles.newTrackRow}`}>
              <div className={`${styles.trackLane} ${styles.newTrackLane}`}>
                <button type="button" className={styles.newTrackButton} onClick={onAddTextTrack}>
                  + New
                </button>
              </div>
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
