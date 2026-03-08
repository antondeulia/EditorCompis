import styles from "./NewVideoModalTemplateStep.module.css";
import { TemplateFilter, TemplateOption } from "./NewVideoModal.types";
import { NewVideoTemplateCard } from "./NewVideoTemplateCard";

type NewVideoModalTemplateStepProps = {
  currentStepLabel: string;
  templateSearch: string;
  onTemplateSearchChange: (value: string) => void;
  isFilterOpen: boolean;
  templateFilter: TemplateFilter;
  onToggleFilter: () => void;
  onSelectFilter: (filter: TemplateFilter) => void;
  filteredTemplates: TemplateOption[];
  selectedTemplateId: string | null;
  onTemplateSelect: (templateId: string) => void;
  onResetFilters: () => void;
  onBack: () => void;
};

export function NewVideoModalTemplateStep({
  currentStepLabel,
  templateSearch,
  onTemplateSearchChange,
  isFilterOpen,
  templateFilter,
  onToggleFilter,
  onSelectFilter,
  filteredTemplates,
  selectedTemplateId,
  onTemplateSelect,
  onResetFilters,
  onBack,
}: NewVideoModalTemplateStepProps) {
  return (
    <>
      <button
        type="button"
        className={styles.createVideoBackTop}
        aria-label="Back to step one"
        onClick={onBack}
      >
        Back
      </button>
      <h2 className={styles.createVideoHeading}>Choose a template</h2>
      <div className={styles.createVideoTemplateToolbar}>
        <input
          type="text"
          className={styles.createVideoTemplateSearch}
          placeholder="Search templates"
          value={templateSearch}
          onChange={(event) => onTemplateSearchChange(event.target.value)}
        />
        <div className={styles.createVideoTemplateFilterWrap}>
          <button
            type="button"
            className={styles.createVideoTemplateFilterButton}
            aria-label="Open template filters"
            onClick={onToggleFilter}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M3 5a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm3 7a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm4 7a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1Z"
              />
            </svg>
          </button>
          {isFilterOpen ? (
            <div className={styles.createVideoTemplateFilterMenu}>
              {(["all", "social", "marketing", "podcast"] as TemplateFilter[]).map(
                (filterOption) => (
                  <button
                    key={filterOption}
                    type="button"
                    className={
                      templateFilter === filterOption
                        ? `${styles.createVideoTemplateFilterItem} ${styles.createVideoTemplateFilterItemActive}`
                        : styles.createVideoTemplateFilterItem
                    }
                    onClick={() => onSelectFilter(filterOption)}
                  >
                    {filterOption[0].toUpperCase() + filterOption.slice(1)}
                  </button>
                ),
              )}
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.createVideoTemplateGridViewport}>
        <div className={styles.createVideoTemplateGrid}>
          {filteredTemplates.map((template) => (
            <NewVideoTemplateCard
              key={template.id}
              template={template}
              isActive={selectedTemplateId === template.id}
              onSelect={onTemplateSelect}
            />
          ))}
        </div>
        {filteredTemplates.length === 0 ? (
          <button type="button" className={styles.createVideoTemplateEmpty} onClick={onResetFilters}>
            No templates found. Reset filters.
          </button>
        ) : null}
      </div>
      <div className={styles.createVideoFooter}>
        <span>{currentStepLabel}</span>
        <button type="button" className={styles.createVideoCancel} onClick={onBack}>
          Back
        </button>
      </div>
    </>
  );
}
