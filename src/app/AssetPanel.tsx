import { ChangeEvent, DragEvent, RefObject } from "react";
import Image from "next/image";

import { createAssetDragItem, formatFileSize } from "./editor-asset-utils";
import { AssetItem } from "./editor-types";
import { SidebarTimelineItem } from "@/features/timeline/lib/dragTransfer";
import styles from "./AssetPanel.module.css";

interface AssetPanelProps {
  assets: AssetItem[];
  isDragOver: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onItemDragStart: (event: DragEvent<HTMLElement>, item: SidebarTimelineItem) => void;
  onItemDragEnd: () => void;
  onItemClick: (item: SidebarTimelineItem) => void;
}

export const AssetPanel = ({
  assets,
  isDragOver,
  fileInputRef,
  onFileInputChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onItemDragStart,
  onItemDragEnd,
  onItemClick,
}: AssetPanelProps) => (
  <>
    <input
      ref={fileInputRef}
      type="file"
      multiple
      className={styles.hiddenInput}
      onChange={onFileInputChange}
    />
    <button
      type="button"
      className={styles.primaryAction}
      onClick={() => fileInputRef.current?.click()}
    >
      Upload Files
    </button>
    <div
      className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      Drag and drop files here
    </div>
    <div className={styles.assetList}>
      {assets.length === 0 ? (
        <p className={styles.assetEmpty}>No assets yet. Upload or drop files to start.</p>
      ) : (
        assets.map((asset) => {
          const dragItem = createAssetDragItem(asset);

          return (
            <article
              key={asset.id}
              className={`${styles.assetCard} ${styles.assetCardDraggable}`}
              draggable
              onDragStart={(event) => onItemDragStart(event, dragItem)}
              onDragEnd={onItemDragEnd}
              title="Drag to timeline"
              onClick={() => onItemClick(dragItem)}
            >
              {asset.previewUrl ? (
                asset.file.type.startsWith("image/") ? (
                  <Image
                    src={asset.previewUrl}
                    alt={asset.file.name}
                    className={styles.assetPreview}
                    width={68}
                    height={46}
                    unoptimized
                    draggable={false}
                  />
                ) : (
                  <video src={asset.previewUrl} className={styles.assetPreview} muted draggable={false} />
                )
              ) : (
                <div className={styles.assetPreviewPlaceholder}>FILE</div>
              )}
              <div className={styles.assetMeta}>
                <p className={styles.assetName}>{asset.file.name}</p>
                <p className={styles.assetInfo}>
                  {asset.file.type || "Unknown type"} | {formatFileSize(asset.file.size)}
                </p>
              </div>
            </article>
          );
        })
      )}
    </div>
  </>
);
