import Image from "next/image";
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
          <span className={styles.createVideoOptionPreview} aria-hidden="true">
            <Image src="/images/GenerateFromAPrompt.jpg" alt="" fill sizes="72px" />
          </span>
          <span className={styles.createVideoOptionText}>
            <strong>Generate from a prompt</strong>
            <span>Describe your idea and start from AI-generated scenes.</span>
          </span>
        </button>
        <button type="button" className={styles.createVideoOption} onClick={onTemplateStart}>
          <span className={styles.createVideoOptionPreview} aria-hidden="true">
            <Image src="/images/Template.jpg" alt="" fill sizes="72px" />
          </span>
          <span className={styles.createVideoOptionText}>
            <strong>Template</strong>
            <span>Start from a ready-made layout and customize it.</span>
          </span>
        </button>
        <button type="button" className={styles.createVideoOption} onClick={onUploadClick}>
          <span className={styles.createVideoOptionPreview} aria-hidden="true">
            <Image src="/images/UploadFile.jpg" alt="" fill sizes="72px" />
          </span>
          <span className={styles.createVideoOptionText}>
            <strong>Upload file</strong>
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
