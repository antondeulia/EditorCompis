"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./Sidebar.module.css";

type MenuItem = {
  label: string;
  iconPath: string;
};

const menu: MenuItem[] = [
  {
    label: "Dashboard",
    iconPath:
      "M3 12.5h8v8H3v-8Zm10.5-9h7.5V11h-7.5V3.5ZM3 3.5h8V11H3V3.5Zm10.5 9h7.5v8h-7.5v-8Z",
  },
  {
    label: "Projects",
    iconPath:
      "M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm2.5-1a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-8h-5.5a2 2 0 0 1-2-2V5.5h-6.5Z",
  },
  {
    label: "Media",
    iconPath:
      "M4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-13A1.5 1.5 0 0 1 4.5 4Zm0 1.5v13h15v-13h-15Zm3.5 2.75a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Zm-2 8.75 3.25-3.25 2.25 2.25 3.5-3.5L18 17H6Z",
  },
  {
    label: "Teams",
    iconPath:
      "M8 7.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5Zm8 1a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5ZM4 18a4 4 0 0 1 8 0v1H4v-1Zm10 1v-1a3 3 0 0 0-1.4-2.55A3.5 3.5 0 0 1 20 18v1h-6Z",
  },
  {
    label: "Settings",
    iconPath:
      "M10.9 3h2.2l.42 2.02c.43.13.84.3 1.22.52l1.85-1.01 1.55 1.55-1.01 1.85c.22.38.39.79.52 1.22L20.7 9.6v2.2l-2.02.42c-.13.43-.3.84-.52 1.22l1.01 1.85-1.55 1.55-1.85-1.01c-.38.22-.79.39-1.22.52L13.1 21h-2.2l-.42-2.02a6.96 6.96 0 0 1-1.22-.52l-1.85 1.01-1.55-1.55 1.01-1.85a6.96 6.96 0 0 1-.52-1.22L3.3 11.8V9.6l2.02-.42c.13-.43.3-.84.52-1.22L4.83 6.1l1.55-1.55 1.85 1.01c.38-.22.79-.39 1.22-.52L10.9 3Zm1.1 5a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z",
  },
];

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside className={`${styles.sidebar} ${isExpanded ? styles.sidebarExpanded : ""}`}>
      <div className={styles.sidebarBrandRow}>
        <div className={styles.sidebarBrand}>O</div>
        {isExpanded ? (
          <span className={styles.sidebarEmail}>anton.deulia06@gmail.com</span>
        ) : null}
      </div>
      <nav aria-label="Sidebar Navigation" className={styles.sidebarNav}>
        <ul className={styles.sidebarList}>
          {menu.map((item) => (
            <li key={item.label}>
              <Link
                href="/"
                className={
                  item.label === "Projects"
                    ? `${styles.sidebarLink} ${styles.sidebarLinkActive}`
                    : styles.sidebarLink
                }
                aria-label={isExpanded ? undefined : item.label}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  className={styles.sidebarIcon}
                  aria-hidden="true"
                >
                  <path fill="currentColor" d={item.iconPath} />
                </svg>
                <span className={styles.sidebarText}>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <button
        type="button"
        className={styles.sidebarMore}
        aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`${styles.sidebarToggleIcon} ${
            isExpanded ? styles.sidebarToggleIconExpanded : ""
          }`}
        >
          <path
            fill="currentColor"
            d="M8.5 5.5 15 12l-6.5 6.5 1.4 1.4 7.9-7.9-7.9-7.9-1.4 1.4Z"
          />
        </svg>
      </button>
    </aside>
  );
}
