import styles from "./NewVideoTemplateCard.module.css";
import { TemplateOption } from "./NewVideoModal.types";

type NewVideoTemplateCardProps = {
  template: TemplateOption;
  isActive: boolean;
  onSelect: (templateId: string) => void;
};

export function NewVideoTemplateCard({
  template,
  isActive,
  onSelect,
}: NewVideoTemplateCardProps) {
  return (
    <button
      type="button"
      className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
      onClick={() => onSelect(template.id)}
    >
      <video
        className={styles.preview}
        src={template.previewVideoSrc}
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <strong className={styles.title}>{template.name}</strong>
      <span className={styles.description}>{template.description}</span>
    </button>
  );
}
