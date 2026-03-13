"use client";

import { ChangeEvent, RefObject, useMemo, useState } from "react";
import { AssetItem } from "../../model/types";
import { canAddAssetToTimeline } from "../../lib/asset-timeline";
import styles from "../../styles/editor.module.css";

type AssetFilter = "all" | "video" | "image";

type AssetsPanelProps = {
  assets: AssetItem[];
  assetUploadInputRef: RefObject<HTMLInputElement | null>;
  onAssetUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddAssetToTimeline: (assetId: string) => void;
};

const filterLabels: Record<AssetFilter, string> = {
  all: "All",
  video: "Video",
  image: "Photo",
};

function getAssetPreviewLabel(asset: AssetItem) {
  const extension = asset.name.split(".").pop()?.trim().toUpperCase();
  if (extension && extension.length <= 5) {
    return extension;
  }

  return "FILE";
}

export function AssetsPanel({
  assets,
  assetUploadInputRef,
  onAssetUpload,
  onAddAssetToTimeline,
}: AssetsPanelProps) {
  const [activeFilter, setActiveFilter] = useState<AssetFilter>("all");
  const filteredAssets = useMemo(() => {
    if (activeFilter === "all") {
      return assets;
    }

    return assets.filter((asset) => asset.kind === activeFilter);
  }, [activeFilter, assets]);

  return (
    <div className={styles.assetsPanel}>
      <input
        ref={assetUploadInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        className={styles.assetsFileInput}
        onChange={onAssetUpload}
      />
      <header className={styles.assetsHeader}>
        <div className={styles.assetsHeaderTop}>
          <h3 className={styles.assetsTitle}>Media</h3>
          <button type="button" className={styles.assetsUploadButton} onClick={() => assetUploadInputRef.current?.click()}>
            Import
          </button>
        </div>
        <div className={styles.assetsFilters}>
          {(Object.keys(filterLabels) as AssetFilter[]).map((filter) => {
            const isActive = filter === activeFilter;
            const counter =
              filter === "all" ? assets.length : assets.filter((asset) => asset.kind === filter).length;

            return (
              <button
                key={filter}
                type="button"
                className={isActive ? styles.assetsFilterActive : styles.assetsFilter}
                onClick={() => setActiveFilter(filter)}
              >
                {filterLabels[filter]} <span>{counter}</span>
              </button>
            );
          })}
        </div>
      </header>
      <div className={styles.assetList}>
        {filteredAssets.map((asset) => {
          const canAddToTrack = canAddAssetToTimeline(asset);
          return (
            <article
              key={asset.id}
              className={styles.assetCard}
              draggable={canAddToTrack}
              onDragStart={(event) => {
                if (!canAddToTrack) {
                  return;
                }

                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData("application/editor-asset-id", asset.id);
              }}
            >
              <div className={styles.assetPreviewFrame}>
                {asset.kind === "video" && asset.src ? (
                  <video className={styles.assetPreview} src={asset.src} preload="metadata" />
                ) : null}
                {asset.kind === "image" && asset.src ? (
                  <div
                    className={styles.assetPreview}
                    role="img"
                    aria-label={asset.name}
                    style={{ backgroundImage: `url("${asset.src}")`, backgroundSize: "cover", backgroundPosition: "center" }}
                  />
                ) : null}
                {asset.kind === "audio" && asset.src ? (
                  <audio className={styles.assetAudio} src={asset.src} controls preload="metadata" />
                ) : null}
                {(asset.kind === "audio" && !asset.src) || asset.kind === "other" ? (
                  <div className={styles.assetFilePlaceholder}>
                    <span className={styles.assetFilePlaceholderLabel}>{getAssetPreviewLabel(asset)}</span>
                  </div>
                ) : null}
                {asset.kind !== "other" ? <span className={styles.assetKindBadge}>{asset.kind.toUpperCase()}</span> : null}
              </div>
              <div className={styles.assetMetaRow}>
                <div className={styles.assetMeta}>
                  <p className={styles.assetName}>{asset.name}</p>
                  <p className={styles.assetType}>{asset.mediaLabel ?? asset.sizeLabel}</p>
                </div>
                {canAddToTrack ? (
                  <button
                    type="button"
                    className={styles.assetAddButton}
                    onClick={() => onAddAssetToTimeline(asset.id)}
                    aria-label={`Add ${asset.name} to timeline`}
                    title="Add to timeline"
                  >
                    +
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
