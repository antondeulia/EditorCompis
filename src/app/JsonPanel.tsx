import styles from "./JsonPanel.module.css";

interface JsonPanelProps {
  draft: string;
  status: string | null;
  onDraftChange: (value: string) => void;
  onLoadCurrent: () => void;
  onClear: () => void;
  onApply: () => void;
  onCopy: () => Promise<void>;
}

export const JsonPanel = ({
  draft,
  status,
  onDraftChange,
  onLoadCurrent,
  onClear,
  onApply,
  onCopy,
}: JsonPanelProps) => (
  <>
    <div className={styles.jsonActionRow}>
      <button type="button" className={styles.secondaryAction} onClick={onLoadCurrent}>
        Load current
      </button>
      <button type="button" className={styles.secondaryAction} onClick={onClear}>
        Clear
      </button>
    </div>
    <textarea
      className={styles.jsonEditor}
      value={draft}
      onChange={(event) => onDraftChange(event.target.value)}
      spellCheck={false}
      placeholder="Paste timeline JSON schema here..."
    />
    <div className={styles.jsonActionRow}>
      <button type="button" className={styles.primaryAction} onClick={onApply}>
        Apply JSON
      </button>
      <button type="button" className={styles.secondaryAction} onClick={() => void onCopy()}>
        Copy
      </button>
    </div>
    {status ? <p className={styles.jsonStatus}>{status}</p> : null}
  </>
);
