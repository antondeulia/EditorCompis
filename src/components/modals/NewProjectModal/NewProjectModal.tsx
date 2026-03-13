"use client";

import { FormEvent, useState } from "react";
import styles from "./NewProjectModal.module.css";
import { CreateProjectInput } from "@/data/projects";

type NewProjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateProjectInput) => Promise<void>;
};

export function NewProjectModal({ isOpen, onClose, onCreate }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    await onCreate({ name, description });
    setName("");
    setDescription("");
    setIsSubmitting(false);
    onClose();
  }

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Create new project"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={styles.modalTitle}>New Project</h2>
        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <label className={styles.modalLabel}>
            Name
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className={styles.modalLabel}>
            Description
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
