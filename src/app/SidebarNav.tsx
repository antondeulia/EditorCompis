import { ReactNode } from "react";

import { SidebarItemDefinition, SidebarItemId } from "./editor-types";
import styles from "./SidebarNav.module.css";

interface SidebarNavProps {
  items: SidebarItemDefinition[];
  activeItemId: SidebarItemId | null;
  onItemClick: (itemId: SidebarItemId) => void;
}

const SidebarNavIcon = ({ itemId }: { itemId: SidebarItemId }): ReactNode => {
  switch (itemId) {
    case "assets":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "ai-edit":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l1.9 4.7L19 9.6l-4.1 2.2L13 17l-1.9-5.2L7 9.6l5.1-1.9z" />
        </svg>
      );
    case "ai-tools":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6h12M6 12h12M6 18h12" />
          <circle cx="9" cy="6" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="11" cy="18" r="2" />
        </svg>
      );
    case "elements":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <circle cx="17" cy="7.5" r="3.5" />
          <path d="M4 20h16l-4-6H8z" />
        </svg>
      );
    case "text":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16M12 6v12M7 18h10" />
        </svg>
      );
    case "json":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 5c-2.3 0-3 1.5-3 3v2c0 1.4-.6 2-2 2 1.4 0 2 .6 2 2v2c0 1.5.7 3 3 3M14 5c2.3 0 3 1.5 3 3v2c0 1.4.6 2 2 2-1.4 0-2 .6-2 2v2c0 1.5-.7 3-3 3" />
        </svg>
      );
    default:
      return null;
  }
};

export const SidebarNav = ({ items, activeItemId, onItemClick }: SidebarNavProps) => (
  <aside className={styles.sidebar} aria-label="Editor tools">
    {items.map((item) => (
      <button
        key={item.id}
        type="button"
        className={`${styles.sidebarItem} ${activeItemId === item.id ? styles.sidebarItemActive : ""}`}
        onClick={() => onItemClick(item.id)}
        aria-label={item.label}
        title={item.label}
      >
        <span className={styles.sidebarIcon} aria-hidden="true">
          <SidebarNavIcon itemId={item.id} />
        </span>
        <span className={styles.sidebarItemLabel}>{item.label}</span>
      </button>
    ))}
  </aside>
);
