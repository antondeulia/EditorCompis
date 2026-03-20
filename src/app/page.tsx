"use client";

import {
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { applyEditingSchemaToTimeline } from "@/features/ai-editing/services/applyEditingSchemaToTimeline";
import { EditingSchema } from "@/features/ai-editing/types/editingSchema";
import { TimelinePanel, createInitialTimelineSequence } from "@/features/timeline";
import {
  SidebarTimelineItem,
  clearCurrentTimelineDragItem,
  setCurrentTimelineDragItem,
} from "@/features/timeline/lib/dragTransfer";
import { TimelineSequence } from "@/features/timeline/types/timeline";

import { AiEditPanel } from "./AiEditPanel";
import { AssetPanel } from "./AssetPanel";
import {
  ELEMENT_LIBRARY_SECTIONS,
  SIDEBAR_ITEMS,
  STREAMING_CHUNK_SIZE,
  STREAMING_STEP_MS,
  SUBTITLE_REQUEST_PATTERN,
  TEXT_LIBRARY_SECTIONS,
  TOOL_PANEL_MIN_WIDTH,
} from "./editor-data";
import {
  buildAiAssetContext,
  createAssetItem,
  getTranscriptionCandidate,
} from "./editor-asset-utils";
import {
  appendTimelineItemToSequence,
  hasTimelineChanged,
  isTimelineSequence,
} from "./editor-timeline-utils";
import {
  createSubtitleEditingSchemaFromTranscript,
  createTranscriptionAudioFile,
  parseSubtitleGenerationPreferences,
} from "./editor-subtitles";
import {
  AiEditMessage,
  AiEditRouteResponse,
  AiEditStreamEvent,
  AssetItem,
  SidebarItemId,
  TranscriptSegment,
  TranscriptWord,
  TranscriptionRouteResponse,
} from "./editor-types";
import { JsonPanel } from "./JsonPanel";
import { LibraryPanel } from "./LibraryPanel";
import { SidebarNav } from "./SidebarNav";
import styles from "./page.module.css";

const TIMELINE_DRAG_MIME = "application/x-timeline-item";

export default function Home() {
  const [activeItemId, setActiveItemId] = useState<SidebarItemId | null>("assets");
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [timelineSequence, setTimelineSequence] = useState<TimelineSequence>(() =>
    createInitialTimelineSequence(),
  );
  const [timelinePanelKey, setTimelinePanelKey] = useState(0);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);
  const [aiMessageDraft, setAiMessageDraft] = useState("");
  const [aiMessages, setAiMessages] = useState<AiEditMessage[]>([]);
  const [, setAiStatus] = useState<string | null>(null);
  const [isAiRequestInFlight, setIsAiRequestInFlight] = useState(false);
  const [showAiThinking, setShowAiThinking] = useState(false);
  const [toolPanelWidth, setToolPanelWidth] = useState(360);
  const [transcriptByAssetId, setTranscriptByAssetId] = useState<Record<string, TranscriptSegment[]>>({});
  const [transcriptWordsByAssetId, setTranscriptWordsByAssetId] = useState<Record<string, TranscriptWord[]>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const chatThreadEndRef = useRef<HTMLDivElement | null>(null);
  const currentSequenceRef = useRef<TimelineSequence>(timelineSequence);

  const activeItem = SIDEBAR_ITEMS.find((item) => item.id === activeItemId) ?? null;

  useEffect(() => {
    currentSequenceRef.current = timelineSequence;
  }, [timelineSequence]);

  useEffect(() => {
    return () => {
      assets.forEach((asset) => {
        if (asset.previewUrl) {
          URL.revokeObjectURL(asset.previewUrl);
        }
      });
    };
  }, [assets]);

  useEffect(() => {
    chatThreadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aiMessages, isAiRequestInFlight]);

  useEffect(() => {
    const clampToolPanelWidth = () => {
      const workspaceWidth = workspaceRef.current?.clientWidth ?? 0;
      if (!workspaceWidth) {
        return;
      }

      const maxAllowedWidth = Math.max(TOOL_PANEL_MIN_WIDTH, Math.floor(workspaceWidth * 0.5));
      setToolPanelWidth((currentWidth) =>
        Math.min(Math.max(currentWidth, TOOL_PANEL_MIN_WIDTH), maxAllowedWidth),
      );
    };

    clampToolPanelWidth();
    window.addEventListener("resize", clampToolPanelWidth);

    return () => {
      window.removeEventListener("resize", clampToolPanelWidth);
    };
  }, []);

  const streamAssistantText = async (fullText: string) => {
    const text = fullText.trim();
    if (!text) {
      return;
    }

    setShowAiThinking(false);

    const messageId = `assistant-${crypto.randomUUID()}`;
    setAiMessages((currentMessages) => [...currentMessages, { id: messageId, role: "assistant", text: "" }]);

    let cursor = 0;
    while (cursor < text.length) {
      cursor = Math.min(cursor + STREAMING_CHUNK_SIZE, text.length);
      const nextText = text.slice(0, cursor);
      setAiMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === messageId ? { ...message, text: nextText } : message,
        ),
      );

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, STREAMING_STEP_MS);
      });
    }
  };

  const appendFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const nextAssets = await Promise.all(Array.from(files).map(createAssetItem));
    setAssets((currentAssets) => [...currentAssets, ...nextAssets]);
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void appendFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    void appendFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleTimelineItemDragStart = (event: DragEvent<HTMLElement>, item: SidebarTimelineItem) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(TIMELINE_DRAG_MIME, JSON.stringify(item));
    event.dataTransfer.setData("text/plain", item.label);
    setCurrentTimelineDragItem(item);
  };

  const handleTimelineItemDragEnd = () => {
    clearCurrentTimelineDragItem();
  };

  const handleTimelineItemClick = (item: SidebarTimelineItem) => {
    const nextSequence = appendTimelineItemToSequence(currentSequenceRef.current, item);
    if (!nextSequence) {
      return;
    }

    currentSequenceRef.current = nextSequence;
    setTimelineSequence(nextSequence);
    setTimelinePanelKey((current) => current + 1);
  };

  const handleLoadCurrentJson = () => {
    setJsonDraft(JSON.stringify(currentSequenceRef.current, null, 2));
    setJsonStatus("Loaded current timeline JSON.");
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonDraft);
      setJsonStatus("JSON copied to clipboard.");
    } catch {
      setJsonStatus("Unable to copy JSON. Browser blocked clipboard access.");
    }
  };

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonDraft);

      if (!isTimelineSequence(parsed)) {
        setJsonStatus("JSON schema is invalid for timeline sequence.");
        return;
      }

      setTimelineSequence(parsed);
      currentSequenceRef.current = parsed;
      setTimelinePanelKey((current) => current + 1);
      setJsonStatus("Timeline updated from JSON.");
    } catch {
      setJsonStatus("JSON parse error. Check syntax and try again.");
    }
  };

  const handleAiInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (!isAiRequestInFlight) {
      void handleAiEditSubmit();
    }
  };

  const handleToolPanelResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!workspaceRef.current) {
      return;
    }

    event.preventDefault();

    const startX = event.clientX;
    const startWidth = toolPanelWidth;
    const maxWidth = Math.max(TOOL_PANEL_MIN_WIDTH, Math.floor(workspaceRef.current.clientWidth * 0.5));

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      setToolPanelWidth(
        Math.min(Math.max(startWidth + delta, TOOL_PANEL_MIN_WIDTH), maxWidth),
      );
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleAiEditSubmit = async () => {
    const trimmedMessage = aiMessageDraft.trim();
    if (!trimmedMessage) {
      return;
    }

    const userMessage: AiEditMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: "user",
      text: trimmedMessage,
    };

    setAiMessages((currentMessages) => [...currentMessages, userMessage]);
    setAiMessageDraft("");
    setAiStatus("Generating editing schema...");
    setIsAiRequestInFlight(true);
    setShowAiThinking(true);

    try {
      const isSubtitleRequest = SUBTITLE_REQUEST_PATTERN.test(trimmedMessage);
      let transcriptSegments: TranscriptSegment[] = [];
      let transcriptWords: TranscriptWord[] = [];

      if (isSubtitleRequest) {
        const transcriptionAsset = getTranscriptionCandidate(assets);

        if (!transcriptionAsset) {
          await streamAssistantText("Cannot create real subtitles: no video or audio source was found for transcription.");
          setAiStatus("Transcription source is missing.");
          return;
        }

        const cachedTranscript = transcriptByAssetId[transcriptionAsset.id];
        const cachedWords = transcriptWordsByAssetId[transcriptionAsset.id];

        if (cachedTranscript && cachedTranscript.length > 0) {
          transcriptSegments = cachedTranscript;
          transcriptWords = cachedWords ?? [];
        } else {
          setAiStatus(`Transcribing ${transcriptionAsset.file.name}...`);

          const preparedTranscriptionFile = await createTranscriptionAudioFile(transcriptionAsset.file);
          const transcriptionForm = new FormData();
          transcriptionForm.append("file", preparedTranscriptionFile, preparedTranscriptionFile.name);

          const transcriptionResponse = await fetch("/api/transcribe", {
            method: "POST",
            body: transcriptionForm,
          });

          const transcriptionPayload = (await transcriptionResponse.json()) as TranscriptionRouteResponse;

          if (!transcriptionResponse.ok || !transcriptionPayload.segments?.length) {
            const errorText = transcriptionPayload.error ?? "Transcription request failed.";
            const extraDetails = transcriptionPayload.details ? ` ${transcriptionPayload.details}` : "";
            await streamAssistantText(`${errorText}${extraDetails}`.trim());
            setAiStatus("Transcription failed.");
            return;
          }

          transcriptSegments = transcriptionPayload.segments;
          transcriptWords = Array.isArray(transcriptionPayload.words) ? transcriptionPayload.words : [];
          setTranscriptByAssetId((current) => ({
            ...current,
            [transcriptionAsset.id]: transcriptionPayload.segments ?? [],
          }));
          setTranscriptWordsByAssetId((current) => ({
            ...current,
            [transcriptionAsset.id]: transcriptionPayload.words ?? [],
          }));
        }

        const subtitlePreferences = parseSubtitleGenerationPreferences(trimmedMessage);
        const directSubtitleSchema = createSubtitleEditingSchemaFromTranscript(
          transcriptSegments,
          transcriptWords,
          currentSequenceRef.current,
          subtitlePreferences,
        );

        const previousSequence = currentSequenceRef.current;
        const nextSequence = applyEditingSchemaToTimeline(previousSequence, directSubtitleSchema);

        if (!hasTimelineChanged(previousSequence, nextSequence)) {
          await streamAssistantText("The subtitle request did not produce timeline changes. Try being more specific about style or placement.");
          setAiStatus("Subtitle schema produced no timeline changes.");
          return;
        }

        setTimelineSequence(nextSequence);
        currentSequenceRef.current = nextSequence;
        setTimelinePanelKey((current) => current + 1);
        await streamAssistantText(directSubtitleSchema.assistantMessage);
        setAiStatus("Real subtitle track applied from transcript.");
        return;
      }

      let assistantMessageId: string | null = null;
      let hasReceivedAssistantDelta = false;

      const ensureAssistantMessage = () => {
        if (assistantMessageId) {
          return assistantMessageId;
        }

        const nextId = `assistant-${crypto.randomUUID()}`;
        assistantMessageId = nextId;
        setAiMessages((currentMessages) => [...currentMessages, { id: nextId, role: "assistant", text: "" }]);
        return nextId;
      };

      const patchAssistantMessage = (applyPatchToText: (previousText: string) => string) => {
        const targetMessageId = ensureAssistantMessage();
        setAiMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === targetMessageId
              ? { ...message, text: applyPatchToText(message.text) }
              : message,
          ),
        );
      };

      const response = await fetch("/api/ai-edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userMessage: trimmedMessage,
          assets: buildAiAssetContext(assets),
          currentSequence: currentSequenceRef.current,
          transcriptSegments,
        }),
      });

      if (!response.ok) {
        setShowAiThinking(false);
        let fallbackError = "AI Edit request failed.";

        try {
          const payload = (await response.json()) as AiEditRouteResponse;
          const errorText = payload.error ?? fallbackError;
          const extraDetails = payload.details ? ` ${payload.details}` : "";
          fallbackError = `${errorText}${extraDetails}`.trim();
        } catch {
          // Keep fallback text.
        }

        patchAssistantMessage(() => fallbackError);
        setAiStatus("Failed to apply AI editing schema.");
        return;
      }

      if (!response.body) {
        setShowAiThinking(false);
        patchAssistantMessage(() => "AI Edit stream is empty.");
        setAiStatus("Failed to apply AI editing schema.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let editingSchema: EditingSchema | null = null;
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        streamBuffer += decoder.decode(value, { stream: true });

        let lineBreakIndex = streamBuffer.indexOf("\n");
        while (lineBreakIndex !== -1) {
          const line = streamBuffer.slice(0, lineBreakIndex).trim();
          streamBuffer = streamBuffer.slice(lineBreakIndex + 1);

          if (line) {
            try {
              const streamEvent = JSON.parse(line) as AiEditStreamEvent;

              if (streamEvent.type === "assistant_delta" && typeof streamEvent.delta === "string") {
                if (!hasReceivedAssistantDelta) {
                  setShowAiThinking(false);
                }

                patchAssistantMessage((previousText) => {
                  if (!hasReceivedAssistantDelta) {
                    hasReceivedAssistantDelta = true;
                    return streamEvent.delta;
                  }

                  return previousText + streamEvent.delta;
                });
              } else if (streamEvent.type === "error") {
                setShowAiThinking(false);
                const details = streamEvent.details ? ` ${streamEvent.details}` : "";
                streamError = `${streamEvent.error}${details}`.trim();
                patchAssistantMessage(() => streamError ?? "AI Edit stream error.");
              } else if (streamEvent.type === "done") {
                setShowAiThinking(false);
                editingSchema = streamEvent.editingSchema;
                patchAssistantMessage(() => streamEvent.editingSchema.assistantMessage);
              }
            } catch {
              // Ignore malformed lines and keep parsing the stream.
            }
          }

          lineBreakIndex = streamBuffer.indexOf("\n");
        }
      }

      if (streamError) {
        setAiStatus("Failed to apply AI editing schema.");
        return;
      }

      if (!editingSchema) {
        patchAssistantMessage((previousText) => previousText || "AI Edit stream completed without schema.");
        setAiStatus("AI response did not include editing schema.");
        return;
      }

      const previousSequence = currentSequenceRef.current;
      const nextSequence = applyEditingSchemaToTimeline(previousSequence, editingSchema);

      if (!hasTimelineChanged(previousSequence, nextSequence)) {
        patchAssistantMessage((previousText) => {
          const fallbackText =
            "No timeline changes were produced. Try specifying exact cuts, clip order, timing, or track placement.";
          return previousText.trim().length > 0
            ? `${previousText}\n\n${fallbackText}`
            : fallbackText;
        });
        setAiStatus("AI schema produced no timeline changes.");
        return;
      }

      setTimelineSequence(nextSequence);
      currentSequenceRef.current = nextSequence;
      setTimelinePanelKey((current) => current + 1);
      setAiStatus("Editing schema applied to timeline.");
    } catch {
      setShowAiThinking(false);
      await streamAssistantText("Network error while requesting OpenAI API.");
      setAiStatus("Network error.");
    } finally {
      setIsAiRequestInFlight(false);
      setShowAiThinking(false);
    }
  };

  const handleSidebarItemClick = (itemId: SidebarItemId) => {
    setActiveItemId((currentId) => {
      const nextId = currentId === itemId ? null : itemId;

      if (nextId === "json") {
        setJsonDraft(JSON.stringify(currentSequenceRef.current, null, 2));
        setJsonStatus(null);
      }

      return nextId;
    });
  };

  const renderSidebarPanel = () => {
    if (!activeItem) {
      return null;
    }

    if (activeItem.id === "assets") {
      return (
        <AssetPanel
          assets={assets}
          isDragOver={isDragOver}
          fileInputRef={fileInputRef}
          onFileInputChange={handleFileInputChange}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onItemDragStart={handleTimelineItemDragStart}
          onItemDragEnd={handleTimelineItemDragEnd}
          onItemClick={handleTimelineItemClick}
        />
      );
    }

    if (activeItem.id === "ai-edit") {
      return (
        <AiEditPanel
          messages={aiMessages}
          draft={aiMessageDraft}
          isThinking={showAiThinking}
          isRequestInFlight={isAiRequestInFlight}
          chatThreadEndRef={chatThreadEndRef}
          onDraftChange={setAiMessageDraft}
          onInputKeyDown={handleAiInputKeyDown}
          onSubmit={handleAiEditSubmit}
        />
      );
    }

    if (activeItem.id === "elements") {
      return (
        <LibraryPanel
          sections={ELEMENT_LIBRARY_SECTIONS}
          intro="Drag any element to the matching timeline track."
          onItemDragStart={handleTimelineItemDragStart}
          onItemDragEnd={handleTimelineItemDragEnd}
          onItemClick={handleTimelineItemClick}
        />
      );
    }

    if (activeItem.id === "text") {
      return (
        <LibraryPanel
          sections={TEXT_LIBRARY_SECTIONS}
          intro="Ready-made typography presets: from H1 to subtitle and body."
          onItemDragStart={handleTimelineItemDragStart}
          onItemDragEnd={handleTimelineItemDragEnd}
          onItemClick={handleTimelineItemClick}
        />
      );
    }

    if (activeItem.id === "json") {
      return (
        <JsonPanel
          draft={jsonDraft}
          status={jsonStatus}
          onDraftChange={setJsonDraft}
          onLoadCurrent={handleLoadCurrentJson}
          onClear={() => setJsonDraft("")}
          onApply={handleApplyJson}
          onCopy={handleCopyJson}
        />
      );
    }

    return <p className={styles.toolPanelText}>Panel for {activeItem.label} will appear here.</p>;
  };

  return (
    <main className={styles.page}>
      <div ref={workspaceRef} className={styles.workspace}>
        <div className={styles.leftRail}>
          <header className={`${styles.columnHeader} ${styles.leftRailHeader}`} aria-label="Tools header">
            <span className={styles.topHeaderBrandMark} aria-hidden="true">
              V
            </span>
          </header>
          <SidebarNav
            items={SIDEBAR_ITEMS}
            activeItemId={activeItemId}
            onItemClick={handleSidebarItemClick}
          />
        </div>

        {activeItem ? (
          <div
            className={styles.toolPanelColumn}
            style={{ width: toolPanelWidth, minWidth: toolPanelWidth, maxWidth: toolPanelWidth }}
          >
            <header className={styles.columnHeader} aria-label="Panel header">
              <span className={styles.panelHeaderTitle}>{activeItem.label}</span>
            </header>
            <aside className={styles.toolPanel}>{renderSidebarPanel()}</aside>
            <div
              className={styles.toolPanelResizeHandle}
              onPointerDown={handleToolPanelResizeStart}
              role="separator"
              aria-label="Resize sidebar panel"
              aria-orientation="vertical"
            />
          </div>
        ) : null}

        <section className={styles.editorColumn}>
          <header className={`${styles.columnHeader} ${styles.editorHeader}`} aria-label="Preview header">
            <div className={styles.previewHeaderLeft}>
              <button type="button" className={styles.previewHeaderGhostButton} aria-label="Layout">
                []
              </button>
              <button type="button" className={styles.previewHeaderModeButton}>
                <span className={styles.previewHeaderModeDot} aria-hidden="true" />
                RVE
              </button>
            </div>
            <div className={styles.previewHeaderRight}>
              <button type="button" className={styles.previewHeaderGhostButton} aria-label="History">
                H
              </button>
              <button type="button" className={styles.previewHeaderGhostButton} aria-label="Notifications">
                N
              </button>
              <button type="button" className={styles.previewHeaderPrimaryAction}>
                Render Video
              </button>
            </div>
          </header>
          <div className={styles.editorContent}>
            <TimelinePanel
              key={timelinePanelKey}
              sequence={timelineSequence}
              onSequenceChange={(nextSequence) => {
                currentSequenceRef.current = nextSequence;
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
