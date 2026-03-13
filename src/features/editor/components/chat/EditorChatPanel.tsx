"use client";

import { useEffect, useRef } from "react";
import { ChatMessage, ChatWorkflowStatus, ChatWorkflowStep } from "../../model/chat";
import styles from "../../styles/editor.module.css";

type EditorChatPanelProps = {
  messages: ChatMessage[];
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  workflowStatus: ChatWorkflowStatus;
  workflowSteps: ChatWorkflowStep[];
  isScrollbarVisible: boolean;
  onScroll: () => void;
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

export function EditorChatPanel({
  messages,
  prompt,
  onPromptChange,
  onSubmit,
  isLoading,
  workflowStatus,
  workflowSteps,
  isScrollbarVisible,
  onScroll,
}: EditorChatPanelProps) {
  const chatBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chatBodyRef.current) {
      return;
    }

    chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [isLoading, messages]);

  return (
    <>
      <div
        ref={chatBodyRef}
        className={`${styles.chatBody} ${isScrollbarVisible ? styles.chatBodyScrollbarVisible : ""}`}
        onScroll={onScroll}
      >
        <div className={styles.chatMessages}>
          {workflowStatus !== "idle" ? (
            <section className={styles.chatWorkflowCard}>
              <div className={styles.chatWorkflowEyebrow}>AI edit workflow</div>
              <div className={styles.chatWorkflowSteps}>
                {workflowSteps.map((step) => (
                  <div
                    key={step.id}
                    className={`${styles.chatWorkflowStep} ${
                      step.status === "done"
                        ? styles.chatWorkflowStepDone
                        : step.status === "active"
                          ? styles.chatWorkflowStepActive
                          : ""
                    }`}
                  >
                    <span className={styles.chatWorkflowStepDot} aria-hidden="true" />
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`${styles.chatMessage} ${message.role === "user" ? styles.chatMessageUser : styles.chatMessageAssistant}`}
            >
              <div className={styles.chatBubble}>{message.content}</div>
              {message.createdAt ? <div className={styles.chatTime}>{formatChatTime(message.createdAt)}</div> : null}
            </div>
          ))}
          {isLoading && workflowStatus === "idle" ? (
            <div className={`${styles.chatMessage} ${styles.chatMessageAssistant}`}>
              <div className={`${styles.chatBubble} ${styles.chatTyping}`}>Compis is thinking...</div>
            </div>
          ) : null}
        </div>
      </div>

      <footer className={styles.chatComposer}>
        <div className={styles.chatComposerInput}>
          <textarea
            placeholder="Describe the edit you want"
            rows={3}
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
            disabled={isLoading || workflowStatus === "applying"}
          />
          <button
            type="button"
            className={styles.chatComposerSendButton}
            onClick={onSubmit}
            disabled={isLoading || workflowStatus === "applying"}
            aria-label="Send message"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 15V5" />
              <path d="M6.5 8.5L10 5L13.5 8.5" />
            </svg>
          </button>
        </div>
      </footer>
    </>
  );
}
