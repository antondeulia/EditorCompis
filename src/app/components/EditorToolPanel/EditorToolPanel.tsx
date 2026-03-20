import { ChangeEvent, DragEvent, KeyboardEvent, RefObject } from "react";

import { SidebarTimelineItem } from "@/features/timeline/lib/dragTransfer";

import { AiEditPanel } from "../../AiEditPanel";
import { AssetPanel } from "../../AssetPanel";
import {
  ELEMENT_LIBRARY_SECTIONS,
  TEXT_LIBRARY_SECTIONS,
} from "../../editor-data";
import { AiEditMessage, AssetItem, SidebarItemId } from "../../editor-types";
import { JsonPanel } from "../../JsonPanel";
import { LibraryPanel } from "../../LibraryPanel";
import styles from "./EditorToolPanel.module.css";

const LIBRARY_PANEL_BY_ID = new Map<
  SidebarItemId,
  { intro: string; sections: typeof ELEMENT_LIBRARY_SECTIONS | typeof TEXT_LIBRARY_SECTIONS }
>([
  [
    "elements",
    {
      sections: ELEMENT_LIBRARY_SECTIONS,
      intro: "Drag any element to the matching timeline track.",
    },
  ],
  [
    "text",
    {
      sections: TEXT_LIBRARY_SECTIONS,
      intro: "Ready-made typography presets: from H1 to subtitle and body.",
    },
  ],
]);

interface EditorToolPanelProps {
  activeItemId: SidebarItemId | null;
  activeItemLabel: string | null;
  aiDraft: string;
  aiMessages: AiEditMessage[];
  assets: AssetItem[];
  chatThreadEndRef: RefObject<HTMLDivElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isAiRequestInFlight: boolean;
  isAiThinking: boolean;
  isDragOver: boolean;
  jsonDraft: string;
  jsonStatus: string | null;
  onAiDraftChange: (value: string) => void;
  onAiInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onAiSubmit: () => Promise<void>;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onJsonApply: () => void;
  onJsonClear: () => void;
  onJsonCopy: () => Promise<void>;
  onJsonDraftChange: (value: string) => void;
  onJsonLoadCurrent: () => void;
  onPanelDragLeave: () => void;
  onPanelDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onPanelDrop: (event: DragEvent<HTMLDivElement>) => void;
  onTimelineItemClick: (item: SidebarTimelineItem) => void;
  onTimelineItemDragEnd: () => void;
  onTimelineItemDragStart: (event: DragEvent<HTMLElement>, item: SidebarTimelineItem) => void;
}

export const EditorToolPanel = ({
  activeItemId,
  activeItemLabel,
  aiDraft,
  aiMessages,
  assets,
  chatThreadEndRef,
  fileInputRef,
  isAiRequestInFlight,
  isAiThinking,
  isDragOver,
  jsonDraft,
  jsonStatus,
  onAiDraftChange,
  onAiInputKeyDown,
  onAiSubmit,
  onFileInputChange,
  onJsonApply,
  onJsonClear,
  onJsonCopy,
  onJsonDraftChange,
  onJsonLoadCurrent,
  onPanelDragLeave,
  onPanelDragOver,
  onPanelDrop,
  onTimelineItemClick,
  onTimelineItemDragEnd,
  onTimelineItemDragStart,
}: EditorToolPanelProps) => {
  if (!activeItemId) {
    return null;
  }

  if (activeItemId === "assets") {
    return (
      <AssetPanel
        assets={assets}
        isDragOver={isDragOver}
        fileInputRef={fileInputRef}
        onFileInputChange={onFileInputChange}
        onDrop={onPanelDrop}
        onDragOver={onPanelDragOver}
        onDragLeave={onPanelDragLeave}
        onItemDragStart={onTimelineItemDragStart}
        onItemDragEnd={onTimelineItemDragEnd}
        onItemClick={onTimelineItemClick}
      />
    );
  }

  if (activeItemId === "ai-edit") {
    return (
      <AiEditPanel
        messages={aiMessages}
        draft={aiDraft}
        isThinking={isAiThinking}
        isRequestInFlight={isAiRequestInFlight}
        chatThreadEndRef={chatThreadEndRef}
        onDraftChange={onAiDraftChange}
        onInputKeyDown={onAiInputKeyDown}
        onSubmit={onAiSubmit}
      />
    );
  }

  if (activeItemId === "json") {
    return (
      <JsonPanel
        draft={jsonDraft}
        status={jsonStatus}
        onDraftChange={onJsonDraftChange}
        onLoadCurrent={onJsonLoadCurrent}
        onClear={onJsonClear}
        onApply={onJsonApply}
        onCopy={onJsonCopy}
      />
    );
  }

  const libraryPanel = LIBRARY_PANEL_BY_ID.get(activeItemId);
  if (libraryPanel) {
    return (
      <LibraryPanel
        sections={libraryPanel.sections}
        intro={libraryPanel.intro}
        onItemDragStart={onTimelineItemDragStart}
        onItemDragEnd={onTimelineItemDragEnd}
        onItemClick={onTimelineItemClick}
      />
    );
  }

  return <p className={styles.fallbackText}>Panel for {activeItemLabel} will appear here.</p>;
};
