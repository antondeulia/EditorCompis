"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { requestEditorChatReplyStream } from "./services/editor-chat-gateway";
import { generateVideoSchema } from "./services/schema-generation-gateway";
import { useEditorUiState } from "./hooks/useEditorUiState";
import { demoVideoSchema, VideoSchema } from "./model/schema";
import { useEditorDerivedState } from "./hooks/useEditorDerivedState";
import { useEditorPlaybackController } from "./hooks/useEditorPlaybackController";
import { useEditorKeyboardShortcuts } from "./hooks/useEditorKeyboardShortcuts";
import styles from "./styles/editor.module.css";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string | null;
};

function createChatMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    content: "Hi! I am Compis assistant. Ask about ideas, scripts, timing, transitions, captions, or anything for your video.",
    createdAt: null,
  },
];

function isSchemaGenerationRequest(prompt: string) {
  const token = prompt.trim().toLowerCase();
  return (
    token.startsWith("/schema ") ||
    token === "generate schema" ||
    token === "now generate it" ||
    token === "generate it" ||
    token.includes("сгенерируй схему")
  );
}

function hasRenderableTimelineContent(schema: VideoSchema) {
  if (!Number.isFinite(schema.fps) || schema.fps <= 0) {
    return false;
  }

  const hasMasterAudio = (schema.audioTracks ?? []).some((track) => track.durationInFrames > 0);
  if (hasMasterAudio) {
    return true;
  }

  return schema.scenes.some((scene) => {
    if (!Number.isFinite(scene.durationInFrames) || scene.durationInFrames <= 0) {
      return false;
    }

    const hasSceneAudio = (scene.audioTracks ?? []).some((track) => track.durationInFrames > 0);
    if (hasSceneAudio) {
      return true;
    }

    return scene.elements.some((element) => {
      if (!Number.isFinite(element.durationInFrames) || element.durationInFrames <= 0) {
        return false;
      }

      return element.kind === "text"
        || element.kind === "shape"
        || element.kind === "image"
        || element.kind === "video";
    });
  });
}

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
      { id: "audio-bed", name: "music-track.wav", kind: "audio", sizeLabel: "Audio", mediaLabel: "Audio" },
      { id: "captions", name: "captions.srt", kind: "other", sizeLabel: "Subtitle", mediaLabel: "Subtitle" },
    ],
    [],
  );

  const ui = useEditorUiState({ initialAssets });
  const [videoSchema, setVideoSchema] = useState<VideoSchema>(() => normalizeOverlayTimeline(demoVideoSchema));
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedTimelineTrack, setSelectedTimelineTrack] = useState<SelectedTimelineTrack | null>(null);
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void localProjectGateway.loadDraft(slug).then((snapshot) => {
      if (isCancelled || !snapshot?.schema) {
        return;
      }

      const normalizedDraft = normalizeOverlayTimeline(snapshot.schema);
      if (!hasRenderableTimelineContent(normalizedDraft)) {
        return;
      }

      setVideoSchema(normalizedDraft);
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
    resolveAssetById: (assetId) => ui.assets.find((asset) => asset.id === assetId),
    setVideoSchema,
    setSelectedElementKey,
    setSelectedTimelineTrack,
  });

  const {
    updateElementPosition,
    updateElementBounds,
    addTextTrack,
    addShapeTrack,
    addAssetTrack,
    splitSelectedTimelineTrack,
    deleteSelectedTimelineTrack,
    clearSelectionFocus,
    updateSelectedTextElement,
  } = schemaActions;

  const handleDropAssetToTimeline = useCallback((assetId: string, clientX: number, clientY: number) => {
    const scrubRect = scrubZoneRef.current?.getBoundingClientRect();
    const tracksRect = timelineTracksRef.current?.getBoundingClientRect();
    if (!scrubRect || !tracksRect) {
      addAssetTrack(assetId, playback.currentFrame);
      return;
    }

    const scrubWidth = Math.max(scrubRect.width, 1);
    const pointerX = Math.max(0, Math.min(scrubWidth, clientX - scrubRect.left));
    const startFrame = Math.round((pointerX / scrubWidth) * playback.timelineFrameSpan);

    const minSceneRows = derived.sceneTracks.length > 0 ? 2 : 0;
    const maxSceneLane = derived.sceneTracks.reduce((maxLane, track) => Math.max(maxLane, track.lane), -1);
    const sceneLaneCount = Math.max(maxSceneLane + 1, minSceneRows);
    const rowHeight = 36;
    const contentOffsetTop = 8;
    const relativeY = Math.max(0, clientY - tracksRect.top - contentOffsetTop);
    const absoluteLane = Math.max(0, Math.floor(relativeY / rowHeight));
    const overlayLane = Math.max(0, absoluteLane - sceneLaneCount);

    addAssetTrack(assetId, startFrame, overlayLane);
  }, [addAssetTrack, derived.sceneTracks, playback.currentFrame, playback.timelineFrameSpan]);

  const interactions = useEditorInteractions({
    scrubZoneRef,
    timelineTracksRef,
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

  const handleChatSubmit = useCallback(async () => {
    const prompt = chatPrompt.trim();
    if (!prompt || isChatLoading) {
      return;
    }

    const userMessage = createChatMessage("user", prompt);
    const nextHistory = [...chatMessages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setChatMessages((prev) => [...prev, userMessage]);
    setChatPrompt("");
    setIsChatLoading(true);

    try {
      if (isSchemaGenerationRequest(prompt)) {
        const schemaPrompt = prompt.startsWith("/schema")
          ? prompt.replace(/^\/schema\s*/i, "").trim()
          : prompt;
        const data = await generateVideoSchema(
          schemaPrompt.length > 0 ? schemaPrompt : "Generate video schema based on recent chat context",
          videoSchema,
        );
        const normalizedSchema = normalizeOverlayTimeline(data.schema);
        setVideoSchema(normalizedSchema);
        setSelectedElementKey(null);
        setSelectedTimelineTrack(null);
        playback.seekToFrame(0);
        setChatMessages((prev) => [...prev, createChatMessage("assistant", "Schema generated and applied to preview.")]);
        return;
      }

      const assistantMessageId = `assistant-stream-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      setChatMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
        },
      ]);

      await requestEditorChatReplyStream({
        message: prompt,
        history: nextHistory,
        onToken: (token) => {
          setChatMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId ? { ...message, content: `${message.content}${token}` } : message,
            ),
          );
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setChatMessages((prev) => [...prev, createChatMessage("assistant", `Error: ${message}`)]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatMessages, chatPrompt, isChatLoading, playback, videoSchema]);

  return (
    <div
      className={styles.editorShell}
      style={
        {
          "--timeline-height": `${ui.timelineHeight}px`,
          "--right-sidebar-panel-width": ui.isRightSidebarPanelOpen ? "340px" : "0px",
          "--left-rail-visible-width": ui.isLeftRailCollapsed ? "0px" : `${ui.leftRailWidth}px`,
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
        onAddTextTrack={addTextTrack}
        onAddShapeTrack={addShapeTrack}
      />

      <div
        className={styles.workspace}
      >
        <EditorLeftRail
          isCollapsed={ui.isLeftRailCollapsed}
          isResizing={ui.isLeftRailResizing}
          onResizeStart={ui.handleLeftRailResizeStart}
          isChatScrollbarVisible={ui.isChatScrollbarVisible}
          onChatScroll={ui.handleChatScroll}
          chatMessages={chatMessages}
          chatPrompt={chatPrompt}
          onChatPromptChange={setChatPrompt}
          onChatSubmit={handleChatSubmit}
          isChatLoading={isChatLoading}
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
        isInspectorCollapsed={ui.isInspectorCollapsed}
        zoom={playback.timelineZoom}
        onZoomChange={playback.handleTimelineZoomChange}
        onZoomStep={playback.adjustTimelineZoom}
        onToggleInspector={ui.toggleInspector}
        onTogglePlay={playback.togglePlay}
        onRewind={playback.rewind}
        onForward={playback.forward}
        onSplitFocusedTrack={splitSelectedTimelineTrack}
        onRender={handleSaveProject}
        isTimelineResizing={ui.isTimelineResizing}
        onTimelineResizeStart={ui.handleTimelineResizeStart}
      />

      <EditorTimeline
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
        timelineRulerMarks={playback.timelineRulerMarks}
        timelineDurationSeconds={playback.timelineDurationSeconds}
        currentTime={playback.currentTime}
        onSeek={playback.handleSeek}
        onBeginScrub={playback.beginScrub}
        sceneTracks={derived.sceneTracks}
        overlayTracks={derived.overlayTracks}
        selectedTimelineTrack={selectedTimelineTrack}
        selectedElementKey={selectedElementKey}
        fps={playback.fps}
        suppressTrackClickUntilRef={suppressTrackClickUntilRef}
        getSceneClipKindClassName={derived.getSceneClipKindClassName}
        getElementClipKindClassName={derived.getElementClipKindClassName}
        onBeginTimelineClipDrag={interactions.beginTimelineClipDrag}
        onBeginTimelineClipTrim={interactions.beginTimelineClipTrim}
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
        onDropAssetToTimeline={handleDropAssetToTimeline}
        playheadLeftPx={playback.playheadLeftPx}
      />
    </div>
  );
}
