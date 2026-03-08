"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./NewVideoModal.module.css";
import { CreateVideoInput } from "@/data/mocks/projects.mock";
import { NewVideoModalDetailsStep } from "./NewVideoModalDetailsStep";
import { NewVideoModalStartStep } from "./NewVideoModalStartStep";
import { NewVideoModalTemplateStep } from "./NewVideoModalTemplateStep";
import { templateOptions } from "./NewVideoModal.templates";
import { CreateVideoFlow, CreateVideoStage, TemplateFilter } from "./NewVideoModal.types";

type NewVideoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateVideoInput) => Promise<void>;
};

export function NewVideoModal({ isOpen, onClose, onCreate }: NewVideoModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPickerHandledRef = useRef(false);
  const [flow, setFlow] = useState<CreateVideoFlow | null>(null);
  const [stage, setStage] = useState<CreateVideoStage>("select-start");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState<TemplateFilter>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAwaitingUpload, setIsAwaitingUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uploadedPreviewUrl = useMemo(
    () => (uploadedFile ? URL.createObjectURL(uploadedFile) : ""),
    [uploadedFile],
  );

  useEffect(() => {
    if (!uploadedPreviewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(uploadedPreviewUrl);
  }, [uploadedPreviewUrl]);

  const currentStepLabel = useMemo(() => {
    if (stage === "select-start") {
      return "Step 1";
    }

    if (flow === "template" && stage === "template-select") {
      return "Step 2/3";
    }

    if (flow === "template" && stage === "details") {
      return "Step 3/3";
    }

    return "Step 2/2";
  }, [flow, stage]);

  const filteredTemplates = useMemo(() => {
    const searchValue = templateSearch.trim().toLowerCase();
    return templateOptions.filter((template) => {
      const matchesFilter = templateFilter === "all" || template.category === templateFilter;
      const matchesSearch =
        !searchValue ||
        template.name.toLowerCase().includes(searchValue) ||
        template.description.toLowerCase().includes(searchValue);
      return matchesFilter && matchesSearch;
    });
  }, [templateFilter, templateSearch]);

  if (!isOpen) {
    return null;
  }

  function resetFlowState() {
    setFlow(null);
    setStage("select-start");
    setSelectedTemplateId(null);
    setTemplateSearch("");
    setTemplateFilter("all");
    setIsFilterOpen(false);
    setUploadedFile(null);
    setIsAwaitingUpload(false);
  }

  function handleClose() {
    resetFlowState();
    setTitle("");
    setDescription("");
    setIsSubmitting(false);
    onClose();
  }

  function handleBack() {
    if (stage === "details" && flow === "template") {
      setStage("template-select");
      return;
    }

    resetFlowState();
  }

  function handleBlankStart() {
    setFlow("blank");
    setStage("details");
  }

  function handleTemplateStart() {
    setFlow("template");
    setStage("template-select");
  }

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplateId(templateId);
    setStage("details");
  }

  function handleUploadClick() {
    setFlow("upload");
    setStage("details");
    setUploadedFile(null);
    setIsAwaitingUpload(true);
    uploadPickerHandledRef.current = false;
    fileInputRef.current?.click();
    window.addEventListener(
      "focus",
      () => {
        setTimeout(() => {
          if (!uploadPickerHandledRef.current) {
            setIsAwaitingUpload(false);
          }
        }, 250);
      },
      { once: true },
    );
  }

  function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    uploadPickerHandledRef.current = true;
    const [file] = event.target.files ?? [];
    if (!file) {
      setIsAwaitingUpload(false);
      return;
    }

    setUploadedFile(file);
    setIsAwaitingUpload(false);
    setFlow("upload");
    setStage("details");
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
    event.currentTarget.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flow || stage !== "details") {
      return;
    }

    setIsSubmitting(true);
    await onCreate({
      type: flow === "upload" ? "upload-video" : "blank-template",
      title,
      description,
    });
    handleClose();
  }

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={handleClose}>
      <div
        className={styles.createVideoModal}
        role="dialog"
        aria-modal="true"
        aria-label="Create new video"
        onClick={(event) => event.stopPropagation()}
      >
        <aside className={styles.createVideoIntro}>
          <span className={styles.createVideoIntroIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="m18.8 5.2-1-1a1 1 0 0 0-1.4 0l-1.2 1.2 2.4 2.4 1.2-1.2a1 1 0 0 0 0-1.4ZM7 13.6l7.2-7.2 2.4 2.4L9.4 16H7v-2.4Zm10 1.9a.8.8 0 1 0 0 1.6h2.2a.8.8 0 1 0 0-1.6H17Zm-8 1.4a.8.8 0 0 1 .8-.8h2.2a.8.8 0 1 1 0 1.6H9.8a.8.8 0 0 1-.8-.8Z"
              />
            </svg>
          </span>
          <h3 className={styles.createVideoIntroTitle}>Create New</h3>
          <p className={styles.createVideoIntroText}>
            Start your new project by choosing a method below.
          </p>
          <div className={styles.createVideoTip}>
            <p className={styles.createVideoTipLabel}>PRO TIP</p>
            <p>Uploading a video automatically generates captions and scenes using AI.</p>
          </div>
          <button type="button" className={styles.createVideoDocLink}>
            View documentation
          </button>
        </aside>
        <section
          className={
            stage !== "select-start"
              ? `${styles.createVideoMain} ${styles.createVideoMainStepTwo}`
              : styles.createVideoMain
          }
        >
          <button
            type="button"
            className={styles.createVideoClose}
            aria-label="Close modal"
            onClick={handleClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M7.4 6 6 7.4 10.6 12 6 16.6 7.4 18l4.6-4.6 4.6 4.6 1.4-1.4-4.6-4.6L18 7.4 16.6 6 12 10.6 7.4 6Z"
              />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className={styles.createVideoUploadPicker}
            onChange={handleUploadChange}
          />

          {stage === "select-start" ? (
            <NewVideoModalStartStep
              currentStepLabel={currentStepLabel}
              onBlankStart={handleBlankStart}
              onTemplateStart={handleTemplateStart}
              onUploadClick={handleUploadClick}
              onClose={handleClose}
            />
          ) : null}

          {stage === "template-select" ? (
            <NewVideoModalTemplateStep
              currentStepLabel={currentStepLabel}
              templateSearch={templateSearch}
              onTemplateSearchChange={setTemplateSearch}
              isFilterOpen={isFilterOpen}
              templateFilter={templateFilter}
              onToggleFilter={() => setIsFilterOpen((current) => !current)}
              onSelectFilter={(filterOption) => {
                setTemplateFilter(filterOption);
                setIsFilterOpen(false);
              }}
              filteredTemplates={filteredTemplates}
              selectedTemplateId={selectedTemplateId}
              onTemplateSelect={handleTemplateSelect}
              onResetFilters={() => {
                setTemplateSearch("");
                setTemplateFilter("all");
              }}
              onBack={handleBack}
            />
          ) : null}

          {stage === "details" && flow ? (
            <NewVideoModalDetailsStep
              flow={flow}
              title={title}
              description={description}
              uploadedPreviewUrl={uploadedPreviewUrl}
              uploadedFile={uploadedFile}
              isAwaitingUpload={isAwaitingUpload}
              isSubmitting={isSubmitting}
              currentStepLabel={currentStepLabel}
              fileInputRef={fileInputRef}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
              onBack={handleBack}
              onSubmit={handleSubmit}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}
