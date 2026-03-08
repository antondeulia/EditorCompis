import styles from "./NewVideoModalStartStep.module.css";

type NewVideoModalStartStepProps = {
  currentStepLabel: string;
  onBlankStart: () => void;
  onTemplateStart: () => void;
  onUploadClick: () => void;
  onClose: () => void;
};

export function NewVideoModalStartStep({
  currentStepLabel,
  onBlankStart,
  onTemplateStart,
  onUploadClick,
  onClose,
}: NewVideoModalStartStepProps) {
  return (
    <>
      <h2 className={styles.createVideoHeading}>How would you like to start?</h2>
      <div className={styles.createVideoOptions}>
        <button type="button" className={styles.createVideoOption} onClick={onBlankStart}>
          <span className={styles.createVideoOptionIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M7 3h7l5 5v13H7V3Zm2 2v14h8V9h-4V5H9Zm6 0v2h2l-2-2Z"
              />
            </svg>
          </span>
          <span className={styles.createVideoOptionText}>
            <strong>Blank</strong>
            <span>Start with a clean canvas for complete control.</span>
          </span>
        </button>
        <button type="button" className={styles.createVideoOption} onClick={onTemplateStart}>
          <span className={styles.createVideoOptionIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3H4V5Zm0 5h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Zm4 3a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H8Z"
              />
            </svg>
          </span>
          <span className={styles.createVideoOptionText}>
            <strong>Choose from template</strong>
            <span>Start from a ready-made layout and customize it.</span>
          </span>
        </button>
        <button type="button" className={styles.createVideoOption} onClick={onUploadClick}>
          <span className={styles.createVideoOptionIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12 3c.6 0 1 .4 1 1v6.6l2.3-2.3 1.4 1.4-4.7 4.7-4.7-4.7 1.4-1.4 2.3 2.3V4c0-.6.4-1 1-1Zm-7 10h14a2 2 0 0 1 2 2v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3a2 2 0 0 1 2-2Zm0 2v3c0 .6.4 1 1 1h12c.6 0 1-.4 1-1v-3H5Z"
              />
            </svg>
          </span>
          <span className={styles.createVideoOptionText}>
            <strong>Upload Video</strong>
            <span>Extract scenes and captions automatically.</span>
          </span>
        </button>
      </div>
      <div className={`${styles.createVideoFooter} ${styles.createVideoFooterStepOne}`}>
        <span>{currentStepLabel}</span>
        <button type="button" className={styles.createVideoCancel} onClick={onClose}>
          Cancel
        </button>
      </div>
    </>
  );
}
