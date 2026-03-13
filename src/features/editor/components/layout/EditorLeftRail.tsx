"use client";

import { ChangeEvent, PointerEvent, RefObject } from "react";
import { AssetsPanel } from "../assets/AssetsPanel";
import { AssetItem } from "../../model/types";
import { ChatMessage, ChatWorkflowStatus, ChatWorkflowStep } from "../../model/chat";
import { EditorChatPanel } from "../chat/EditorChatPanel";
import styles from "../../styles/editor.module.css";

type EditorLeftRailProps = {
  isCollapsed: boolean;
  isResizing: boolean;
  onResizeStart: (event: PointerEvent<HTMLButtonElement>) => void;
  isChatScrollbarVisible: boolean;
  onChatScroll: () => void;
  chatMessages: ChatMessage[];
  chatPrompt: string;
  onChatPromptChange: (value: string) => void;
  onChatSubmit: () => void;
  isChatLoading: boolean;
  chatWorkflowStatus: ChatWorkflowStatus;
  chatWorkflowSteps: ChatWorkflowStep[];
  activeTab: "chat" | "assets";
  onTabChange: (value: "chat" | "assets") => void;
  assets: AssetItem[];
  assetUploadInputRef: RefObject<HTMLInputElement | null>;
  onAssetUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddAssetToTimeline: (assetId: string) => void;
};

function IconMagic() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className={styles.magicIconPrimary} d="M12 2.7L13.9 7.3L18.5 9.2L13.9 11.1L12 15.7L10.1 11.1L5.5 9.2L10.1 7.3L12 2.7Z" />
      <path className={styles.magicIconSecondary} d="M18.2 13.8L19.3 16.7L22.2 17.8L19.3 18.9L18.2 21.8L17.1 18.9L14.2 17.8L17.1 16.7L18.2 13.8Z" />
      <path className={styles.magicIconSecondary} d="M6 14.6L6.8 16.4L8.6 17.2L6.8 18L6 19.8L5.2 18L3.4 17.2L5.2 16.4L6 14.6Z" />
    </svg>
  );
}

export function EditorLeftRail({
  isCollapsed,
  isResizing,
  onResizeStart,
  isChatScrollbarVisible,
  onChatScroll,
  chatMessages,
  chatPrompt,
  onChatPromptChange,
  onChatSubmit,
  isChatLoading,
  chatWorkflowStatus,
  chatWorkflowSteps,
  activeTab,
  onTabChange,
  assets,
  assetUploadInputRef,
  onAssetUpload,
  onAddAssetToTimeline,
}: EditorLeftRailProps) {
  return (
    <aside className={`${styles.leftRail} ${isCollapsed ? styles.leftRailCollapsed : ""}`}>
      <button
        type="button"
        className={`${styles.leftRailResizeHandle} ${isResizing ? styles.leftRailResizeHandleActive : ""}`}
        onPointerDown={onResizeStart}
        aria-label="Resize composition sidebar"
      />
      <div className={styles.chatPanel}>
        <header className={styles.chatHeader}>
          <div className={styles.panelTabs}>
            <button
              type="button"
              className={activeTab === "chat" ? styles.tabActive : styles.tab}
              onClick={() => onTabChange("chat")}
            >
              <span className={styles.tabWithIcon}>
                <IconMagic />
                <span>Edit with AI</span>
              </span>
            </button>
            <button
              type="button"
              className={activeTab === "assets" ? styles.tabActive : styles.tab}
              onClick={() => onTabChange("assets")}
            >
              Assets
            </button>
          </div>
        </header>

        {activeTab === "chat" ? (
          <EditorChatPanel
            messages={chatMessages}
            prompt={chatPrompt}
            onPromptChange={onChatPromptChange}
            onSubmit={onChatSubmit}
            isLoading={isChatLoading}
            workflowStatus={chatWorkflowStatus}
            workflowSteps={chatWorkflowSteps}
            isScrollbarVisible={isChatScrollbarVisible}
            onScroll={onChatScroll}
          />
        ) : (
          <AssetsPanel
            assets={assets}
            assetUploadInputRef={assetUploadInputRef}
            onAssetUpload={onAssetUpload}
            onAddAssetToTimeline={onAddAssetToTimeline}
          />
        )}
      </div>
    </aside>
  );
}


