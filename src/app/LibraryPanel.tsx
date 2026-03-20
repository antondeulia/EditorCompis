import { DragEvent } from "react";

import { formatDurationFromFrames } from "./editor-asset-utils";
import { SidebarLibrarySection } from "./editor-types";
import { SidebarTimelineItem } from "@/features/timeline/lib/dragTransfer";
import styles from "./LibraryPanel.module.css";

interface LibraryPanelProps {
  sections: SidebarLibrarySection[];
  intro: string;
  onItemDragStart: (event: DragEvent<HTMLElement>, item: SidebarTimelineItem) => void;
  onItemDragEnd: () => void;
  onItemClick: (item: SidebarTimelineItem) => void;
}

export const LibraryPanel = ({
  sections,
  intro,
  onItemDragStart,
  onItemDragEnd,
  onItemClick,
}: LibraryPanelProps) => (
  <>
    <p className={styles.libraryIntro}>{intro}</p>
    <div className={styles.assetList}>
      {sections.map((section) => (
        <section key={section.id} className={styles.librarySection}>
          <h3 className={styles.librarySectionTitle}>{section.title}</h3>
          <div className={styles.libraryGrid}>
            {section.items.map((item) => (
              <article
                key={item.id}
                className={styles.libraryCard}
                draggable
                onDragStart={(event) => onItemDragStart(event, item.dragItem)}
                onDragEnd={onItemDragEnd}
                title="Drag to timeline"
                onClick={() => onItemClick(item.dragItem)}
              >
                <span className={styles.libraryCardIcon} aria-hidden="true">
                  {item.icon}
                </span>
                <div className={styles.libraryCardBody}>
                  <p className={styles.libraryCardTitle}>{item.title}</p>
                  <p className={styles.libraryCardDescription}>{item.description}</p>
                </div>
                <span className={styles.libraryCardMeta}>
                  {formatDurationFromFrames(item.dragItem.durationFrames)}
                </span>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  </>
);
