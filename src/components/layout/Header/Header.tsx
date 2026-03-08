import styles from "./Header.module.css";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brandRow}>
        <p className={styles.brand}>Editor Compis</p>
        <p className={styles.subtitle}>Video Editing Platform</p>
      </div>
      <div className={styles.headerSearch}>
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          aria-hidden="true"
          className={styles.searchIcon}
        >
          <path
            fill="currentColor"
            d="M10.5 3a7.5 7.5 0 1 0 4.67 13.37l4.23 4.23 1.06-1.06-4.23-4.23A7.5 7.5 0 0 0 10.5 3Zm0 1.5a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"
          />
        </svg>
        <input type="search" placeholder="Search" aria-label="Search" />
      </div>
      <nav className={styles.headerNav} aria-label="Header Navigation">
        <a href="#">Docs</a>
        <a href="#">Examples</a>
        <a href="#">Community</a>
      </nav>
      <ThemeToggle />
    </header>
  );
}
