"use client";

import { DragEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { TimelineSequence } from "@/features/timeline/types/timeline";
import { TimelinePanel, createInitialTimelineSequence } from "@/features/timeline";
import {
  SidebarTimelineItem,
  clearCurrentTimelineDragItem,
  setCurrentTimelineDragItem,
} from "@/features/timeline/lib/dragTransfer";

import { SidebarNav } from "./SidebarNav";
import { SIDEBAR_ITEM_BY_ID, SIDEBAR_ITEMS, TOOL_PANEL_MIN_WIDTH } from "./editor-data";
import { appendTimelineItemToSequence } from "./editor-timeline-utils";
import { SidebarItemId } from "./editor-types";
import { EditorToolPanel } from "./components/EditorToolPanel/EditorToolPanel";
import { useAiEditController } from "./hooks/useAiEditController";
import { useAssetLibrary } from "./hooks/useAssetLibrary";
import { useResizableToolPanel } from "./hooks/useResizableToolPanel";
import { useTimelineJsonEditor } from "./hooks/useTimelineJsonEditor";
import styles from "./page.module.css";

const TIMELINE_DRAG_MIME = "application/x-timeline-item";

export default function Home() {
  const [activeItemId, setActiveItemId] = useState<SidebarItemId | null>("assets");
  const [timelineSequence, setTimelineSequence] = useState<TimelineSequence>(() =>
    createInitialTimelineSequence(),
  );
  const [timelinePanelKey, setTimelinePanelKey] = useState(0);

  const currentSequenceRef = useRef<TimelineSequence>(timelineSequence);

  const {
    assets,
    fileInputRef,
    isDragOver,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
  } = useAssetLibrary();
  const { handleResizeStart, toolPanelWidth, workspaceRef } = useResizableToolPanel({
    minWidth: TOOL_PANEL_MIN_WIDTH,
  });

  useEffect(() => {
    currentSequenceRef.current = timelineSequence;
  }, [timelineSequence]);

  const applyTimelineSequence = useCallback((nextSequence: TimelineSequence) => {
    currentSequenceRef.current = nextSequence;
    setTimelineSequence(nextSequence);
    setTimelinePanelKey((currentKey) => currentKey + 1);
  }, []);

  const {
    applyJson,
    clearJsonDraft,
    copyJson,
    jsonDraft,
    jsonStatus,
    loadCurrentJson,
    prepareJsonDraft,
    setJsonDraft,
  } = useTimelineJsonEditor({
    applySequence: applyTimelineSequence,
    getCurrentSequence: () => currentSequenceRef.current,
  });
  const {
    chatThreadEndRef,
    draft: aiDraft,
    handleInputKeyDown: handleAiInputKeyDown,
    handleSubmit: handleAiSubmit,
    isRequestInFlight: isAiRequestInFlight,
    isThinking: isAiThinking,
    messages: aiMessages,
    setDraft: setAiDraft,
  } = useAiEditController({
    applySequence: applyTimelineSequence,
    assets,
    getCurrentSequence: () => currentSequenceRef.current,
  });

  const activeItem = activeItemId ? SIDEBAR_ITEM_BY_ID.get(activeItemId) ?? null : null;

  const handleTimelineItemDragStart = useCallback(
    (event: DragEvent<HTMLElement>, item: SidebarTimelineItem) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(TIMELINE_DRAG_MIME, JSON.stringify(item));
      event.dataTransfer.setData("text/plain", item.label);
      setCurrentTimelineDragItem(item);
    },
    [],
  );

  const handleTimelineItemDragEnd = useCallback(() => {
    clearCurrentTimelineDragItem();
  }, []);

  const handleTimelineItemClick = useCallback(
    (item: SidebarTimelineItem) => {
      const nextSequence = appendTimelineItemToSequence(currentSequenceRef.current, item);
      if (!nextSequence) {
        return;
      }

      applyTimelineSequence(nextSequence);
    },
    [applyTimelineSequence],
  );

  const handleSidebarItemClick = useCallback((itemId: SidebarItemId) => {
    setActiveItemId((currentItemId) => {
      const nextItemId = currentItemId === itemId ? null : itemId;

      if (nextItemId === "json") {
        prepareJsonDraft();
      }

      return nextItemId;
    });
  }, [prepareJsonDraft]);

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
            <aside className={styles.toolPanel}>
              <EditorToolPanel
                activeItemId={activeItem.id}
                activeItemLabel={activeItem.label}
                aiDraft={aiDraft}
                aiMessages={aiMessages}
                assets={assets}
                chatThreadEndRef={chatThreadEndRef}
                fileInputRef={fileInputRef}
                isAiRequestInFlight={isAiRequestInFlight}
                isAiThinking={isAiThinking}
                isDragOver={isDragOver}
                jsonDraft={jsonDraft}
                jsonStatus={jsonStatus}
                onAiDraftChange={setAiDraft}
                onAiInputKeyDown={handleAiInputKeyDown}
                onAiSubmit={handleAiSubmit}
                onFileInputChange={handleFileInputChange}
                onJsonApply={applyJson}
                onJsonClear={clearJsonDraft}
                onJsonCopy={copyJson}
                onJsonDraftChange={setJsonDraft}
                onJsonLoadCurrent={loadCurrentJson}
                onPanelDragLeave={handleDragLeave}
                onPanelDragOver={handleDragOver}
                onPanelDrop={handleDrop}
                onTimelineItemClick={handleTimelineItemClick}
                onTimelineItemDragEnd={handleTimelineItemDragEnd}
                onTimelineItemDragStart={handleTimelineItemDragStart}
              />
            </aside>
            <div
              className={styles.toolPanelResizeHandle}
              onPointerDown={handleResizeStart}
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
