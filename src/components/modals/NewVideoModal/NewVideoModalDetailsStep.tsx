import { FormEvent, RefObject } from "react";
import styles from "./NewVideoModalDetailsStep.module.css";
import { CreateVideoFlow } from "./NewVideoModal.types";

type NewVideoModalDetailsStepProps = {
  flow: CreateVideoFlow;
  title: string;
  description: string;
  uploadedPreviewUrl: string;
  uploadedFile: File | null;
  isAwaitingUpload: boolean;
  isSubmitting: boolean;
  currentStepLabel: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function NewVideoModalDetailsStep({
  flow,
  title,
  description,
  uploadedPreviewUrl,
  uploadedFile,
  isAwaitingUpload,
  isSubmitting,
  currentStepLabel,
  fileInputRef,
  onTitleChange,
  onDescriptionChange,
  onBack,
  onSubmit,
}: NewVideoModalDetailsStepProps) {
  return (
    <form className={styles.createVideoStepForm} onSubmit={onSubmit}>
      <button
        type="button"
        className={styles.createVideoBackTop}
        aria-label="Back to step one"
        onClick={onBack}
      >
        Back
      </button>
      <h2 className={styles.createVideoHeading}>
        {flow === "upload" ? "Set up your uploaded video" : "Set up your video"}
      </h2>
      {flow === "upload" ? (
        <div className={styles.createVideoUploadLayout}>
          <div className={styles.createVideoUploadFields}>
            <div className={styles.createVideoFieldStack}>
              <input
                type="text"
                required
                aria-label="Title"
                placeholder="Title"
                value={title}
                className={styles.createVideoFieldInput}
                onChange={(event) => onTitleChange(event.target.value)}
              />
              <textarea
                className={`${styles.createVideoFieldTextarea} ${styles.createVideoDescriptionFieldUpload}`}
                aria-label="Description"
                placeholder="Description"
                rows={8}
                value={description}
                onChange={(event) => onDescriptionChange(event.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className={`${styles.createVideoUploadPreview} ${
              !uploadedPreviewUrl ? styles.createVideoUploadPreviewEmpty : ""
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadedPreviewUrl ? (
              <>
                <video
                  className={styles.createVideoUploadPreviewVideo}
                  src={uploadedPreviewUrl}
                  controls
                  preload="metadata"
                />
                <p className={styles.createVideoUploadMeta}>{uploadedFile?.name}</p>
              </>
            ) : isAwaitingUpload ? (
              <span className={styles.createVideoUploadLoader} aria-label="Loading video" />
            ) : (
              <span className={styles.createVideoUploadIdle} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 3c.6 0 1 .4 1 1v6.6l2.3-2.3 1.4 1.4-4.7 4.7-4.7-4.7 1.4-1.4 2.3 2.3V4c0-.6.4-1 1-1Zm-7 10h14a2 2 0 0 1 2 2v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3a2 2 0 0 1 2-2Zm0 2v3c0 .6.4 1 1 1h12c.6 0 1-.4 1-1v-3H5Z"
                  />
                </svg>
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className={`${styles.createVideoFieldStack} ${styles.createVideoBlankFields}`}>
          <input
            type="text"
            required
            aria-label="Title"
            placeholder="Title"
            value={title}
            className={styles.createVideoFieldInput}
            onChange={(event) => onTitleChange(event.target.value)}
          />
          <textarea
            className={`${styles.createVideoFieldTextarea} ${styles.createVideoDescriptionField}`}
            aria-label="Description"
            placeholder="Description"
            rows={8}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </div>
      )}
      <div className={styles.createVideoFooter}>
        <span>{currentStepLabel}</span>
        <div className={styles.createVideoStepActions}>
          <button type="button" className={styles.createVideoCancel} onClick={onBack}>
            Back
          </button>
          <button
            type="submit"
            className={`${styles.primaryButton} ${styles.createVideoSaveButton}`}
            disabled={isSubmitting || (flow === "upload" && !uploadedFile)}
          >
            {isSubmitting ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </form>
  );
}
