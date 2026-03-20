import { KeyboardEvent, RefObject } from "react";

import { AiEditMessage } from "./editor-types";
import { MarkdownMessage } from "./MarkdownMessage";
import styles from "./AiEditPanel.module.css";

interface AiEditPanelProps {
  messages: AiEditMessage[];
  draft: string;
  isThinking: boolean;
  isRequestInFlight: boolean;
  chatThreadEndRef: RefObject<HTMLDivElement | null>;
  onDraftChange: (value: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => Promise<void>;
}

export const AiEditPanel = ({
  messages,
  draft,
  isThinking,
  isRequestInFlight,
  chatThreadEndRef,
  onDraftChange,
  onInputKeyDown,
  onSubmit,
}: AiEditPanelProps) => {
  const isEmpty = messages.length === 0;

  return (
    <div className={styles.chatShell}>
      <div className={`${styles.chatThread} ${isEmpty ? styles.chatThreadEmpty : ""}`}>
        {isEmpty && !isThinking ? (
          <div className={styles.chatEmptyState}>
            <div className={styles.chatEmptyLogo} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
                <path d="M7.2 7.2l9.6 9.6" />
                <path d="M16.8 7.2l-9.6 9.6" />
              </svg>
            </div>
          </div>
        ) : null}
        {messages.map((message) => (
          <div key={message.id} className={message.role === "user" ? styles.chatRowUser : styles.chatRowAssistant}>
            <article
              className={message.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant}
            >
              {message.role === "assistant" ? (
                <MarkdownMessage text={message.text} />
              ) : (
                <p className={styles.chatPlainText}>{message.text}</p>
              )}
            </article>
          </div>
        ))}
        <div ref={chatThreadEndRef} />
      </div>
      <div className={styles.chatComposer}>
        {isThinking ? <p className={styles.chatThinkingStatus}>Thinking...</p> : null}
        <div className={styles.chatInputWrap}>
          <textarea
            className={styles.chatInput}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Describe the edit you need..."
          />
          <button
            type="button"
            className={styles.chatSendInline}
            onClick={() => void onSubmit()}
            disabled={isRequestInFlight || draft.trim().length === 0}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h11" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
