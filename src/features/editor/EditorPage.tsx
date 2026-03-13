"use client";

import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { PlayerRef } from "@remotion/player";
import { EditorLeftRail } from "./components/layout/EditorLeftRail";
import { EditorRightSidebar } from "./components/layout/EditorRightSidebar";
import { EditorTimeline } from "./components/timeline/EditorTimeline";
import { EditorTopBar } from "./components/layout/EditorTopBar";
import { PlaybackToolbar } from "./components/playback/PlaybackToolbar/PlaybackToolbar";
import { PreviewStage } from "./components/preview/PreviewStage";
import { EditorProps, SelectedTimelineTrack, TimelineElementDrop } from "./model/types";
import { collectAssetsFromSchema, formatTime, getElementLabel, normalizeOverlayTimeline } from "./lib/utils";
import { useEditorSchemaActions } from "./hooks/useEditorSchemaActions";
import { useEditorInteractions } from "./hooks/useEditorInteractions";
import { localProjectGateway } from "./services/project-gateway";
import { useEditorUiState } from "./hooks/useEditorUiState";
import { VideoSchema } from "./model/schema";
import { useEditorDerivedState } from "./hooks/useEditorDerivedState";
import { useEditorPlaybackController } from "./hooks/useEditorPlaybackController";
import { useEditorKeyboardShortcuts } from "./hooks/useEditorKeyboardShortcuts";
import { useEditorChat } from "./hooks/useEditorChat";
import styles from "./styles/editor.module.css";

/*
type ChatRole = "user" | "assistant";
type ChatWorkflowStatus = "idle" | "planning" | "awaiting_approval" | "applying";
type ChatWorkflowStepStatus = "pending" | "active" | "done";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string | null;
};

type ChatWorkflowStep = {
  id: string;
  label: string;
  status: ChatWorkflowStepStatus;
};

type LocalAddElementKind = "text" | "rect" | "circle";

type PendingChatAction =
  | {
      kind: "local-add";
      element: LocalAddElementKind;
      prompt: string;
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

function shouldUseEditWorkflow(prompt: string) {
  const normalized = prompt.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith("/schema ")) {
    return false;
  }

  const editKeywords = [
    "add",
    "remove",
    "change",
    "edit",
    "create",
    "make",
    "insert",
    "trim",
    "cut",
    "caption",
    "subtitle",
    "transition",
    "animate",
    "montage",
    "overlay",
    "text",
    "добав",
    "убер",
    "измен",
    "сдел",
    "созд",
    "монтаж",
    "текст",
    "субтит",
    "аним",
    "переход",
    "обреж",
  ];

  return editKeywords.some((keyword) => normalized.includes(keyword));
}

function detectLocalAddElementIntent(prompt: string): LocalAddElementKind | null {
  if (prompt.length >= 0) {
    return null;
  }

  const normalized = prompt.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const wantsAdd =
    normalized.includes("add") ||
    normalized.includes("insert") ||
    normalized.includes("create") ||
    normalized.includes("добав") ||
    normalized.includes("встав") ||
    normalized.includes("созда");

  if (!wantsAdd) {
    return null;
  }

  if (
    normalized.includes("text") ||
    normalized.includes("title") ||
    normalized.includes("caption") ||
    normalized.includes("subtitle") ||
    normalized.includes("текст") ||
    normalized.includes("титр") ||
    normalized.includes("субтит")
  ) {
    return "text";
  }

  if (
    normalized.includes("circle") ||
    normalized.includes("dot") ||
    normalized.includes("badge") ||
    normalized.includes("круг") ||
    normalized.includes("круж")
  ) {
    return "circle";
  }

  if (
    normalized.includes("rect") ||
    normalized.includes("rectangle") ||
    normalized.includes("box") ||
    normalized.includes("shape") ||
    normalized.includes("block") ||
    normalized.includes("прямоуг") ||
    normalized.includes("плашк") ||
    normalized.includes("блок") ||
    normalized.includes("фигур")
  ) {
    return "rect";
  }

  return null;
}

function buildLocalAddPlanMessage(element: LocalAddElementKind) {
  if (element === "text") {
    return [
      "План готов:",
      "1. Добавлю текстовый элемент на текущую позицию плейхеда.",
      "2. Элемент появится как отдельная дорожка overlay на таймлайне.",
      "3. После добавления его можно будет сразу выделить и отредактировать справа.",
      "",
      "Подтвердить добавление текста?",
    ].join("\n");
  }

  if (element === "circle") {
    return [
      "План готов:",
      "1. Добавлю круглый shape-элемент на текущую позицию плейхеда.",
      "2. Он появится как отдельная overlay-дорожка на таймлайне.",
      "3. После добавления его можно будет двигать и менять размер.",
      "",
      "Подтвердить добавление круга?",
    ].join("\n");
  }

  return [
    "План готов:",
    "1. Добавлю прямоугольный shape-элемент на текущую позицию плейхеда.",
    "2. Он появится как отдельная overlay-дорожка на таймлайне.",
    "3. После добавления его можно будет двигать и менять размер.",
    "",
    "Подтвердить добавление элемента?",
  ].join("\n");
}

function buildUnsupportedEditMessage() {
  return [
    "Пока умею только простые локальные действия без генерации всего монтажа.",
    "Сейчас можно нормально добавить:",
    "1. Текст",
    "2. Прямоугольник",
    "3. Круг",
    "",
    "Напиши, например: `Добавь текст` или `Добавь круг`.",
  ].join("\n");
}

void buildUnsupportedEditMessage;

function normalizeDecisionPrompt(prompt: string) {
  return prompt.trim().toLowerCase().replace(/[.!?,;:()"']/g, "");
}

function isApprovalPrompt(prompt: string) {
  const normalized = normalizeDecisionPrompt(prompt);
  return [
    "y",
    "yes",
    "yeah",
    "yep",
    "ok",
    "okay",
    "sure",
    "approve",
    "do it",
    "go ahead",
    "да",
    "ага",
    "ок",
    "окей",
    "подтверждаю",
    "подходит",
    "делай",
    "сделай",
  ].includes(normalized);
}

function isRejectPrompt(prompt: string) {
  const normalized = normalizeDecisionPrompt(prompt);
  return [
    "n",
    "no",
    "nope",
    "cancel",
    "stop",
    "not now",
    "нет",
    "не",
    "не надо",
    "отмена",
    "отмени",
    "стоп",
  ].includes(normalized);
}

function buildWorkflowSteps(status: ChatWorkflowStatus): ChatWorkflowStep[] {
  const getStepStatus = (current: "planning" | "awaiting_approval" | "applying"): ChatWorkflowStepStatus => {
    if (status === "idle") {
      return "pending";
    }

    const order = ["planning", "awaiting_approval", "applying"] as const;
    const currentIndex = order.indexOf(current);
    const activeIndex = order.indexOf(status === "idle" ? "planning" : status);

    if (currentIndex < activeIndex) {
      return "done";
    }

    if (currentIndex === activeIndex) {
      return "active";
    }

    return "pending";
  };

  return [
    {
      id: "planning",
      label: "Building plan",
      status: getStepStatus("planning"),
    },
    {
      id: "approval",
      label: "Waiting for approval",
      status: getStepStatus("awaiting_approval"),
    },
    {
      id: "applying",
      label: "Applying changes to timeline",
      status: getStepStatus("applying"),
    },
  ];
}

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

*/

export function Editor({ slug }: EditorProps) {
  const playerRef = useRef<PlayerRef>(null);
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const scrubZoneRef = useRef<HTMLButtonElement | null>(null);
  const timelineMainRef = useRef<HTMLDivElement | null>(null);
  const timelineTracksRef = useRef<HTMLDivElement | null>(null);
  const suppressTrackClickUntilRef = useRef(0);

  const ui = useEditorUiState({ initialAssets: [] });
  const [videoSchema, setVideoSchema] = useState<VideoSchema>(() => localProjectGateway.createEmptyDraft(slug).schema);
  const [selectedTimelineTrack, setSelectedTimelineTrack] = useState<SelectedTimelineTrack | null>(null);
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null);
  const { setAssets } = ui;

  useEffect(() => {
    let isCancelled = false;

    void localProjectGateway.loadDraft(slug).then((snapshot) => {
      if (isCancelled) {
        return;
      }

      if (!snapshot?.schema) {
        setVideoSchema(localProjectGateway.createEmptyDraft(slug).schema);
        return;
      }

      const normalizedDraft = normalizeOverlayTimeline(snapshot.schema);
      setVideoSchema(normalizedDraft);
    });

    return () => {
      isCancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const schemaAssets = collectAssetsFromSchema(videoSchema);

    setAssets((currentAssets) => {
      const retainedManualAssets = currentAssets.filter((asset) => !asset.src || asset.source === "local");
      const mergedAssets = [...retainedManualAssets];

      for (const asset of schemaAssets) {
        const hasSameSource = mergedAssets.some((currentAsset) => currentAsset.src && currentAsset.src === asset.src);
        if (!hasSameSource) {
          mergedAssets.push(asset);
        }
      }

      return mergedAssets;
    });
  }, [setAssets, videoSchema]);

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

  const resolveTimelineDropPlacement = useCallback((clientX: number, clientY: number) => {
    const scrubRect = scrubZoneRef.current?.getBoundingClientRect();
    const tracksRect = timelineTracksRef.current?.getBoundingClientRect();
    if (!scrubRect || !tracksRect) {
      return {
        startFrame: playback.currentFrame,
        overlayLane: 0,
      };
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

    return { startFrame, overlayLane };
  }, [derived.sceneTracks, playback.currentFrame, playback.timelineFrameSpan]);

  const handleDropAssetToTimeline = useCallback((assetId: string, clientX: number, clientY: number) => {
    const { startFrame, overlayLane } = resolveTimelineDropPlacement(clientX, clientY);
    addAssetTrack(assetId, startFrame, overlayLane);
    playback.seekToFrame(startFrame);
  }, [addAssetTrack, playback, resolveTimelineDropPlacement]);

  const handleDropElementToTimeline = useCallback((payload: TimelineElementDrop, clientX: number, clientY: number) => {
    const { startFrame, overlayLane } = resolveTimelineDropPlacement(clientX, clientY);

    if (payload.kind === "text") {
      addTextTrack(startFrame, overlayLane);
    } else {
      addShapeTrack(payload.shape, startFrame, overlayLane);
    }

    playback.seekToFrame(startFrame);
  }, [addShapeTrack, addTextTrack, playback, resolveTimelineDropPlacement]);

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

  const chat = useEditorChat({
    videoSchema,
    setVideoSchema,
    setSelectedElementKey,
    setSelectedTimelineTrack,
    seekToFrame: playback.seekToFrame,
  });

  const handleSaveProject = () => {
    void localProjectGateway.saveDraft({
      slug,
      schema: videoSchema,
      updatedAt: new Date().toISOString(),
    });
    playback.seekToFrame(0);
  };

/*
  const handleApprovePlan = useCallback(async () => {
    if (!pendingAction || isChatLoading) {
      return;
    }

    setChatWorkflowStatus("applying");
    setPendingAction(null);

    if (pendingAction.element === "text") {
      addTextTrack(playback.currentFrame);
    } else if (pendingAction.element === "circle") {
      addShapeTrack("circle", playback.currentFrame);
    } else {
      addShapeTrack("rect", playback.currentFrame);
    }

    setChatWorkflowStatus("idle");
    setChatMessages((prev) => [
      ...prev,
      createChatMessage("assistant", "Готово. Элемент добавлен на дорожку в текущую позицию плейхеда."),
    ]);
  }, [addShapeTrack, addTextTrack, isChatLoading, pendingAction, playback.currentFrame]);

  const handleRejectPlan = useCallback(() => {
    if (!pendingAction || isChatLoading) {
      return;
    }

    setPendingAction(null);
    setChatWorkflowStatus("idle");
    setChatMessages((prev) => [
      ...prev,
      createChatMessage("assistant", "Plan cancelled. Tell me what to change differently and I will build a new one."),
    ]);
  }, [isChatLoading, pendingAction]);

  const handleChatSubmit = useCallback(async () => {
    const prompt = chatPrompt.trim();
    if (!prompt || isChatLoading) {
      return;
    }

    const userMessage = createChatMessage("user", prompt);
    const history = chatMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setChatMessages((prev) => [...prev, userMessage]);
    setChatPrompt("");

    if (pendingAction && isApprovalPrompt(prompt)) {
      await handleApprovePlan();
      return;
    }

    if (pendingAction && isRejectPrompt(prompt)) {
      handleRejectPlan();
      return;
    }

    setIsChatLoading(true);

    try {
      if (isSchemaGenerationRequest(prompt) || shouldUseEditWorkflow(prompt)) {
        setChatWorkflowStatus("planning");

        const schemaPrompt = prompt.startsWith("/schema")
          ? prompt.replace(new RegExp("^/schema\\s*", "i"), "").trim()
          : prompt;
        const data = await generateVideoSchema(
          schemaPrompt.length > 0 ? schemaPrompt : "Generate video schema based on recent chat context",
          videoSchema,
        );

        setChatWorkflowStatus("applying");
        const normalizedSchema = normalizeOverlayTimeline(data.schema);
        setVideoSchema(normalizedSchema);
        setSelectedElementKey(null);
        setSelectedTimelineTrack(null);
        playback.seekToFrame(0);
        setChatWorkflowStatus("idle");
        setChatMessages((prev) => [
          ...prev,
          createChatMessage("assistant", "Updated edit schema generated from your prompt and applied to the timeline."),
        ]);
        return;
      }

      const localAddIntent = detectLocalAddElementIntent(prompt);
      if (localAddIntent) {
        setChatWorkflowStatus("awaiting_approval");
        setPendingAction({
          kind: "local-add",
          element: localAddIntent,
          prompt,
        });
        setChatMessages((prev) => [...prev, createChatMessage("assistant", buildLocalAddPlanMessage(localAddIntent))]);
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
        history,
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
      setChatWorkflowStatus("idle");
      setChatMessages((prev) => [...prev, createChatMessage("assistant", `Error: ${message}`)]);
    } finally {
      setIsChatLoading(false);
    }
  }, [
    chatMessages,
    chatPrompt,
    handleApprovePlan,
    handleRejectPlan,
    isChatLoading,
    pendingAction,
    playback,
    videoSchema,
  ]);

*/

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
          chatMessages={chat.chatMessages}
          chatPrompt={chat.chatPrompt}
          onChatPromptChange={chat.setChatPrompt}
          onChatSubmit={chat.handleChatSubmit}
          isChatLoading={chat.isChatLoading}
          chatWorkflowStatus={chat.chatWorkflowStatus}
          chatWorkflowSteps={chat.chatWorkflowSteps}
          activeTab={ui.activeLeftTab}
          onTabChange={ui.setActiveLeftTab}
          assets={ui.assets}
          assetUploadInputRef={ui.assetUploadInputRef}
          onAssetUpload={ui.handleAssetUpload}
          onAddAssetToTimeline={(assetId) => addAssetTrack(assetId, playback.currentFrame)}
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
        onDropElementToTimeline={handleDropElementToTimeline}
        playheadLeftPx={playback.playheadLeftPx}
      />
    </div>
  );
}
