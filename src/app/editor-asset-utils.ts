import { DEFAULT_CLIP_DURATION_FRAMES } from "./editor-data";
import { AiEditAssetContext, AssetItem } from "./editor-types";
import { SidebarTimelineItem } from "@/features/timeline/lib/dragTransfer";

const AUDIO_FILE_EXTENSIONS = [".wav", ".mp3", ".aac"];

export const inferMediaTypeFromAsset = (file: File): "video" | "audio" => {
  if (file.type.startsWith("audio/")) {
    return "audio";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  const loweredName = file.name.toLowerCase();
  if (AUDIO_FILE_EXTENSIONS.some((extension) => loweredName.endsWith(extension))) {
    return "audio";
  }

  return "video";
};

export const formatFileSize = (sizeInBytes: number) => {
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

export const formatDurationFromFrames = (durationFrames: number, fps = 30) => {
  const seconds = Math.max(durationFrames / fps, 0.2);
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
};

export const readMediaDurationSeconds = async (
  file: File,
  existingObjectUrl?: string,
): Promise<number | null> => {
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

export const createAssetItem = async (file: File): Promise<AssetItem> => {
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

export const buildAiAssetContext = (assets: AssetItem[]): AiEditAssetContext[] =>
  assets.map((asset) => ({
    id: asset.id,
    name: asset.file.name,
    mediaType: inferMediaTypeFromAsset(asset.file),
    durationFrames: asset.durationSeconds
      ? Math.max(Math.round(asset.durationSeconds * 30), 1)
      : null,
  }));

export const createAssetDragItem = (asset: AssetItem): SidebarTimelineItem => {
  const mediaType = inferMediaTypeFromAsset(asset.file);
  const durationFrames = asset.durationSeconds
    ? Math.max(Math.round(asset.durationSeconds * 30), 6)
    : DEFAULT_CLIP_DURATION_FRAMES;

  return {
    label: asset.file.name,
    mediaType,
    durationFrames,
    source: "asset",
    mediaUrl: mediaType === "video" ? asset.previewUrl ?? undefined : undefined,
  };
};

export const getTranscriptionCandidate = (assets: AssetItem[]): AssetItem | null => {
  const videoAsset = assets.find((asset) => inferMediaTypeFromAsset(asset.file) === "video");
  if (videoAsset) {
    return videoAsset;
  }

  return assets.find((asset) => inferMediaTypeFromAsset(asset.file) === "audio") ?? null;
};
