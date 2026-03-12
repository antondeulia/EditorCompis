"use client";

import { PointerEvent, useEffect, useRef } from "react";
import styles from "../../styles/editor.module.css";

type EditorLeftRailProps = {
  isCollapsed: boolean;
  isResizing: boolean;
  onResizeStart: (event: PointerEvent<HTMLButtonElement>) => void;
  isChatScrollbarVisible: boolean;
  onChatScroll: () => void;
  chatMessages: {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string | null;
  }[];
  chatPrompt: string;
  onChatPromptChange: (value: string) => void;
  onChatSubmit: () => void;
  isChatLoading: boolean;
};

function formatChatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
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
}: EditorLeftRailProps) {
  const chatBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chatBodyRef.current) {
      return;
    }

    chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [chatMessages, isChatLoading]);

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
          <div className={styles.chatIdentity}>
            <span className={styles.chatAvatar} aria-hidden="true" />
            <span className={styles.chatName}>Workspace agent</span>
          </div>
        </header>

        <div
          ref={chatBodyRef}
          className={`${styles.chatBody} ${isChatScrollbarVisible ? styles.chatBodyScrollbarVisible : ""}`}
          onScroll={onChatScroll}
        >
          <div className={styles.chatMessages}>
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`${styles.chatMessage} ${message.role === "user" ? styles.chatMessageUser : styles.chatMessageAssistant}`}
              >
                <div className={styles.chatBubble}>{message.content}</div>
                {message.createdAt ? <div className={styles.chatTime}>{formatChatTime(message.createdAt)}</div> : null}
              </div>
            ))}
            {isChatLoading ? (
              <div className={`${styles.chatMessage} ${styles.chatMessageAssistant}`}>
                <div className={`${styles.chatBubble} ${styles.chatTyping}`}>Compis is typing...</div>
              </div>
            ) : null}
          </div>
        </div>

        <footer className={styles.chatComposer}>
          <div className={styles.chatComposerInput}>
            <textarea
              placeholder="What changes would you like?"
              rows={3}
              value={chatPrompt}
              onChange={(event) => onChatPromptChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onChatSubmit();
                }
              }}
              disabled={isChatLoading}
            />
            <button
              type="button"
              className={styles.chatComposerSendButton}
              onClick={onChatSubmit}
              disabled={isChatLoading}
              aria-label="Send message"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 15V5" />
                <path d="M6.5 8.5L10 5L13.5 8.5" />
              </svg>
            </button>
          </div>
        </footer>
      </div>
    </aside>
  );
}


