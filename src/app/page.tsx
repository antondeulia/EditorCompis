"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";

import { applyEditingSchemaToTimeline } from "@/features/ai-editing/services/applyEditingSchemaToTimeline";
import { EditingSchema } from "@/features/ai-editing/types/editingSchema";
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

interface AiEditMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface AiEditAssetContext {
  id: string;
  name: string;
  mediaType: "video" | "audio" | "unknown";
  durationFrames: number | null;
}

interface AiEditRouteResponse {
  editingSchema?: EditingSchema;
  error?: string;
  details?: string;
}

interface SidebarLibraryItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  dragItem: SidebarTimelineItem;
}

interface SidebarLibrarySection {
  id: string;
  title: string;
  items: SidebarLibraryItem[];
}

const elementSections: SidebarLibrarySection[] = [
  {
    id: "shapes",
    title: "Shapes",
    items: [
      {
        id: "shape-rect",
        icon: "[]",
        title: "Solid Rectangle",
        description: "Чистый блок для плашек, масок и акцентов.",
        dragItem: { label: "Solid Rectangle", mediaType: "video", durationFrames: 30 * 6, source: "element" },
      },
      {
        id: "shape-circle",
        icon: "()",
        title: "Circle Pulse",
        description: "Круглый акцент для указания фокуса.",
        dragItem: { label: "Circle Pulse", mediaType: "video", durationFrames: 30 * 5, source: "element" },
      },
      {
        id: "shape-triangle",
        icon: "/\\",
        title: "Triangle Marker",
        description: "Направляющая фигура для инфографики.",
        dragItem: { label: "Triangle Marker", mediaType: "video", durationFrames: 30 * 5, source: "element" },
      },
      {
        id: "shape-line",
        icon: "--",
        title: "Line Accent",
        description: "Линейный разделитель для титров и карточек.",
        dragItem: { label: "Line Accent", mediaType: "video", durationFrames: 30 * 4, source: "element" },
      },
    ],
  },
  {
    id: "motion-pack",
    title: "Motion Elements",
    items: [
      {
        id: "element-lower-third",
        icon: "LT",
        title: "Lower Third Pro",
        description: "Современная нижняя плашка с местом под имя/роль.",
        dragItem: { label: "Lower Third Pro", mediaType: "video", durationFrames: 30 * 6, source: "element" },
      },
      {
        id: "element-callout",
        icon: "!",
        title: "Callout Bubble",
        description: "Выноска для подсказок и UI-демо.",
        dragItem: { label: "Callout Bubble", mediaType: "video", durationFrames: 30 * 5, source: "element" },
      },
      {
        id: "element-progress",
        icon: "==",
        title: "Progress Bar",
        description: "Таймер/прогресс для сторителлинга.",
        dragItem: { label: "Progress Bar", mediaType: "video", durationFrames: 30 * 8, source: "element" },
      },
      {
        id: "element-split",
        icon: "||",
        title: "Split Screen",
        description: "Двухколоночная композиция для сравнения.",
        dragItem: { label: "Split Screen", mediaType: "video", durationFrames: 30 * 10, source: "element" },
      },
      {
        id: "element-arrow",
        icon: "->",
        title: "Arrow Swipe",
        description: "Динамическая стрелка для направления внимания.",
        dragItem: { label: "Arrow Swipe", mediaType: "video", durationFrames: 30 * 4, source: "element" },
      },
      {
        id: "element-burst",
        icon: "**",
        title: "Star Burst",
        description: "Взрывной бейдж для акций, скидок, CTA.",
        dragItem: { label: "Star Burst", mediaType: "video", durationFrames: 30 * 4, source: "element" },
      },
    ],
  },
];

const textSections: SidebarLibrarySection[] = [
  {
    id: "headings",
    title: "Headings",
    items: [
      {
        id: "text-h1",
        icon: "H1",
        title: "Hero Title (H1)",
        description: "Главный крупный заголовок сцены.",
        dragItem: { label: "Hero Title (H1)", mediaType: "video", durationFrames: 30 * 6, source: "element" },
      },
      {
        id: "text-h2",
        icon: "H2",
        title: "Section Title (H2)",
        description: "Заголовок блока или новой темы.",
        dragItem: { label: "Section Title (H2)", mediaType: "video", durationFrames: 30 * 6, source: "element" },
      },
      {
        id: "text-h3",
        icon: "H3",
        title: "Topic Header (H3)",
        description: "Подзаголовок для тезисов и пунктов.",
        dragItem: { label: "Topic Header (H3)", mediaType: "video", durationFrames: 30 * 5, source: "element" },
      },
    ],
  },
  {
    id: "captions",
    title: "Captions & Body",
    items: [
      {
        id: "text-subtitle",
        icon: "CC",
        title: "Subtitle",
        description: "Субтитры в нижней безопасной зоне.",
        dragItem: { label: "Subtitle", mediaType: "video", durationFrames: 30 * 4, source: "element" },
      },
      {
        id: "text-description",
        icon: "DS",
        title: "Description",
        description: "Описание/пояснение под заголовком.",
        dragItem: { label: "Description", mediaType: "video", durationFrames: 30 * 7, source: "element" },
      },
      {
        id: "text-body",
        icon: "Tx",
        title: "Body Text",
        description: "Основной текст для карточек и сцен.",
        dragItem: { label: "Body Text", mediaType: "video", durationFrames: 30 * 8, source: "element" },
      },
      {
        id: "text-quote",
        icon: "\"\"",
        title: "Quote Block",
        description: "Цитата с акцентной типографикой.",
        dragItem: { label: "Quote Block", mediaType: "video", durationFrames: 30 * 8, source: "element" },
      },
    ],
  },
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

const formatDurationFromFrames = (durationFrames: number, fps = 30) => {
  const seconds = Math.max(durationFrames / fps, 0.2);
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
};

const buildAiAssetContext = (assets: AssetItem[]): AiEditAssetContext[] =>
  assets.map((asset) => {
    const inferredType = inferMediaTypeFromAsset(asset.file);
    return {
      id: asset.id,
      name: asset.file.name,
      mediaType: inferredType,
      durationFrames: asset.durationSeconds
        ? Math.max(Math.round(asset.durationSeconds * 30), 1)
        : null,
    };
  });

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
      (typedTrack.type !== "video" && typedTrack.type !== "audio" && typedTrack.type !== "subtitle") ||
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

const getPreviewDefaultsForItem = (item: SidebarTimelineItem) => {
  if (item.source === "asset" && item.mediaType === "video") {
    return {
      previewX: 0,
      previewY: 0,
      previewWidth: 1,
      previewHeight: 1,
    };
  }

  const loweredLabel = item.label.toLowerCase();
  const isTextPreset = /(title|subtitle|header|text|quote|description|body|h1|h2|h3)/i.test(loweredLabel);

  if (isTextPreset) {
    if (loweredLabel.includes("subtitle")) {
      return { previewX: 0.26, previewY: 0.78, previewWidth: 0.48, previewHeight: 0.11 };
    }

    if (loweredLabel.includes("h1") || loweredLabel.includes("hero")) {
      return { previewX: 0.28, previewY: 0.1, previewWidth: 0.44, previewHeight: 0.14 };
    }

    if (loweredLabel.includes("h2") || loweredLabel.includes("h3") || loweredLabel.includes("header")) {
      return { previewX: 0.3, previewY: 0.18, previewWidth: 0.4, previewHeight: 0.12 };
    }

    return { previewX: 0.28, previewY: 0.3, previewWidth: 0.44, previewHeight: 0.16 };
  }

  if (loweredLabel.includes("circle")) {
    return { previewX: 0.39, previewY: 0.32, previewWidth: 0.22, previewHeight: 0.22 };
  }

  if (loweredLabel.includes("triangle")) {
    return { previewX: 0.35, previewY: 0.36, previewWidth: 0.3, previewHeight: 0.22 };
  }

  if (loweredLabel.includes("line")) {
    return { previewX: 0.25, previewY: 0.47, previewWidth: 0.5, previewHeight: 0.07 };
  }

  return { previewX: 0.33, previewY: 0.3, previewWidth: 0.34, previewHeight: 0.2 };
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
  const [aiMessageDraft, setAiMessageDraft] = useState("");
  const [aiMessages, setAiMessages] = useState<AiEditMessage[]>([]);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [isAiRequestInFlight, setIsAiRequestInFlight] = useState(false);
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

  const handleTimelineItemClick = (item: SidebarTimelineItem) => {
    const currentSequence = currentSequenceRef.current;
    const targetTrackIndex = currentSequence.tracks.findIndex((track) => track.type === item.mediaType);

    if (targetTrackIndex < 0) {
      return;
    }

    const durationFrames = Math.max(Math.round(item.durationFrames), 6);
    const boundedDurationFrames = Math.min(durationFrames, currentSequence.durationFrames);

    const targetTrack = currentSequence.tracks[targetTrackIndex];
    const nextStartFrame = targetTrack.clips.reduce(
      (maxFrame, clip) => Math.max(maxFrame, clip.startFrame + clip.durationFrames),
      0,
    );

    const startFrame = Math.min(
      Math.max(nextStartFrame, 0),
      Math.max(currentSequence.durationFrames - boundedDurationFrames, 0),
    );

    const previewDefaults = getPreviewDefaultsForItem(item);

    const nextClip = {
      id: `clip-click-${crypto.randomUUID()}`,
      name: item.label,
      startFrame,
      durationFrames: boundedDurationFrames,
      source: item.source,
      mediaUrl: item.mediaUrl,
      previewX: previewDefaults.previewX,
      previewY: previewDefaults.previewY,
      previewWidth: previewDefaults.previewWidth,
      previewHeight: previewDefaults.previewHeight,
    };

    const nextSequence: TimelineSequence = {
      ...currentSequence,
      tracks: currentSequence.tracks.map((track, index) => {
        if (index !== targetTrackIndex) {
          return track;
        }

        return {
          ...track,
          clips: [...track.clips, nextClip].sort((a, b) => a.startFrame - b.startFrame),
        };
      }),
    };

    currentSequenceRef.current = nextSequence;
    setTimelineSequence(nextSequence);
    setTimelinePanelKey((value) => value + 1);
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

  const handleAiEditSubmit = async () => {
    const trimmedMessage = aiMessageDraft.trim();
    if (!trimmedMessage) {
      return;
    }

    const userMessage: AiEditMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: "user",
      text: trimmedMessage,
    };

    setAiMessages((currentMessages) => [...currentMessages, userMessage]);
    setAiMessageDraft("");
    setAiStatus("Generating editing schema...");
    setIsAiRequestInFlight(true);

    try {
      const response = await fetch("/api/ai-edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userMessage: trimmedMessage,
          assets: buildAiAssetContext(assets),
          currentSequence: currentSequenceRef.current,
        }),
      });

      const payload = (await response.json()) as AiEditRouteResponse;

      if (!response.ok || !payload.editingSchema) {
        const errorText = payload.error ?? "AI Edit request failed.";
        const extraDetails = payload.details ? ` ${payload.details}` : "";
        setAiMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `assistant-${crypto.randomUUID()}`,
            role: "assistant",
            text: `${errorText}${extraDetails}`.trim(),
          },
        ]);
        setAiStatus("Failed to apply AI editing schema.");
        return;
      }

      const editingSchema = payload.editingSchema;
      if (!editingSchema) {
        setAiStatus("AI response did not include editing schema.");
        return;
      }

      const nextSequence = applyEditingSchemaToTimeline(
        currentSequenceRef.current,
        editingSchema,
      );

      setTimelineSequence(nextSequence);
      currentSequenceRef.current = nextSequence;
      setTimelinePanelKey((current) => current + 1);
      setAiMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${crypto.randomUUID()}`,
          role: "assistant",
          text: editingSchema.assistantMessage,
        },
      ]);
      setAiStatus("Editing schema applied to timeline.");
    } catch {
      setAiMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${crypto.randomUUID()}`,
          role: "assistant",
          text: "Network error while requesting OpenAI API.",
        },
      ]);
      setAiStatus("Network error.");
    } finally {
      setIsAiRequestInFlight(false);
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
            {aiMessages.map((message) => (
              <p
                key={message.id}
                className={message.role === "user" ? styles.chatMessage : styles.chatMessageAssistant}
              >
                {message.text}
              </p>
            ))}
          </div>
          <textarea
            className={styles.chatInput}
            value={aiMessageDraft}
            onChange={(event) => setAiMessageDraft(event.target.value)}
            placeholder="Describe the edit you need..."
          />
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => void handleAiEditSubmit()}
            disabled={isAiRequestInFlight}
          >
            Send
          </button>
          {aiStatus ? <p className={styles.jsonStatus}>{aiStatus}</p> : null}
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
                  onClick={() => handleTimelineItemClick(createAssetDragItem(asset))}
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
          <p className={styles.libraryIntro}>Drag any element to the matching timeline track.</p>
          <div className={styles.assetList}>
            {elementSections.map((section) => (
              <section key={section.id} className={styles.librarySection}>
                <h3 className={styles.librarySectionTitle}>{section.title}</h3>
                <div className={styles.libraryGrid}>
                  {section.items.map((item) => (
                    <article
                      key={item.id}
                      className={styles.libraryCard}
                      draggable
                      onDragStart={(event) => handleTimelineItemDragStart(event, item.dragItem)}
                      onDragEnd={handleTimelineItemDragEnd}
                      title="Drag to timeline"
                      onClick={() => handleTimelineItemClick(item.dragItem)}
                    >
                      <span className={styles.libraryCardIcon} aria-hidden="true">
                        {item.icon}
                      </span>
                      <div className={styles.libraryCardBody}>
                        <p className={styles.libraryCardTitle}>{item.title}</p>
                        <p className={styles.libraryCardDescription}>{item.description}</p>
                      </div>
                      <span className={styles.libraryCardMeta}>
                        {formatDurationFromFrames(item.dragItem.durationFrames)}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      );
    }

    if (activeItem.id === "text") {
      return (
        <>
          <h2 className={styles.toolPanelTitle}>Text</h2>
          <p className={styles.libraryIntro}>Готовые типографические пресеты: от H1 до subtitle и body.</p>
          <div className={styles.assetList}>
            {textSections.map((section) => (
              <section key={section.id} className={styles.librarySection}>
                <h3 className={styles.librarySectionTitle}>{section.title}</h3>
                <div className={styles.libraryGrid}>
                  {section.items.map((item) => (
                    <article
                      key={item.id}
                      className={styles.libraryCard}
                      draggable
                      onDragStart={(event) => handleTimelineItemDragStart(event, item.dragItem)}
                      onDragEnd={handleTimelineItemDragEnd}
                      title="Drag to timeline"
                      onClick={() => handleTimelineItemClick(item.dragItem)}
                    >
                      <span className={styles.libraryCardIcon} aria-hidden="true">
                        {item.icon}
                      </span>
                      <div className={styles.libraryCardBody}>
                        <p className={styles.libraryCardTitle}>{item.title}</p>
                        <p className={styles.libraryCardDescription}>{item.description}</p>
                      </div>
                      <span className={styles.libraryCardMeta}>
                        {formatDurationFromFrames(item.dragItem.durationFrames)}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
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
