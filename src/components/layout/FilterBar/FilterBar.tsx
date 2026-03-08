import styles from "./FilterBar.module.css";

type FilterBarProps = {
  searchPlaceholder: string;
  filters: string[];
};

export function FilterBar({ searchPlaceholder, filters }: FilterBarProps) {
  const primaryFilter = searchPlaceholder.toLowerCase().includes("project")
    ? "Project progress"
    : (filters[0] ?? "Newest");

  return (
    <div className={styles.filterBar}>
      <div className={styles.searchWrap}>
        <span className={styles.searchIconWrap} aria-hidden="true">
          <svg viewBox="0 0 24 24" className={styles.searchIcon}>
            <path
              fill="currentColor"
              d="M10.5 3a7.5 7.5 0 1 0 4.67 13.37l4.23 4.23 1.06-1.06-4.23-4.23A7.5 7.5 0 0 0 10.5 3Zm0 1.5a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"
            />
          </svg>
        </span>
        <input
          type="search"
          placeholder={searchPlaceholder}
          className={styles.searchInput}
          aria-label={searchPlaceholder}
        />
      </div>
      <div className={styles.filterActions}>
        <button type="button" className={styles.sortButton} aria-label="Sort projects">
          <span className={styles.sortLabel}>Sort by</span>
          <span className={styles.sortValue}>{primaryFilter}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M7 4h10v2H7V4Zm2 7h8v2H9v-2Zm3 7h5v2h-5v-2Z"
            />
          </svg>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="m7 10 5 5 5-5H7Z"
            />
          </svg>
        </button>
        <details className={styles.filterDropdown}>
          <summary className={styles.iconButton} aria-label="More filters">
            <span className={styles.iconBadge} />
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4 5h16v2l-6 6v5l-4 2v-7L4 7V5Zm3.2 2L12 11.8 16.8 7H7.2Z"
              />
            </svg>
          </summary>
          <ul className={styles.filterMenu}>
            {filters.map((filter) => (
              <li key={filter} className={styles.filterMenuItem}>
                <label>
                  <input type="checkbox" />
                  <span>{filter}</span>
                </label>
              </li>
            ))}
          </ul>
        </details>
        <button type="button" className={styles.iconButton} aria-label="List view">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M4 6h3v3H4V6Zm5 0h11v3H9V6Zm-5 5h3v3H4v-3Zm5 0h11v3H9v-3Zm-5 5h3v3H4v-3Zm5 0h11v3H9v-3Z"
            />
          </svg>
        </button>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.iconButtonMuted}`}
          aria-label="Grid view"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
