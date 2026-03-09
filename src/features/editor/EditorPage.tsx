"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { PlayerRef } from "@remotion/player";
import { EditorLeftRail } from "./components/layout/EditorLeftRail";
import { EditorRightSidebar } from "./components/layout/EditorRightSidebar";
import { EditorTimeline } from "./components/timeline/EditorTimeline";
import { EditorTopBar } from "./components/layout/EditorTopBar";
import { PlaybackToolbar } from "./components/playback/PlaybackToolbar/PlaybackToolbar";
import { PreviewStage } from "./components/preview/PreviewStage";
import { EditorProps, SelectedTimelineTrack } from "./model/types";
import { collectAssetsFromSchema, formatTime, getElementLabel, normalizeOverlayTimeline } from "./lib/utils";
import { useEditorSchemaActions } from "./hooks/useEditorSchemaActions";
import { useEditorInteractions } from "./hooks/useEditorInteractions";
import { localProjectGateway } from "./services/project-gateway";
import { useEditorUiState } from "./hooks/useEditorUiState";
import { demoVideoSchema, VideoSchema } from "./model/schema";
import { useEditorDerivedState } from "./hooks/useEditorDerivedState";
import { useEditorPlaybackController } from "./hooks/useEditorPlaybackController";
import { useEditorKeyboardShortcuts } from "./hooks/useEditorKeyboardShortcuts";
import styles from "./styles/editor.module.css";

export function Editor({ slug }: EditorProps) {
  const playerRef = useRef<PlayerRef>(null);
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const scrubZoneRef = useRef<HTMLButtonElement | null>(null);
  const timelineMainRef = useRef<HTMLDivElement | null>(null);
  const timelineTracksRef = useRef<HTMLDivElement | null>(null);
  const suppressTrackClickUntilRef = useRef(0);

  const initialAssets = useMemo(
    () => [
      ...collectAssetsFromSchema(demoVideoSchema),
      { id: "audio-bed", name: "music-track.wav", kind: "audio", sizeLabel: "Audio" },
      { id: "captions", name: "captions.srt", kind: "other", sizeLabel: "Subtitle" },
    ],
    [],
  );

  const ui = useEditorUiState({ initialAssets });
  const [videoSchema, setVideoSchema] = useState<VideoSchema>(() => normalizeOverlayTimeline(demoVideoSchema));
  const [selectedTimelineTrack, setSelectedTimelineTrack] = useState<SelectedTimelineTrack | null>(null);
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void localProjectGateway.loadDraft(slug).then((snapshot) => {
      if (isCancelled || !snapshot?.schema) {
        return;
      }

      setVideoSchema(normalizeOverlayTimeline(snapshot.schema));
    });

    return () => {
      isCancelled = true;
    };
  }, [slug]);

  const playback = useEditorPlaybackController({
    playerRef,
    previewCanvasRef,
    scrubZoneRef,
    timelineMainRef,
    timelineTracksRef,
    videoSchema,
  });

  const derived = useEditorDerivedState({
    videoSchema,
    fps: playback.fps,
    currentFrame: playback.currentFrame,
    timelineFrameSpan: playback.timelineFrameSpan,
    selectedElementKey,
  });

  const schemaActions = useEditorSchemaActions({
    currentFrame: playback.currentFrame,
    selectedTimelineTrack,
    selectedOverlayElement: derived.selectedOverlayElement,
    setVideoSchema,
    setSelectedElementKey,
    setSelectedTimelineTrack,
  });

  const {
    updateElementPosition,
    updateElementBounds,
    addTextTrack,
    deleteSceneTrack,
    deleteElementTrack,
    splitElementTrack,
    splitSelectedTimelineTrack,
    deleteSelectedTimelineTrack,
    clearSelectionFocus,
    updateSelectedTextElement,
  } = schemaActions;

  const interactions = useEditorInteractions({
    scrubZoneRef,
    timelineFrameSpan: playback.timelineFrameSpan,
    compositionViewportScale: playback.compositionViewport.scale,
    toCompositionCoordinates: playback.toCompositionCoordinates,
    suppressTrackClickUntilRef,
    setVideoSchema,
    setSelectedElementKey,
    setSelectedTimelineTrack,
    updateElementPosition,
    updateElementBounds,
  });

  useEditorKeyboardShortcuts({
    togglePlay: playback.togglePlay,
    seekBy: playback.seekBy,
    splitSelectedTimelineTrack,
    deleteSelectedTimelineTrack,
  });

  const handleSaveProject = () => {
    void localProjectGateway.saveDraft({
      slug,
      schema: videoSchema,
      updatedAt: new Date().toISOString(),
    });
    playback.seekToFrame(0);
  };

  return (
    <div
      className={styles.editorShell}
      style={
        {
          "--timeline-height": `${ui.timelineHeight}px`,
          "--right-sidebar-panel-width": ui.isRightSidebarPanelOpen ? "340px" : "0px",
        } as CSSProperties
      }
      onPointerDownCapture={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        if (target.closest("[data-selection-anchor='true']")) {
          return;
        }

        clearSelectionFocus();
      }}
    >
      <EditorTopBar
        slug={slug}
        isLeftRailCollapsed={ui.isLeftRailCollapsed}
        isInspectorCollapsed={ui.isInspectorCollapsed}
        onToggleLeftRail={ui.toggleLeftRail}
        onToggleInspector={ui.toggleInspector}
      />

      <EditorRightSidebar
        activeSection={ui.activeRightSidebarSection}
        isPanelOpen={ui.isRightSidebarPanelOpen}
        onSectionClick={ui.handleRightSidebarSectionClick}
        selectedTextElement={
          derived.selectedOverlayElement?.element.kind === "text" ? derived.selectedOverlayElement.element : null
        }
        onTextChange={(value) =>
          updateSelectedTextElement((element) => ({
            ...element,
            text: value,
          }))
        }
        onFontSizeChange={(value) =>
          updateSelectedTextElement((element) => ({
            ...element,
            fontSize: Math.max(8, Math.min(300, Math.round(value))),
          }))
        }
      />

      <div
        className={styles.workspace}
        style={
          {
            "--left-rail-width": ui.isLeftRailCollapsed ? "0px" : `${ui.leftRailWidth}px`,
            "--left-rail-min": ui.isLeftRailCollapsed ? "0px" : "250px",
          } as CSSProperties
        }
      >
        <EditorLeftRail
          isCollapsed={ui.isLeftRailCollapsed}
          isResizing={ui.isLeftRailResizing}
          onResizeStart={ui.handleLeftRailResizeStart}
          activeTab={ui.activeLeftTab}
          onTabChange={ui.setActiveLeftTab}
          isChatScrollbarVisible={ui.isChatScrollbarVisible}
          onChatScroll={ui.handleChatScroll}
          assets={ui.assets}
          assetUploadInputRef={ui.assetUploadInputRef}
          onAssetUpload={ui.handleAssetUpload}
        />

        <PreviewStage
          playerRef={playerRef}
          previewCanvasRef={previewCanvasRef}
          compositionViewport={playback.compositionViewport}
          videoSchema={videoSchema}
          activeOverlayElements={derived.activeOverlayElements}
          selectedElementKey={selectedElementKey}
          getElementLabel={getElementLabel}
          onOverlayDragStart={interactions.startOverlayDrag}
          onOverlayResizeStart={interactions.startOverlayResize}
          onOverlaySelect={(sceneId, elementIndex, key) => {
            setSelectedElementKey(key);
            setSelectedTimelineTrack({
              kind: "element",
              sceneId,
              elementIndex,
            });
          }}
          onOverlayClearSelection={() => {
            setSelectedElementKey(null);
            setSelectedTimelineTrack(null);
            interactions.clearOverlayInteractionState();
          }}
        />
      </div>

      <PlaybackToolbar
        isPlaying={playback.isPlaying}
        zoom={playback.timelineZoom}
        onZoomChange={playback.handleTimelineZoomChange}
        onZoomStep={playback.adjustTimelineZoom}
        onTogglePlay={playback.togglePlay}
        onRewind={playback.rewind}
        onForward={playback.forward}
        onRender={handleSaveProject}
      />

      <EditorTimeline
        isTimelineResizing={ui.isTimelineResizing}
        onTimelineResizeStart={ui.handleTimelineResizeStart}
        isInspectorCollapsed={ui.isInspectorCollapsed}
        boundedInspectorWidth={ui.boundedInspectorWidth}
        currentTimeLabel={formatTime(playback.currentTime)}
        isInspectorResizing={ui.isInspectorResizing}
        onInspectorResizeStart={ui.handleInspectorResizeStart}
        inspectorRows={derived.inspectorRows}
        timelineMainRef={timelineMainRef}
        timelineTracksRef={timelineTracksRef}
        scrubZoneRef={scrubZoneRef}
        timelineContentWidth={playback.timelineContentWidth}
        timelineScrollLeft={playback.timelineScrollLeft}
        timelineMarks={playback.timelineMarks}
        timelineDurationSeconds={playback.timelineDurationSeconds}
        currentTime={playback.currentTime}
        onSeek={playback.handleSeek}
        onBeginScrub={playback.beginScrub}
        sceneTracks={derived.sceneTracks}
        overlayTracks={derived.overlayTracks}
        selectedTimelineTrack={selectedTimelineTrack}
        selectedElementKey={selectedElementKey}
        timelineZoomScale={playback.timelineZoomScale}
        fps={playback.fps}
        currentFrame={playback.currentFrame}
        suppressTrackClickUntilRef={suppressTrackClickUntilRef}
        getSceneClipKindClassName={derived.getSceneClipKindClassName}
        getElementClipKindClassName={derived.getElementClipKindClassName}
        onBeginTimelineClipDrag={interactions.beginTimelineClipDrag}
        onSelectSceneTrack={(sceneId) => {
          setSelectedTimelineTrack({ kind: "scene", sceneId });
          setSelectedElementKey(null);
        }}
        onSelectElementTrack={(sceneId, elementIndex) => {
          setSelectedTimelineTrack({
            kind: "element",
            sceneId,
            elementIndex,
          });
          setSelectedElementKey(`${sceneId}:${elementIndex}`);
        }}
        onDeleteSceneTrack={deleteSceneTrack}
        onDeleteElementTrack={deleteElementTrack}
        onSplitElementTrack={splitElementTrack}
        onAddTextTrack={addTextTrack}
        playheadLeftPx={playback.playheadLeftPx}
      />
    </div>
  );
}
