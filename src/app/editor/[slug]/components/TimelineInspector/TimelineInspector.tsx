"use client";

import { PointerEvent } from "react";
import styles from "./TimelineInspector.module.css";

type TimelineInspectorProps = {
  currentTimeLabel: string;
  isResizing: boolean;
  onResizeStart: (event: PointerEvent<HTMLButtonElement>) => void;
};

const sequenceRows = ["Main.tsx:54", "Main.tsx:54", "Main.tsx:54", "Main.tsx:54"];

function EyeIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 8C2.7 5.9 5 4.5 8 4.5C11 4.5 13.3 5.9 14.5 8C13.3 10.1 11 11.5 8 11.5C5 11.5 2.7 10.1 1.5 8Z" />
      <circle cx="8" cy="8" r="1.8" />
    </svg>
  );
}

export function TimelineInspector({
  currentTimeLabel,
  isResizing,
  onResizeStart,
}: TimelineInspectorProps) {
  return (
    <aside className={styles.panel} aria-label="Timeline inspector">
      <button
        type="button"
        className={`${styles.resizeHandle} ${isResizing ? styles.resizeHandleActive : ""}`}
        onPointerDown={onResizeStart}
        aria-label="Resize timeline inspector"
      />
      <header className={styles.header}>
        <span>{currentTimeLabel}</span>
      </header>
      <div className={styles.list}>
        {sequenceRows.map((meta, index) => (
          <div key={`${meta}-${index}`} className={styles.row}>
            <EyeIcon />
            <span className={styles.sequenceLabel}>{"<Series.Sequence>"}</span>
            <span className={styles.sequenceMeta}>{meta}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
