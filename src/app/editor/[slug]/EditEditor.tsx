"use client";

import {
  CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PlayerRef } from "@remotion/player";
import { EditorLeftRail } from "./components/EditorLeftRail";
import { EditorRightSidebar } from "./components/EditorRightSidebar";
import { EditorTimeline } from "./components/EditorTimeline";
import { EditorTopBar } from "./components/EditorTopBar";
import { PlaybackToolbar } from "./components/PlaybackToolbar/PlaybackToolbar";
import { PreviewStage } from "./components/PreviewStage";
import {
  editableOverlayKinds,
  keyboardSeekStep,
  maxTimelineZoom,
  minTimelineZoom,
  timelineExtensionChunkSeconds,
  timelineExtensionThresholdRatio,
  timelineScaleBase,
  timelineScaleSpan,
  transportSeekStep,
  wheelZoomStep,
} from "./editor-constants";
import {
  ActiveOverlayElement,
  CompositionViewport,
  EditEditorProps,
  OverlayTrack,
  SelectedTimelineTrack,
  TrackVisualKind,
} from "./editor-types";
import {
  clamp,
  collectAssetsFromSchema,
  formatTime,
  getElementLabel,
  getElementTimelineStart,
  getRenderedElementPosition,
  getScenePrimaryElement,
  isTypingTarget,
  normalizeOverlayTimeline,
} from "./editor-utils";
import { useEditorSchemaActions } from "./useEditorSchemaActions";
import { useEditorInteractions } from "./useEditorInteractions";
import { localProjectGateway } from "./editor-project-gateway";
import { useEditorUiState } from "./useEditorUiState";
import { demoVideoSchema, VideoSchema } from "./video-schema";
import styles from "./page.module.css";

export function EditEditor({ slug }: EditEditorProps) {
  const playerRef = useRef<PlayerRef>(null);
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const scrubZoneRef = useRef<HTMLButtonElement | null>(null);
  const timelineMainRef = useRef<HTMLDivElement | null>(null);
  const timelineTracksRef = useRef<HTMLDivElement | null>(null);
  const pendingTimelineScrollLeftRef = useRef<number | null>(null);
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [selectedTimelineTrack, setSelectedTimelineTrack] = useState<SelectedTimelineTrack | null>(null);
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(38);
  const [timelineExtraFrames, setTimelineExtraFrames] = useState(0);
  const [timelinePlayheadMetrics, setTimelinePlayheadMetrics] = useState({ offsetLeft: 0, width: 1 });
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
  const [compositionViewport, setCompositionViewport] = useState<CompositionViewport>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    scale: 1,
  });

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

  const durationInFrames = videoSchema.durationInFrames;
  const fps = videoSchema.fps;
  const durationSeconds = durationInFrames / fps;
  const baseTimelineFrameSpan = useMemo(() => {
    // Ruler base length should be stable and not depend on dragged clip positions.
    return durationInFrames;
  }, [durationInFrames]);
  const timelineFrameSpan = baseTimelineFrameSpan + timelineExtraFrames;
  const timelineDurationSeconds = timelineFrameSpan / fps;
  const currentTime = currentFrame / fps;
  const maxTimelineFrame = Math.max(durationInFrames - 1, 0);
  const progress = maxTimelineFrame > 0 ? clamp(currentFrame / maxTimelineFrame, 0, 1) : 0;
  const boundedInspectorWidth = ui.boundedInspectorWidth;
  const timelineZoomScale = timelineScaleBase + (timelineZoom / 100) * timelineScaleSpan;
  const timelineSpanRatio = durationInFrames > 0 ? timelineFrameSpan / durationInFrames : 1;
  const timelineContentWidth = `${timelineZoomScale * timelineSpanRatio * 100}%`;
  const playheadLeftPx = clamp(
    timelinePlayheadMetrics.offsetLeft + progress * timelinePlayheadMetrics.width,
    timelinePlayheadMetrics.offsetLeft,
    timelinePlayheadMetrics.offsetLeft + timelinePlayheadMetrics.width,
  );

  const timelineMarks = useMemo(
    () => Array.from({ length: 6 }, (_, i) => formatTime((timelineDurationSeconds * i) / 5)),
    [timelineDurationSeconds],
  );

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

  const sceneTracks = useMemo(() => {
    return videoSchema.scenes.map((scene) => {
      const primaryElement = getScenePrimaryElement(scene);
      const visualKind: TrackVisualKind =
        primaryElement?.kind === "video" || primaryElement?.kind === "image"
          ? primaryElement.kind
          : primaryElement?.kind === "text"
            ? "text"
            : "shape";
      const previewSrc =
        primaryElement?.kind === "video" || primaryElement?.kind === "image" ? primaryElement.src : undefined;
      return {
        id: scene.id,
        name: scene.name,
        startFrame: scene.startFrame,
        durationInFrames: scene.durationInFrames,
        start: (scene.startFrame / timelineFrameSpan) * 100,
        width: (scene.durationInFrames / timelineFrameSpan) * 100,
        meta: `${(scene.durationInFrames / fps).toFixed(1)}s`,
        visualKind,
        previewSrc,
      };
    });
  }, [fps, timelineFrameSpan, videoSchema.scenes]);

  const overlayTracks = useMemo(() => {
    const tracks: OverlayTrack[] = [];

    for (const scene of videoSchema.scenes) {
      scene.elements.forEach((element, elementIndex) => {
        if (!editableOverlayKinds.has(element.kind)) {
          return;
        }

        const globalStartFrame = getElementTimelineStart(scene.startFrame, element);
        const globalDuration = Math.max(1, element.durationInFrames);
        tracks.push({
          sceneId: scene.id,
          sceneName: scene.name,
          elementId: element.id,
          elementIndex,
          elementKind: element.kind,
          elementName: getElementLabel(element),
          startFrame: globalStartFrame,
          durationInFrames: globalDuration,
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
      });
    }

    return tracks;
  }, [fps, timelineFrameSpan, videoSchema.scenes]);

  const activeOverlayElements = useMemo(() => {
    const overlays: ActiveOverlayElement[] = [];

    for (const scene of videoSchema.scenes) {
      scene.elements.forEach((element, elementIndex) => {
        if (!editableOverlayKinds.has(element.kind)) {
          return;
        }

        const timelineStartFrame = getElementTimelineStart(scene.startFrame, element);
        if (currentFrame < timelineStartFrame || currentFrame >= timelineStartFrame + element.durationInFrames) {
          return;
        }
        const localFrame = currentFrame - timelineStartFrame;
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
  }, [currentFrame, videoSchema.scenes]);

  const selectedOverlayElement = useMemo(() => {
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

  const inspectorRows = useMemo(
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
  const schemaActions = useEditorSchemaActions({
    currentFrame,
    selectedTimelineTrack,
    selectedOverlayElement,
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

  const seekToFrame = useCallback(
    (nextFrame: number) => {
      const player = playerRef.current;
      if (!player) {
        return;
      }

      const boundedFrame = clamp(Math.round(nextFrame), 0, Math.max(durationInFrames - 1, 0));
      player.seekTo(boundedFrame);
      setCurrentFrame(boundedFrame);
    },
    [durationInFrames],
  );

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const deltaFrames = Math.round(deltaSeconds * fps);
      seekToFrame(currentFrame + deltaFrames);
    },
    [currentFrame, fps, seekToFrame],
  );

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    if (isPlaying) {
      player.pause();
      return;
    }

    player.play();
  }, [isPlaying]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onFrameUpdate = ({ detail }: { detail: { frame: number } }) => setCurrentFrame(detail.frame);

    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);
    player.addEventListener("frameupdate", onFrameUpdate);

    setIsPlaying(player.isPlaying());
    setCurrentFrame(player.getCurrentFrame());

    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
      player.removeEventListener("frameupdate", onFrameUpdate);
    };
  }, []);

  const recalcCompositionViewport = useCallback(() => {
    const container = previewCanvasRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    const aspect = videoSchema.width / videoSchema.height;

    let fittedWidth = width;
    let fittedHeight = width / aspect;

    if (fittedHeight > height) {
      fittedHeight = height;
      fittedWidth = height * aspect;
    }

    const offsetX = (width - fittedWidth) / 2;
    const offsetY = (height - fittedHeight) / 2;

    setCompositionViewport({
      left: offsetX,
      top: offsetY,
      width: fittedWidth,
      height: fittedHeight,
      scale: fittedWidth / videoSchema.width,
    });
  }, [videoSchema.height, videoSchema.width]);

  useLayoutEffect(() => {
    recalcCompositionViewport();

    const container = previewCanvasRef.current;
    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      recalcCompositionViewport();
    });

    resizeObserver.observe(container);
    window.addEventListener("resize", recalcCompositionViewport);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", recalcCompositionViewport);
    };
  }, [recalcCompositionViewport]);

  const toCompositionCoordinates = useCallback(
    (clientX: number, clientY: number) => {
      const container = previewCanvasRef.current;
      if (!container) {
        return null;
      }

      if (compositionViewport.width <= 0 || compositionViewport.height <= 0) {
        return null;
      }

      const rect = container.getBoundingClientRect();
      const x =
        (clientX - (rect.left + compositionViewport.left)) / Math.max(compositionViewport.scale, 0.0001);
      const y =
        (clientY - (rect.top + compositionViewport.top)) / Math.max(compositionViewport.scale, 0.0001);

      return {
        x,
        y,
      };
    },
    [compositionViewport],
  );

  const interactions = useEditorInteractions({
    scrubZoneRef,
    timelineFrameSpan,
    compositionViewportScale: compositionViewport.scale,
    toCompositionCoordinates,
    suppressTrackClickUntilRef,
    setVideoSchema,
    setSelectedElementKey,
    setSelectedTimelineTrack,
    updateElementPosition,
    updateElementBounds,
  });

  const {
    beginTimelineClipDrag,
    startOverlayDrag,
    startOverlayResize,
    clearOverlayInteractionState,
  } = interactions;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekBy(-keyboardSeekStep);
        return;
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        seekBy(keyboardSeekStep);
        return;
      }

      if (event.code === "KeyB") {
        event.preventDefault();
        splitSelectedTimelineTrack();
        return;
      }

      if (event.code === "Backspace" || event.code === "Delete") {
        event.preventDefault();
        deleteSelectedTimelineTrack();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteSelectedTimelineTrack, seekBy, splitSelectedTimelineTrack, togglePlay]);

  function rewind() {
    seekBy(-transportSeekStep);
  }

  function forward() {
    seekBy(transportSeekStep);
  }

  const handleSaveProject = useCallback(() => {
    void localProjectGateway.saveDraft({
      slug,
      schema: videoSchema,
      updatedAt: new Date().toISOString(),
    });
    seekToFrame(0);
  }, [seekToFrame, slug, videoSchema]);

  const handleSeek = useCallback((nextTime: number) => {
    seekToFrame(nextTime * fps);
  }, [fps, seekToFrame]);

  const handleTimelineZoomChange = useCallback((nextZoom: number) => {
    setTimelineZoom(clamp(nextZoom, minTimelineZoom, maxTimelineZoom));
  }, []);

  const adjustTimelineZoom = useCallback((delta: number) => {
    setTimelineZoom((prev) => clamp(prev + delta, minTimelineZoom, maxTimelineZoom));
  }, []);

  const applyTimelineWheelZoom = useCallback((deltaY: number, clientX: number) => {
    const timelineElement = timelineTracksRef.current;
    if (!timelineElement) {
      return;
    }

    const rect = timelineElement.getBoundingClientRect();
    const mouseX = clamp(clientX - rect.left, 0, rect.width);
    const minScale = timelineScaleBase + (minTimelineZoom / 100) * timelineScaleSpan;
    const maxScale = timelineScaleBase + (maxTimelineZoom / 100) * timelineScaleSpan;
    const oldScale = timelineScaleBase + (timelineZoom / 100) * timelineScaleSpan;
    const zoomFactor = Math.exp(-deltaY * wheelZoomStep);
    const newScale = clamp(oldScale * zoomFactor, minScale, maxScale);

    if (Math.abs(newScale - oldScale) < 0.0001) {
      return;
    }

    const timeUnderCursor = (timelineElement.scrollLeft + mouseX) / oldScale;
    const nextScrollLeft = Math.max(0, timeUnderCursor * newScale - mouseX);
    pendingTimelineScrollLeftRef.current = nextScrollLeft;

    const nextZoom = ((newScale - timelineScaleBase) / timelineScaleSpan) * 100;
    setTimelineZoom(clamp(nextZoom, minTimelineZoom, maxTimelineZoom));
  }, [timelineZoom]);

  useLayoutEffect(() => {
    const timelineElement = timelineTracksRef.current;
    const timelineMainElement = timelineMainRef.current;
    const scrubZoneElement = scrubZoneRef.current;

    if (!timelineElement || !timelineMainElement || !scrubZoneElement) {
      return;
    }

    function updatePlayheadMetrics() {
      const scrubRect = scrubZoneElement.getBoundingClientRect();
      const mainRect = timelineMainElement.getBoundingClientRect();
      const nextOffsetLeft = scrubRect.left - mainRect.left;
      const nextWidth = Math.max(scrubRect.width, 1);
      const nextScrollLeft = timelineElement.scrollLeft;

      setTimelinePlayheadMetrics((prev) => {
        if (Math.abs(prev.offsetLeft - nextOffsetLeft) < 0.5 && Math.abs(prev.width - nextWidth) < 0.5) {
          return prev;
        }

        return {
          offsetLeft: nextOffsetLeft,
          width: nextWidth,
        };
      });
      setTimelineScrollLeft((prev) => (Math.abs(prev - nextScrollLeft) < 0.5 ? prev : nextScrollLeft));
    }

    updatePlayheadMetrics();
    timelineElement.addEventListener("scroll", updatePlayheadMetrics, { passive: true });
    window.addEventListener("resize", updatePlayheadMetrics);

    return () => {
      timelineElement.removeEventListener("scroll", updatePlayheadMetrics);
      window.removeEventListener("resize", updatePlayheadMetrics);
    };
  }, [timelineZoom]);

  useEffect(() => {
    const timelineElement = timelineTracksRef.current;
    if (!timelineElement) {
      return;
    }

    function handleNativeWheel(event: globalThis.WheelEvent) {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      applyTimelineWheelZoom(event.deltaY, event.clientX);
    }

    timelineElement.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      timelineElement.removeEventListener("wheel", handleNativeWheel);
    };
  }, [applyTimelineWheelZoom]);

  useLayoutEffect(() => {
    const timelineElement = timelineTracksRef.current;
    const pendingScrollLeft = pendingTimelineScrollLeftRef.current;

    if (!timelineElement || pendingScrollLeft === null) {
      return;
    }

    const maxScrollLeft = Math.max(0, timelineElement.scrollWidth - timelineElement.clientWidth);
    timelineElement.scrollLeft = clamp(pendingScrollLeft, 0, maxScrollLeft);
    pendingTimelineScrollLeftRef.current = null;
  }, [timelineZoom]);

  useEffect(() => {
    const timelineElement = timelineTracksRef.current;
    if (!timelineElement) {
      return;
    }

    const chunkFrames = Math.max(Math.round(fps * timelineExtensionChunkSeconds), fps);

    function maybeExtendTimeline() {
      const remaining = timelineElement.scrollWidth - (timelineElement.scrollLeft + timelineElement.clientWidth);
      const threshold = Math.max(timelineElement.clientWidth * timelineExtensionThresholdRatio, 120);

      if (remaining > threshold) {
        return;
      }

      setTimelineExtraFrames((prev) => prev + chunkFrames);
    }

    maybeExtendTimeline();
    timelineElement.addEventListener("scroll", maybeExtendTimeline, { passive: true });
    window.addEventListener("resize", maybeExtendTimeline);

    return () => {
      timelineElement.removeEventListener("scroll", maybeExtendTimeline);
      window.removeEventListener("resize", maybeExtendTimeline);
    };
  }, [fps, timelineFrameSpan]);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const scrubZoneElement = scrubZoneRef.current;

      if (!scrubZoneElement || durationSeconds <= 0) {
        return;
      }

      const scrubZoneRect = scrubZoneElement.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - scrubZoneRect.left) / Math.max(scrubZoneRect.width, 1), 0), 1);

      handleSeek(ratio * durationSeconds);
    },
    [durationSeconds, handleSeek],
  );

  function beginScrub(clientX: number) {
    seekFromClientX(clientX);
    setIsScrubbing(true);
  }

  useEffect(() => {
    if (!isScrubbing) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      seekFromClientX(event.clientX);
    }

    function stopScrub() {
      setIsScrubbing(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopScrub);
    window.addEventListener("pointercancel", stopScrub);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopScrub);
      window.removeEventListener("pointercancel", stopScrub);
    };
  }, [isScrubbing, seekFromClientX]);

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
        selectedTextElement={selectedOverlayElement?.element.kind === "text" ? selectedOverlayElement.element : null}
        onTextChange={(value) =>
          updateSelectedTextElement((element) => ({
            ...element,
            text: value,
          }))
        }
        onFontSizeChange={(value) =>
          updateSelectedTextElement((element) => ({
            ...element,
            fontSize: clamp(Math.round(value), 8, 300),
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
          compositionViewport={compositionViewport}
          videoSchema={videoSchema}
          activeOverlayElements={activeOverlayElements}
          selectedElementKey={selectedElementKey}
          getElementLabel={getElementLabel}
          onOverlayDragStart={startOverlayDrag}
          onOverlayResizeStart={startOverlayResize}
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
            clearOverlayInteractionState();
          }}
        />
      </div>

      <PlaybackToolbar
        isPlaying={isPlaying}
        zoom={timelineZoom}
        onZoomChange={handleTimelineZoomChange}
        onZoomStep={adjustTimelineZoom}
        onTogglePlay={togglePlay}
        onRewind={rewind}
        onForward={forward}
        onRender={handleSaveProject}
      />

      <EditorTimeline
        isTimelineResizing={ui.isTimelineResizing}
        onTimelineResizeStart={ui.handleTimelineResizeStart}
        isInspectorCollapsed={ui.isInspectorCollapsed}
        boundedInspectorWidth={boundedInspectorWidth}
        currentTimeLabel={formatTime(currentTime)}
        isInspectorResizing={ui.isInspectorResizing}
        onInspectorResizeStart={ui.handleInspectorResizeStart}
        inspectorRows={inspectorRows}
        timelineMainRef={timelineMainRef}
        timelineTracksRef={timelineTracksRef}
        scrubZoneRef={scrubZoneRef}
        timelineContentWidth={timelineContentWidth}
        timelineScrollLeft={timelineScrollLeft}
        timelineMarks={timelineMarks}
        timelineDurationSeconds={timelineDurationSeconds}
        currentTime={currentTime}
        onSeek={handleSeek}
        onBeginScrub={beginScrub}
        sceneTracks={sceneTracks}
        overlayTracks={overlayTracks}
        selectedTimelineTrack={selectedTimelineTrack}
        selectedElementKey={selectedElementKey}
        timelineZoomScale={timelineZoomScale}
        fps={fps}
        currentFrame={currentFrame}
        suppressTrackClickUntilRef={suppressTrackClickUntilRef}
        getSceneClipKindClassName={getSceneClipKindClassName}
        getElementClipKindClassName={getElementClipKindClassName}
        onBeginTimelineClipDrag={beginTimelineClipDrag}
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
        playheadLeftPx={playheadLeftPx}
      />
    </div>
  );
}








