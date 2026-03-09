"use client";

import { ChangeEvent } from "react";
import { elementsLibrarySections, rightSidebarSections, RightSidebarSection } from "../editor-constants";
import { ElementsLibraryIcon } from "../editor-types";
import { VideoElement } from "../video-schema";
import styles from "../page.module.css";

type EditorRightSidebarProps = {
  activeSection: RightSidebarSection;
  isPanelOpen: boolean;
  onSectionClick: (section: RightSidebarSection) => void;
  selectedTextElement: Extract<VideoElement, { kind: "text" }> | null;
  onTextChange: (value: string) => void;
  onFontSizeChange: (value: number) => void;
};

function renderElementsLibraryIcon(icon: ElementsLibraryIcon) {
  switch (icon) {
    case "triangle-outline":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3.5 3.7 15h12.6L10 3.5Z" />
        </svg>
      );
    case "circle-outline":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="6.3" />
        </svg>
      );
    case "square-outline":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="4.2" y="4.2" width="11.6" height="11.6" />
        </svg>
      );
    case "star-outline":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3.2 12 7.4l4.6.7-3.3 3.2.8 4.7-4.1-2.2-4.1 2.2.8-4.7-3.3-3.2 4.6-.7L10 3.2Z" />
        </svg>
      );
    case "triangle-solid":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3.5 3.7 15h12.6L10 3.5Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "circle-solid":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="6.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "square-solid":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="4.2" y="4.2" width="11.6" height="11.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "star-solid":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3.2 12 7.4l4.6.7-3.3 3.2.8 4.7-4.1-2.2-4.1 2.2.8-4.7-3.3-3.2 4.6-.7L10 3.2Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "arrow-right":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3.5 10h11M11 5.8l4.5 4.2-4.5 4.2" />
        </svg>
      );
    case "slash":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4.5 15.5 15.5 4.5" />
        </svg>
      );
    case "media":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3" y="5" width="8.8" height="10" rx="1.4" />
          <path d="M6.5 8.4 9.2 10l-2.7 1.6V8.4Z" />
          <rect x="9.8" y="8.2" width="7.2" height="7" rx="1.2" />
        </svg>
      );
    case "screen":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2.8" y="4.2" width="14.4" height="10" rx="1.4" />
          <path d="M8 16.3h4" />
          <circle cx="5.4" cy="6.8" r="0.7" fill="currentColor" stroke="none" />
          <circle cx="7.3" cy="6.8" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      );
    case "camera":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3" y="6" width="14" height="9" rx="1.6" />
          <circle cx="10" cy="10.5" r="2.2" />
          <path d="M6 6 7.2 4.8h5.6L14 6" />
        </svg>
      );
    case "timer":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M8 3.8h4M10 3.8v2" />
          <circle cx="10" cy="11" r="5.2" />
          <path d="M10 11 12.3 9.5" />
        </svg>
      );
    case "compose":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="2.8" y="5" width="14.4" height="10" rx="1.7" />
          <path d="M5.5 8h3.5M5.5 11h5.2M11.8 10.8l2.4-2.4M12.8 8.4l1.4 1.4" />
        </svg>
      );
    case "marker":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6 3.8h8v12.4l-4-2.6-4 2.6V3.8Z" />
        </svg>
      );
    case "speaker":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="6.2" cy="10.2" r="2" />
          <path d="M10.5 8.2c1.2.6 2 1.8 2 3.1M12.5 6.5c2 .9 3.3 2.8 3.3 5" />
        </svg>
      );
    case "wave-lines":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 10v2M7 7v6M10 5v10M13 7v6M16 9v2" />
        </svg>
      );
    case "ring":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="5.3" />
        </svg>
      );
    case "rings":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8" cy="9.4" r="4.5" />
          <circle cx="12.2" cy="11.2" r="4.5" />
        </svg>
      );
    case "wave":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3.5 10c1.2 0 1.2-2 2.4-2s1.2 4 2.4 4 1.2-4 2.4-4 1.2 4 2.4 4 1.2-2 2.4-2" />
        </svg>
      );
    case "bar":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3.2" y="7.2" width="13.6" height="5.6" rx="1.2" />
          <rect x="3.2" y="7.2" width="5.3" height="5.6" rx="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "spinner":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 4.2a5.8 5.8 0 1 0 5.8 5.8" />
          <circle cx="15.8" cy="10" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "pie":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="6.2" />
          <path d="M10 10V3.8a6.2 6.2 0 0 1 6.2 6.2H10Z" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export function EditorRightSidebar({
  activeSection,
  isPanelOpen,
  onSectionClick,
  selectedTextElement,
  onTextChange,
  onFontSizeChange,
}: EditorRightSidebarProps) {
  return (
    <aside className={`${styles.rightSidebar} ${styles.rightSidebarLight}`} aria-label="Editor tools">
      <div className={styles.rightSidebarTop}>
        {rightSidebarSections.map((section) => (
          <div key={section} className={styles.rightSidebarNavEntry}>
            <button
              type="button"
              className={`${styles.rightSidebarItem} ${isPanelOpen && activeSection === section ? styles.rightSidebarItemActive : ""}`}
              onClick={() => onSectionClick(section)}
              aria-pressed={isPanelOpen && activeSection === section}
            >
              <span className={styles.rightSidebarIcon} aria-hidden="true">
                {section === "Project" ? (
                  <svg viewBox="0 0 20 20">
                    <path d="M2.8 6.2a1.7 1.7 0 0 1 1.7-1.7h3.3l1.2 1.3h6.5a1.7 1.7 0 0 1 1.7 1.7v6.3a1.7 1.7 0 0 1-1.7 1.7H4.5a1.7 1.7 0 0 1-1.7-1.7V6.2Z" />
                  </svg>
                ) : null}
                {section === "AI Tools" ? (
                  <svg viewBox="0 0 20 20">
                    <path d="M10 2.5l1.3 3.3 3.2 1.3-3.2 1.3L10 11.7 8.7 8.4 5.5 7.1l3.2-1.3L10 2.5Z" />
                    <path d="M14.2 10.6l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8.8-1.8Z" />
                  </svg>
                ) : null}
                {section === "Properties" ? (
                  <svg viewBox="0 0 20 20">
                    <path d="M6 3.5v4m0 9v-4m8-9v9m-4-5v9" />
                    <circle cx="6" cy="9.2" r="1.4" />
                    <circle cx="14" cy="14.2" r="1.4" />
                    <circle cx="10" cy="5.8" r="1.4" />
                  </svg>
                ) : null}
                {section === "Elements" ? (
                  <svg viewBox="0 0 20 20">
                    <rect x="3.5" y="3.5" width="4.2" height="4.2" rx="0.8" />
                    <rect x="12.3" y="3.5" width="4.2" height="4.2" rx="0.8" />
                    <rect x="7.9" y="12.3" width="4.2" height="4.2" rx="0.8" />
                    <path d="M7.7 5.6h4.6M10 7.7v4.6" />
                  </svg>
                ) : null}
                {section === "Captions" ? (
                  <svg viewBox="0 0 20 20">
                    <rect x="2.8" y="4" width="14.4" height="12" rx="2" />
                    <path d="M6.5 8.8h4.8M6.5 11.7h3.2M13.8 9.6l3.4 2.4-3.4 2.4" />
                  </svg>
                ) : null}
                {section === "Media" ? (
                  <svg viewBox="0 0 20 20">
                    <rect x="2.8" y="4" width="8.5" height="12" rx="1.8" />
                    <path d="M7 8.2l2.6 1.8L7 11.8V8.2Z" />
                    <path d="M13.1 6.3h4.1M13.1 10h4.1M13.1 13.7h4.1" />
                  </svg>
                ) : null}
              </span>
              <span className={styles.rightSidebarItemLabel}>{section}</span>
            </button>
            {section === "Project" || section === "Properties" ? (
              <span className={styles.rightSidebarDivider} aria-hidden="true" />
            ) : null}
          </div>
        ))}
      </div>
      {isPanelOpen ? (
        <div className={styles.rightSidebarContent}>
          {activeSection === "Properties" ? (
            <section className={styles.rightSidebarEditor} aria-label="Element properties">
              <h3 className={styles.rightSidebarEditorTitle}>Properties</h3>
              {selectedTextElement ? (
                <>
                  <label className={styles.rightSidebarField}>
                    <span>Text</span>
                    <textarea value={selectedTextElement.text} rows={4} onChange={(event) => onTextChange(event.target.value)} />
                  </label>
                  <label className={styles.rightSidebarField}>
                    <span>Font size</span>
                    <input
                      type="number"
                      min={8}
                      max={300}
                      step={1}
                      value={selectedTextElement.fontSize ?? 44}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        const nextSize = Number(event.target.value);
                        if (!Number.isFinite(nextSize)) {
                          return;
                        }

                        onFontSizeChange(nextSize);
                      }}
                    />
                  </label>
                </>
              ) : (
                <p className={styles.rightSidebarEditorHint}>Select a text element on canvas to edit it.</p>
              )}
            </section>
          ) : activeSection === "Elements" ? (
            <section className={styles.elementsLibraryPanel} aria-label="Elements panel">
              <header className={styles.elementsLibraryHeader}>
                <span className={styles.elementsLibraryHeaderIcon} aria-hidden="true">
                  <svg viewBox="0 0 20 20">
                    <rect x="3.5" y="3.5" width="4.2" height="4.2" rx="0.8" />
                    <rect x="12.3" y="3.5" width="4.2" height="4.2" rx="0.8" />
                    <rect x="7.9" y="12.3" width="4.2" height="4.2" rx="0.8" />
                    <path d="M7.7 5.6h4.6M10 7.7v4.6" />
                  </svg>
                </span>
                <h3 className={styles.elementsLibraryHeaderTitle}>Elements</h3>
              </header>
              <div className={styles.elementsLibraryGroups}>
                {elementsLibrarySections.map((group) => (
                  <section key={group.title} className={styles.elementsLibraryGroup}>
                    <div className={styles.elementsLibraryGroupHeader}>
                      <h4 className={styles.elementsLibraryGroupTitle}>{group.title}</h4>
                      {group.showInfo ? (
                        <span className={styles.elementsLibraryInfo} aria-hidden="true">
                          i
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={`${styles.elementsLibraryGrid} ${
                        group.items.length === 3 ? styles.elementsLibraryGridThree : ""
                      }`}
                    >
                      {group.items.map((item, index) => (
                        <button
                          key={`${group.title}-${item.label || item.icon || index}`}
                          type="button"
                          className={styles.elementsLibraryCard}
                        >
                          {item.icon ? (
                            <span className={styles.elementsLibraryCardIcon}>{renderElementsLibraryIcon(item.icon)}</span>
                          ) : null}
                          {item.label ? (
                            <span
                              className={`${styles.elementsLibraryCardLabel} ${
                                item.emphasis ? styles.elementsLibraryCardLabelEmphasis : ""
                              }`}
                            >
                              {item.label}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ) : (
            <section className={styles.rightSidebarEditor} aria-label={`${activeSection} panel`}>
              <h3 className={styles.rightSidebarEditorTitle}>{activeSection}</h3>
              <p className={styles.rightSidebarEditorHint}>
                {activeSection === "Project"
                  ? "Scene and project options are shown in this panel."
                  : activeSection === "AI Tools"
                    ? "Run AI actions for script, visuals and timing."
                    : activeSection === "Elements"
                      ? "Manage elements and layer ordering here."
                      : activeSection === "Captions"
                        ? "Configure subtitle style, timing and position."
                        : "Browse uploaded files and media library."}
              </p>
            </section>
          )}
        </div>
      ) : null}
      <button type="button" className={`${styles.rightSidebarItem} ${styles.rightSidebarAgent}`}>
        <span className={styles.rightSidebarIcon} aria-hidden="true">
          <svg viewBox="0 0 20 20">
            <rect x="5" y="7.2" width="10" height="7.8" rx="2" />
            <circle cx="8" cy="11.1" r="0.9" />
            <circle cx="12" cy="11.1" r="0.9" />
            <path d="M10 3v2.2M3.7 10h1.8M14.5 10h1.8" />
          </svg>
        </span>
        <span className={styles.rightSidebarItemLabel}>Underlord</span>
      </button>
    </aside>
  );
}
