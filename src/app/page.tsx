"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";

import { TimelinePanel, createInitialTimelineSequence } from "@/features/timeline";
import {
  SidebarTimelineItem,
  clearCurrentTimelineDragItem,
  setCurrentTimelineDragItem,
} from "@/features/timeline/lib/dragTransfer";
import { TimelineSequence } from "@/features/timeline/types/timeline";

import styles from "./page.module.css";

const sidebarItems = [
  { id: "assets", icon: "A", label: "Assets" },
  { id: "ai-edit", icon: "E", label: "AI Edit" },
  { id: "ai-tools", icon: "T", label: "AI Tools" },
  { id: "elements", icon: "El", label: "Elements" },
  { id: "text", icon: "Tx", label: "Text" },
  { id: "media", icon: "M", label: "Media" },
  { id: "json", icon: "{}", label: "JSON" },
];

const TIMELINE_DRAG_MIME = "application/x-timeline-item";
const DEFAULT_CLIP_DURATION_FRAMES = 30 * 8;

interface AssetItem {
  id: string;
  file: File;
  previewUrl: string | null;
  durationSeconds: number | null;
}

const elementItems: SidebarTimelineItem[] = [
  { label: "Lower Third", mediaType: "video", durationFrames: 30 * 6, source: "element" },
  { label: "Callout Bubble", mediaType: "video", durationFrames: 30 * 5, source: "element" },
  { label: "Progress Bar", mediaType: "video", durationFrames: 30 * 8, source: "element" },
  { label: "Split Screen", mediaType: "video", durationFrames: 30 * 10, source: "element" },
];

const inferMediaTypeFromAsset = (file: File): "video" | "audio" => {
  if (file.type.startsWith("audio/")) {
    return "audio";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  const loweredName = file.name.toLowerCase();
  if (loweredName.endsWith(".wav") || loweredName.endsWith(".mp3") || loweredName.endsWith(".aac")) {
    return "audio";
  }

  return "video";
};

const formatFileSize = (sizeInBytes: number) => {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  }

  if (sizeInBytes < 1024 * 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const isTimelineSequence = (value: unknown): value is TimelineSequence => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TimelineSequence>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.frameRate !== "number" ||
    !Number.isFinite(candidate.frameRate) ||
    candidate.frameRate <= 0 ||
    typeof candidate.durationFrames !== "number" ||
    !Number.isFinite(candidate.durationFrames) ||
    candidate.durationFrames <= 0 ||
    !Array.isArray(candidate.tracks)
  ) {
    return false;
  }

  return candidate.tracks.every((track) => {
    if (!track || typeof track !== "object") {
      return false;
    }

    const typedTrack = track as Partial<TimelineSequence["tracks"][number]>;

    if (
      typeof typedTrack.id !== "string" ||
      typeof typedTrack.name !== "string" ||
      (typedTrack.type !== "video" && typedTrack.type !== "audio") ||
      !Array.isArray(typedTrack.clips)
    ) {
      return false;
    }

    return typedTrack.clips.every((clip) => {
      if (!clip || typeof clip !== "object") {
        return false;
      }

      const typedClip = clip as Partial<TimelineSequence["tracks"][number]["clips"][number]>;

      return (
        typeof typedClip.id === "string" &&
        typeof typedClip.name === "string" &&
        typeof typedClip.startFrame === "number" &&
        Number.isFinite(typedClip.startFrame) &&
        typeof typedClip.durationFrames === "number" &&
        Number.isFinite(typedClip.durationFrames) &&
        typedClip.durationFrames > 0
      );
    });
  });
};

const readMediaDurationSeconds = async (file: File, existingObjectUrl?: string): Promise<number | null> => {
  const isVideo = file.type.startsWith("video/");
  const isAudio = file.type.startsWith("audio/");

  if (!isVideo && !isAudio) {
    return null;
  }

  const objectUrl = existingObjectUrl ?? URL.createObjectURL(file);

  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const mediaElement = document.createElement(isAudio ? "audio" : "video");
      mediaElement.preload = "metadata";

      const cleanup = () => {
        mediaElement.removeAttribute("src");
        mediaElement.load();
      };

      mediaElement.onloadedmetadata = () => {
        const nextDuration = Number.isFinite(mediaElement.duration) ? mediaElement.duration : 0;
        cleanup();
        resolve(nextDuration);
      };

      mediaElement.onerror = () => {
        cleanup();
        reject(new Error("Failed to read media duration"));
      };

      mediaElement.src = objectUrl;
    });

    return duration > 0 ? duration : null;
  } catch {
    return null;
  } finally {
    if (!existingObjectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
};

const createAssetItem = async (file: File): Promise<AssetItem> => {
  const canPreview = file.type.startsWith("image/") || file.type.startsWith("video/");
  const previewUrl = canPreview ? URL.createObjectURL(file) : null;
  const durationSeconds = await readMediaDurationSeconds(file, previewUrl ?? undefined);

  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    previewUrl,
    durationSeconds,
  };
};

export default function Home() {
  const [activeItemId, setActiveItemId] = useState<string | null>("assets");
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [timelineSequence, setTimelineSequence] = useState<TimelineSequence>(() => createInitialTimelineSequence());
  const [timelinePanelKey, setTimelinePanelKey] = useState(0);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentSequenceRef = useRef<TimelineSequence>(timelineSequence);

  const activeItem = sidebarItems.find((item) => item.id === activeItemId) ?? null;

  useEffect(() => {
    currentSequenceRef.current = timelineSequence;
  }, [timelineSequence]);

  useEffect(() => {
    return () => {
      assets.forEach((asset) => {
        if (asset.previewUrl) {
          URL.revokeObjectURL(asset.previewUrl);
        }
      });
    };
  }, [assets]);

  const appendFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const nextAssets = await Promise.all(Array.from(files).map(createAssetItem));
    setAssets((currentAssets) => [...currentAssets, ...nextAssets]);
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void appendFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    void appendFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const createAssetDragItem = (asset: AssetItem): SidebarTimelineItem => {
    const inferredType = inferMediaTypeFromAsset(asset.file);
    const durationFrames = asset.durationSeconds
      ? Math.max(Math.round(asset.durationSeconds * 30), 6)
      : DEFAULT_CLIP_DURATION_FRAMES;

    return {
      label: asset.file.name,
      mediaType: inferredType,
      durationFrames,
      source: "asset",
      mediaUrl: inferredType === "video" ? asset.previewUrl ?? undefined : undefined,
    };
  };

  const handleTimelineItemDragStart = (
    event: DragEvent<HTMLElement>,
    item: SidebarTimelineItem,
  ) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(TIMELINE_DRAG_MIME, JSON.stringify(item));
    event.dataTransfer.setData("text/plain", item.label);
    setCurrentTimelineDragItem(item);
  };

  const handleTimelineItemDragEnd = () => {
    clearCurrentTimelineDragItem();
  };

  const handleLoadCurrentJson = () => {
    setJsonDraft(JSON.stringify(currentSequenceRef.current, null, 2));
    setJsonStatus("Loaded current timeline JSON.");
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonDraft);
      setJsonStatus("JSON copied to clipboard.");
    } catch {
      setJsonStatus("Unable to copy JSON. Browser blocked clipboard access.");
    }
  };

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonDraft);

      if (!isTimelineSequence(parsed)) {
        setJsonStatus("JSON schema is invalid for timeline sequence.");
        return;
      }

      setTimelineSequence(parsed);
      currentSequenceRef.current = parsed;
      setTimelinePanelKey((value) => value + 1);
      setJsonStatus("Timeline updated from JSON.");
    } catch {
      setJsonStatus("JSON parse error. Check syntax and try again.");
    }
  };

  const handleSidebarItemClick = (itemId: string) => {
    setActiveItemId((currentId) => {
      const nextId = currentId === itemId ? null : itemId;

      if (nextId === "json") {
        setJsonDraft(JSON.stringify(currentSequenceRef.current, null, 2));
        setJsonStatus(null);
      }

      return nextId;
    });
  };

  const renderSidebarPanel = () => {
    if (!activeItem) {
      return null;
    }

    if (activeItem.id === "json") {
      return (
        <>
          <h2 className={styles.toolPanelTitle}>JSON Timeline</h2>
          <div className={styles.jsonActionRow}>
            <button type="button" className={styles.secondaryAction} onClick={handleLoadCurrentJson}>
              Load current
            </button>
            <button type="button" className={styles.secondaryAction} onClick={() => setJsonDraft("")}>Clear</button>
          </div>
          <textarea
            className={styles.jsonEditor}
            value={jsonDraft}
            onChange={(event) => setJsonDraft(event.target.value)}
            spellCheck={false}
            placeholder="Paste timeline JSON schema here..."
          />
          <div className={styles.jsonActionRow}>
            <button type="button" className={styles.primaryAction} onClick={handleApplyJson}>
              Apply JSON
            </button>
            <button type="button" className={styles.secondaryAction} onClick={() => void handleCopyJson()}>
              Copy
            </button>
          </div>
          {jsonStatus ? <p className={styles.jsonStatus}>{jsonStatus}</p> : null}
        </>
      );
    }

    if (activeItem.id === "ai-edit") {
      return (
        <>
          <h2 className={styles.toolPanelTitle}>AI Edit</h2>
          <div className={styles.chatThread}>
            <p className={styles.chatMessage}>Make jump cuts on pauses and clean up breathing.</p>
            <p className={styles.chatMessageAssistant}>
              Done. Found 5 pauses longer than 500ms and suggested cuts.
            </p>
          </div>
          <textarea className={styles.chatInput} placeholder="Describe the edit you need..." />
          <button type="button" className={styles.primaryAction}>
            Send
          </button>
        </>
      );
    }

    if (activeItem.id === "assets") {
      return (
        <>
          <h2 className={styles.toolPanelTitle}>Assets</h2>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className={styles.hiddenInput}
            onChange={handleFileInputChange}
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
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            Drag and drop files here
          </div>
          <div className={styles.assetList}>
            {assets.length === 0 ? (
              <p className={styles.assetEmpty}>No assets yet. Upload or drop files to start.</p>
            ) : (
              assets.map((asset) => (
                <article
                  key={asset.id}
                  className={`${styles.assetCard} ${styles.assetCardDraggable}`}
                  draggable
                  onDragStart={(event) => handleTimelineItemDragStart(event, createAssetDragItem(asset))}
                  onDragEnd={handleTimelineItemDragEnd}
                  title="Drag to timeline"
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
                      <video
                        src={asset.previewUrl}
                        className={styles.assetPreview}
                        muted
                        draggable={false}
                      />
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
              ))
            )}
          </div>
        </>
      );
    }

    if (activeItem.id === "elements") {
      return (
        <>
          <h2 className={styles.toolPanelTitle}>Elements</h2>
          <div className={styles.assetList}>
            {elementItems.map((item) => (
              <div
                key={item.label}
                className={`${styles.assetCard} ${styles.assetCardDraggable}`}
                draggable
                onDragStart={(event) => handleTimelineItemDragStart(event, item)}
                onDragEnd={handleTimelineItemDragEnd}
                title="Drag to timeline"
              >
                {item.label}
              </div>
            ))}
          </div>
        </>
      );
    }

    return (
      <>
        <h2 className={styles.toolPanelTitle}>{activeItem.label}</h2>
        <p className={styles.toolPanelText}>Panel for {activeItem.label} will appear here.</p>
      </>
    );
  };

  return (
    <main className={styles.page}>
      <div className={styles.leftRail}>
        <aside className={styles.sidebar} aria-label="Editor tools">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.sidebarItem} ${
                activeItemId === item.id ? styles.sidebarItemActive : ""
              }`}
              onClick={() => handleSidebarItemClick(item.id)}
            >
              <span className={styles.sidebarIcon} aria-hidden="true">
                {item.icon}
              </span>
              <span className={styles.sidebarLabel}>{item.label}</span>
            </button>
          ))}
        </aside>
        {activeItem ? <aside className={styles.toolPanel}>{renderSidebarPanel()}</aside> : null}
      </div>
      <section className={styles.editorContent}>
        <TimelinePanel
          key={timelinePanelKey}
          sequence={timelineSequence}
          onSequenceChange={(nextSequence) => {
            currentSequenceRef.current = nextSequence;
          }}
        />
      </section>
    </main>
  );
}
