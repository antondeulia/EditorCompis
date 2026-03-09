"use client";

import Link from "next/link";
import styles from "../../styles/editor.module.css";

type EditorTopBarProps = {
  slug: string;
  isLeftRailCollapsed: boolean;
  isInspectorCollapsed: boolean;
  onToggleLeftRail: () => void;
  onToggleInspector: () => void;
};

export function EditorTopBar({
  slug,
  isLeftRailCollapsed,
  isInspectorCollapsed,
  onToggleLeftRail,
  onToggleInspector,
}: EditorTopBarProps) {
  return (
    <header className={styles.topBar}>
      <nav className={styles.menuBar} aria-label="Editor menu">
        <Link
          href={{ pathname: "/", query: { project: slug } }}
          className={styles.backToProjectButton}
          aria-label="Back to project"
          title="Back to project"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10.5 3.2L5.5 8l5 4.8V3.2z" />
          </svg>
        </Link>
        <button type="button">File</button>
        <button type="button">View</button>
        <button type="button">Tools</button>
        <button type="button">Packages</button>
        <button type="button">Help</button>
      </nav>
      <div className={styles.projectTitle}>{slug}</div>
      <div className={styles.topBarActions}>
        <button
          type="button"
          className={styles.topBarIconButton}
          onClick={onToggleLeftRail}
          aria-label={isLeftRailCollapsed ? "Expand left sidebar" : "Collapse left sidebar"}
          title={isLeftRailCollapsed ? "Expand left sidebar" : "Collapse left sidebar"}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2" y="3" width="12" height="10" rx="1.3" />
            <path d="M6 3v10" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.topBarIconButton}
          onClick={onToggleInspector}
          aria-label={isInspectorCollapsed ? "Expand timeline inspector" : "Collapse timeline inspector"}
          title={isInspectorCollapsed ? "Expand timeline inspector" : "Collapse timeline inspector"}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2" y="3" width="12" height="10" rx="1.3" />
            <path d="M10 3v10" />
          </svg>
        </button>
      </div>
    </header>
  );
}


