"use client";

import { ChangeEvent, PointerEvent, RefObject } from "react";
import { AssetItem } from "../../model/types";
import styles from "../../styles/editor.module.css";

type EditorLeftRailProps = {
  isCollapsed: boolean;
  isResizing: boolean;
  onResizeStart: (event: PointerEvent<HTMLButtonElement>) => void;
  activeTab: "chat" | "assets";
  onTabChange: (tab: "chat" | "assets") => void;
  isChatScrollbarVisible: boolean;
  onChatScroll: () => void;
  assets: AssetItem[];
  assetUploadInputRef: RefObject<HTMLInputElement | null>;
  onAssetUpload: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function EditorLeftRail({
  isCollapsed,
  isResizing,
  onResizeStart,
  activeTab,
  onTabChange,
  isChatScrollbarVisible,
  onChatScroll,
  assets,
  assetUploadInputRef,
  onAssetUpload,
}: EditorLeftRailProps) {
  return (
    <aside className={`${styles.leftRail} ${isCollapsed ? styles.leftRailCollapsed : ""}`}>
      <button
        type="button"
        className={`${styles.leftRailResizeHandle} ${isResizing ? styles.leftRailResizeHandleActive : ""}`}
        onPointerDown={onResizeStart}
        aria-label="Resize composition sidebar"
      />
      <div className={styles.panelTabs}>
        <button type="button" className={activeTab === "chat" ? styles.tabActive : styles.tab} onClick={() => onTabChange("chat")}>
          <span className={styles.tabWithIcon}>Edit with AI</span>
        </button>
        <button
          type="button"
          className={activeTab === "assets" ? styles.tabActive : styles.tab}
          onClick={() => onTabChange("assets")}
        >
          <span className={styles.tabWithIcon}>Assets</span>
        </button>
      </div>
      {activeTab === "chat" ? (
        <div className={styles.chatPanel}>
          <header className={styles.chatHeader}>
            <div className={styles.chatIdentity}>
              <span className={styles.chatAvatar} aria-hidden="true" />
              <span className={styles.chatName}>Compis</span>
            </div>
          </header>

          <div
            className={`${styles.chatBody} ${isChatScrollbarVisible ? styles.chatBodyScrollbarVisible : ""}`}
            onScroll={onChatScroll}
          >
            <p>JSON-based editor is active. You can describe scenes and elements in schema and render with Remotion.</p>
            <p className={styles.chatSectionTitle}>Current pipeline:</p>
            <ol>
              <li>
                <strong>Video schema</strong> - Timeline, scenes, elements and animations in JSON/TS object
              </li>
              <li>
                <strong>Remotion composition</strong> - Scene renderer from schema
              </li>
              <li>
                <strong>Editor timeline</strong> - Clip tracks and playhead synced with player frame
              </li>
            </ol>
            <p>Ready for adding schema editor and AI transforms.</p>
            <div className={styles.chatTime}>just now</div>
          </div>

          <footer className={styles.chatComposer}>
            <div className={styles.chatComposerInput}>
              <textarea placeholder="What would you like to change?" rows={3} />
            </div>
          </footer>
        </div>
      ) : (
        <div className={styles.assetsPanel}>
          <input
            ref={assetUploadInputRef}
            type="file"
            accept="video/*,audio/*,image/*"
            multiple
            className={styles.assetsFileInput}
            onChange={onAssetUpload}
          />
          <button type="button" className={styles.assetsUploadButton} onClick={() => assetUploadInputRef.current?.click()}>
            Upload New Asset
          </button>
          <div className={styles.assetList}>
            {assets.map((asset) => (
              <article key={asset.id} className={styles.assetCard}>
                {asset.kind === "video" && asset.src ? (
                  <video className={styles.assetPreview} src={asset.src} controls preload="metadata" />
                ) : null}
                {asset.kind === "audio" && asset.src ? (
                  <audio className={styles.assetAudio} src={asset.src} controls preload="metadata" />
                ) : null}
                {asset.kind === "image" && asset.src ? (
                  <div
                    className={styles.assetPreview}
                    role="img"
                    aria-label={asset.name}
                    style={{ backgroundImage: `url("${asset.src}")`, backgroundSize: "cover", backgroundPosition: "center" }}
                  />
                ) : null}
                {(asset.kind === "audio" && !asset.src) || asset.kind === "other" ? (
                  <div className={styles.assetFilePlaceholder}>
                    <span>File</span>
                  </div>
                ) : null}
                <div className={styles.assetMeta}>
                  <p className={styles.assetName}>{asset.name}</p>
                  <p className={styles.assetType}>{asset.sizeLabel}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}


