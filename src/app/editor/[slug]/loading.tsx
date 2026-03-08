import styles from "./loading.module.css";

export default function EditLoading() {
  return (
    <div className={styles.loadingShell}>
      <div className={styles.spinner} aria-hidden="true" />
    </div>
  );
}
