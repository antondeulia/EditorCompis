"use client";

import { ChangeEvent, DragEvent, Fragment, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
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

type SidebarItemId = "assets" | "ai-edit" | "ai-tools" | "elements" | "text" | "json";

const sidebarItems: Array<{ id: SidebarItemId; label: string }> = [
  { id: "assets", label: "Assets" },
  { id: "ai-edit", label: "AI Edit" },
  { id: "ai-tools", label: "AI Tools" },
  { id: "elements", label: "Elements" },
  { id: "text", label: "Text" },
  { id: "json", label: "JSON" },
];

const SidebarNavIcon = ({ itemId }: { itemId: SidebarItemId }): ReactNode => {
  switch (itemId) {
    case "assets":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "ai-edit":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l1.9 4.7L19 9.6l-4.1 2.2L13 17l-1.9-5.2L7 9.6l5.1-1.9z" />
        </svg>
      );
    case "ai-tools":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6h12M6 12h12M6 18h12" />
          <circle cx="9" cy="6" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="11" cy="18" r="2" />
        </svg>
      );
    case "elements":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <circle cx="17" cy="7.5" r="3.5" />
          <path d="M4 20h16l-4-6H8z" />
        </svg>
      );
    case "text":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16M12 6v12M7 18h10" />
        </svg>
      );
    case "json":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 5c-2.3 0-3 1.5-3 3v2c0 1.4-.6 2-2 2 1.4 0 2 .6 2 2v2c0 1.5.7 3 3 3M14 5c2.3 0 3 1.5 3 3v2c0 1.4.6 2 2 2-1.4 0-2 .6-2 2v2c0 1.5-.7 3-3 3" />
        </svg>
      );
    default:
      return null;
  }
};

const TIMELINE_DRAG_MIME = "application/x-timeline-item";
const DEFAULT_CLIP_DURATION_FRAMES = 30 * 8;
const SUBTITLE_REQUEST_PATTERN = /(subtitle|subtitles|caption|captions|\u0441\u0443\u0431\u0442\u0438\u0442\u0440|\u0442\u0438\u0442\u0440)/i;

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

interface AiEditStreamDoneEvent {
  type: "done";
  editingSchema: EditingSchema;
  usage?: unknown;
  model?: string;
}

interface AiEditStreamErrorEvent {
  type: "error";
  error: string;
  details?: string;
}

interface AiEditStreamDeltaEvent {
  type: "assistant_delta";
  delta: string;
}

type AiEditStreamEvent = AiEditStreamDoneEvent | AiEditStreamErrorEvent | AiEditStreamDeltaEvent;

interface TranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

interface TranscriptWord {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

interface TranscriptionRouteResponse {
  segments?: TranscriptSegment[];
  words?: TranscriptWord[];
  error?: string;
  details?: string;
}

type SubtitleTimingMode = "phrase" | "word";

interface SubtitleVisualStylePreferences {
  textColor: string | null;
  outlineColor: string | null;
  outlineWidth: number | null;
  backgroundColor: string | null;
  backgroundOpacity: number | null;
  fontWeight: number | null;
  fontSizePx: number | null;
  borderRadiusPx: number | null;
  paddingXPx: number | null;
  paddingYPx: number | null;
}

interface SubtitleGenerationPreferences {
  timingMode: SubtitleTimingMode;
  previewX: number;
  previewY: number;
  previewWidth: number;
  previewHeight: number;
  maxCharsPerChunk: number;
  style: SubtitleVisualStylePreferences;
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
        description: "Clean block for plates, masks, and visual accents.",
        dragItem: { label: "Solid Rectangle", mediaType: "video", durationFrames: 30 * 6, source: "element" },
      },
      {
        id: "shape-circle",
        icon: "()",
        title: "Circle Pulse",
        description: "Round accent for focus highlights.",
        dragItem: { label: "Circle Pulse", mediaType: "video", durationFrames: 30 * 5, source: "element" },
      },
      {
        id: "shape-triangle",
        icon: "/\\",
        title: "Triangle Marker",
        description: "Directional marker for infographics and pointers.",
        dragItem: { label: "Triangle Marker", mediaType: "video", durationFrames: 30 * 5, source: "element" },
      },
      {
        id: "shape-line",
        icon: "--",
        title: "Line Accent",
        description: "Linear divider for titles and cards.",
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
        description: "Modern lower-third with room for name and role.",
        dragItem: { label: "Lower Third Pro", mediaType: "video", durationFrames: 30 * 6, source: "element" },
      },
      {
        id: "element-callout",
        icon: "!",
        title: "Callout Bubble",
        description: "Callout bubble for hints and UI demos.",
        dragItem: { label: "Callout Bubble", mediaType: "video", durationFrames: 30 * 5, source: "element" },
      },
      {
        id: "element-progress",
        icon: "==",
        title: "Progress Bar",
        description: "Timer/progress bar for storytelling.",
        dragItem: { label: "Progress Bar", mediaType: "video", durationFrames: 30 * 8, source: "element" },
      },
      {
        id: "element-split",
        icon: "||",
        title: "Split Screen",
        description: "Two-column composition for side-by-side comparison.",
        dragItem: { label: "Split Screen", mediaType: "video", durationFrames: 30 * 10, source: "element" },
      },
      {
        id: "element-arrow",
        icon: "->",
        title: "Arrow Swipe",
        description: "Dynamic arrow to direct viewer attention.",
        dragItem: { label: "Arrow Swipe", mediaType: "video", durationFrames: 30 * 4, source: "element" },
      },
      {
        id: "element-burst",
        icon: "**",
        title: "Star Burst",
        description: "Burst badge for promos, discounts, and CTA.",
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
        description: "Primary large heading for the scene.",
        dragItem: { label: "Hero Title (H1)", mediaType: "video", durationFrames: 30 * 6, source: "element" },
      },
      {
        id: "text-h2",
        icon: "H2",
        title: "Section Title (H2)",
        description: "Section heading for a new topic.",
        dragItem: { label: "Section Title (H2)", mediaType: "video", durationFrames: 30 * 6, source: "element" },
      },
      {
        id: "text-h3",
        icon: "H3",
        title: "Topic Header (H3)",
        description: "Subheading for key points and bullets.",
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
        description: "Subtitle in a lower safe area.",
        dragItem: { label: "Subtitle", mediaType: "video", durationFrames: 30 * 4, source: "element" },
      },
      {
        id: "text-description",
        icon: "DS",
        title: "Description",
        description: "Description or clarification under the heading.",
        dragItem: { label: "Description", mediaType: "video", durationFrames: 30 * 7, source: "element" },
      },
      {
        id: "text-body",
        icon: "Tx",
        title: "Body Text",
        description: "Main body text for cards and scenes.",
        dragItem: { label: "Body Text", mediaType: "video", durationFrames: 30 * 8, source: "element" },
      },
      {
        id: "text-quote",
        icon: "\"\"",
        title: "Quote Block",
        description: "Quote block with emphasized typography.",
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

const TOOL_PANEL_MIN_WIDTH = 320;
const STREAMING_STEP_MS = 20;
const STREAMING_CHUNK_SIZE = 3;

const markdownSpecialLinePatterns = [/^#{1,3}\s+/, /^>\s+/, /^[-*\u2022]\s+/, /^\d+[.)]\s+/, /^```/];

const isMarkdownSpecialLine = (line: string) => markdownSpecialLinePatterns.some((pattern) => pattern.test(line));

const renderInlineMarkdown = (text: string, keyPrefix: string): ReactNode[] => {
  const chunks = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g);
  const nodes: ReactNode[] = [];

  chunks.forEach((chunk, index) => {
    if (!chunk) {
      return;
    }

    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      nodes.push(
        <code key={`${keyPrefix}-code-${index}`} className={styles.chatInlineCode}>
          {chunk.slice(1, -1)}
        </code>,
      );
      return;
    }

    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-strong-${index}`}>{chunk.slice(2, -2)}</strong>);
      return;
    }

    if (chunk.startsWith("*") && chunk.endsWith("*")) {
      nodes.push(<em key={`${keyPrefix}-em-${index}`}>{chunk.slice(1, -1)}</em>);
      return;
    }

    const linkMatch = chunk.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${index}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className={styles.chatLink}
        >
          {linkMatch[1]}
        </a>,
      );
      return;
    }

    nodes.push(<span key={`${keyPrefix}-text-${index}`}>{chunk}</span>);
  });

  return nodes;
};

const renderMarkdownMessage = (text: string) => {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]?.trimEnd() ?? "";

    if (!line.trim()) {
      lineIndex += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      lineIndex += 1;
      while (lineIndex < lines.length && !lines[lineIndex].startsWith("```")) {
        codeLines.push(lines[lineIndex]);
        lineIndex += 1;
      }
      lineIndex += 1;
      blocks.push(
        <pre key={`pre-${lineIndex}`} className={styles.chatCodeBlock}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const textValue = headingMatch[2];
      const className =
        level === 1 ? styles.chatHeading1 : level === 2 ? styles.chatHeading2 : styles.chatHeading3;
      blocks.push(
        <p key={`h-${lineIndex}`} className={className}>
          {renderInlineMarkdown(textValue, `h-${lineIndex}`)}
        </p>,
      );
      lineIndex += 1;
      continue;
    }

    if (/^>\s+/.test(line)) {
      const quoteLines: string[] = [];
      while (lineIndex < lines.length && /^>\s+/.test(lines[lineIndex])) {
        quoteLines.push(lines[lineIndex].replace(/^>\s+/, ""));
        lineIndex += 1;
      }
      blocks.push(
        <blockquote key={`q-${lineIndex}`} className={styles.chatBlockquote}>
          {quoteLines.join(" ")}
        </blockquote>,
      );
      continue;
    }

    if (/^[-*\u2022]\s+/.test(line)) {
      const listLines: string[] = [];
      while (lineIndex < lines.length && /^[-*\u2022]\s+/.test(lines[lineIndex])) {
        listLines.push(lines[lineIndex].replace(/^[-*\u2022]\s+/, ""));
        lineIndex += 1;
      }
      blocks.push(
        <ul key={`ul-${lineIndex}`} className={styles.chatList}>
          {listLines.map((item, itemIndex) => (
            <li key={`ul-${lineIndex}-${itemIndex}`}>{renderInlineMarkdown(item, `ul-${lineIndex}-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const orderedListLines: string[] = [];
      while (lineIndex < lines.length && /^\d+[.)]\s+/.test(lines[lineIndex])) {
        orderedListLines.push(lines[lineIndex].replace(/^\d+[.)]\s+/, ""));
        lineIndex += 1;
      }
      blocks.push(
        <ol key={`ol-${lineIndex}`} className={styles.chatList}>
          {orderedListLines.map((item, itemIndex) => (
            <li key={`ol-${lineIndex}-${itemIndex}`}>{renderInlineMarkdown(item, `ol-${lineIndex}-${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraphLines: string[] = [line];
    lineIndex += 1;
    while (
      lineIndex < lines.length &&
      lines[lineIndex].trim().length > 0 &&
      !isMarkdownSpecialLine(lines[lineIndex])
    ) {
      paragraphLines.push(lines[lineIndex]);
      lineIndex += 1;
    }

    blocks.push(
      <p key={`p-${lineIndex}`} className={styles.chatParagraph}>
        {paragraphLines.map((paragraphLine, paragraphLineIndex) => (
          <Fragment key={`p-${lineIndex}-${paragraphLineIndex}`}>
            {renderInlineMarkdown(paragraphLine, `p-${lineIndex}-${paragraphLineIndex}`)}
            {paragraphLineIndex < paragraphLines.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </p>,
    );
  }

  return blocks;
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

const getTranscriptionCandidate = (assets: AssetItem[]): AssetItem | null => {
  const videoAsset = assets.find((asset) => inferMediaTypeFromAsset(asset.file) === "video");
  if (videoAsset) {
    return videoAsset;
  }

  return assets.find((asset) => inferMediaTypeFromAsset(asset.file) === "audio") ?? null;
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

const TRANSCRIPTION_SAMPLE_RATE = 16000;

const downmixToMono = (audioBuffer: AudioBuffer): Float32Array => {
  const { length, numberOfChannels } = audioBuffer;
  if (numberOfChannels <= 1) {
    return audioBuffer.getChannelData(0).slice();
  }

  const mono = new Float32Array(length);
  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      mono[index] += channelData[index] / numberOfChannels;
    }
  }
  return mono;
};

const resampleLinear = (
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number,
): Float32Array => {
  if (inputSampleRate === targetSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = i * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(left + 1, input.length - 1);
    const mix = sourceIndex - left;
    output[i] = input[left] * (1 - mix) + input[right] * mix;
  }

  return output;
};

const encodeMono16BitWav = (samples: Float32Array, sampleRate: number): Blob => {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    const pcmValue = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, Math.round(pcmValue), true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
};

const createTranscriptionAudioFile = async (file: File): Promise<File> => {
  const isVideoOrAudio = file.type.startsWith("video/") || file.type.startsWith("audio/");
  if (!isVideoOrAudio) {
    return file;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    try {
      const decodedAudio = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const mono = downmixToMono(decodedAudio);
      const resampled = resampleLinear(mono, decodedAudio.sampleRate, TRANSCRIPTION_SAMPLE_RATE);
      const wavBlob = encodeMono16BitWav(resampled, TRANSCRIPTION_SAMPLE_RATE);

      return new File([wavBlob], `${file.name.replace(/\.[^/.]+$/, "")}-transcribe.wav`, {
        type: "audio/wav",
        lastModified: Date.now(),
      });
    } finally {
      await audioContext.close();
    }
  } catch {
    return file;
  }
};

const splitSubtitleText = (text: string, maxCharsPerChunk = 44): string[] => {
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerChunk) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = word;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
};

const colorNameMap: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  yellow: "#ffd400",
  red: "#ff3b30",
  green: "#34c759",
  blue: "#3b82f6",
  orange: "#ff8a00",
  pink: "#ff4fb3",
  purple: "#7c4dff",
  cyan: "#00c7d9",
  "бел": "#ffffff",
  "черн": "#000000",
  "желт": "#ffd400",
  "красн": "#ff3b30",
  "зелен": "#34c759",
  "син": "#3b82f6",
  "оранж": "#ff8a00",
  "розов": "#ff4fb3",
  "фиолет": "#7c4dff",
  "голуб": "#00c7d9",
};

const parseColorFromMessage = (message: string): string | null => {
  const hexMatch = message.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/i);
  if (hexMatch) {
    return hexMatch[0];
  }

  const lowered = message.toLowerCase();
  for (const [name, color] of Object.entries(colorNameMap)) {
    if (lowered.includes(name)) {
      return color;
    }
  }

  return null;
};

const parseSubtitleGenerationPreferences = (userMessage: string): SubtitleGenerationPreferences => {
  const wantsWordByWord =
    /(word by word|single word|one word|каждое слово|по словам|по одному слову|быстрые субтитры|быстро)/i.test(
      userMessage,
    );

  const isKaraokeStyle = /(karaoke|карaоке|тикток|tiktok|shorts|reels)/i.test(userMessage);
  const isMinimalStyle = /(minimal|минимал|чист|plain|simple)/i.test(userMessage);
  const wantsNoOutline = /(без обводки|no outline|outline off)/i.test(userMessage);
  const wantsNoBackground = /(без фона|no background|transparent bg)/i.test(userMessage);

  const requestedColor = parseColorFromMessage(userMessage);
  const textColor = requestedColor ?? "#ffffff";
  const outlineColor = wantsNoOutline ? null : "#000000";
  const outlineWidth = wantsNoOutline ? 0 : isKaraokeStyle ? 4 : 3;
  const backgroundColor = wantsNoBackground ? null : isKaraokeStyle ? "#000000" : null;
  const backgroundOpacity = wantsNoBackground ? 0 : isKaraokeStyle ? 0.6 : 0;
  const fontWeight = isMinimalStyle ? 600 : 700;
  const fontSizePx = wantsWordByWord ? 44 : isKaraokeStyle ? 40 : 34;
  const borderRadiusPx = backgroundColor ? 10 : 0;
  const paddingXPx = backgroundColor ? 12 : 0;
  const paddingYPx = backgroundColor ? 8 : 0;

  const isTop = /(top|сверху|верх)/i.test(userMessage);
  const isCenter = /(center|центр|по центру)/i.test(userMessage) && !isTop;

  const previewY = isTop ? 0.08 : isCenter ? 0.4 : 0.74;
  const previewHeight = wantsWordByWord ? 0.16 : 0.2;
  const previewWidth = wantsWordByWord ? 0.64 : 0.78;
  const previewX = (1 - previewWidth) / 2;

  return {
    timingMode: wantsWordByWord ? "word" : "phrase",
    previewX,
    previewY,
    previewWidth,
    previewHeight,
    maxCharsPerChunk: wantsWordByWord ? 18 : 42,
    style: {
      textColor,
      outlineColor,
      outlineWidth,
      backgroundColor,
      backgroundOpacity,
      fontWeight,
      fontSizePx,
      borderRadiusPx,
      paddingXPx,
      paddingYPx,
    },
  };
};

const buildSubtitleStyleFields = (style: SubtitleVisualStylePreferences) => ({
  subtitleTextColor: style.textColor,
  subtitleOutlineColor: style.outlineColor,
  subtitleOutlineWidth: style.outlineWidth,
  subtitleBackgroundColor: style.backgroundColor,
  subtitleBackgroundOpacity: style.backgroundOpacity,
  subtitleFontWeight: style.fontWeight,
  subtitleFontSizePx: style.fontSizePx,
  subtitleBorderRadiusPx: style.borderRadiusPx,
  subtitlePaddingXPx: style.paddingXPx,
  subtitlePaddingYPx: style.paddingYPx,
});

const createSubtitleEditingSchemaFromTranscript = (
  transcriptSegments: TranscriptSegment[],
  transcriptWords: TranscriptWord[],
  sequence: TimelineSequence,
  preferences: SubtitleGenerationPreferences,
): EditingSchema => {
  const frameRate = sequence.frameRate;
  const toFrame = (seconds: number) => Math.max(0, Math.round(seconds * frameRate));

  const wordsSource: TranscriptWord[] = transcriptWords
    .map((word) => ({
      startSeconds: Math.max(0, word.startSeconds),
      endSeconds: Math.max(word.endSeconds, word.startSeconds + 0.01),
      text: word.text.replace(/\s+/g, " ").trim(),
    }))
    .filter((word) => word.text.length > 0)
    .sort((a, b) => a.startSeconds - b.startSeconds);

  const subtitleFromWords = (() => {
    if (wordsSource.length === 0) {
      return [];
    }

    if (preferences.timingMode === "word") {
      return wordsSource.map((word) => ({
        name: word.text,
        startFrame: toFrame(word.startSeconds),
        durationFrames: Math.max(1, toFrame(word.endSeconds) - toFrame(word.startSeconds)),
        source: "element" as const,
        mediaUrl: null,
        previewX: preferences.previewX,
        previewY: preferences.previewY,
        previewWidth: preferences.previewWidth,
        previewHeight: preferences.previewHeight,
        ...buildSubtitleStyleFields(preferences.style),
      }));
    }

    const groups: Array<{ startSeconds: number; endSeconds: number; text: string }> = [];
    let currentGroup: { startSeconds: number; endSeconds: number; text: string } | null = null;
    const maxChars = preferences.maxCharsPerChunk;
    const maxDurationSeconds = 2.8;
    const maxGapSeconds = 0.32;

    for (const word of wordsSource) {
      if (!currentGroup) {
        currentGroup = {
          startSeconds: word.startSeconds,
          endSeconds: word.endSeconds,
          text: word.text,
        };
        continue;
      }

      const nextText: string = `${currentGroup.text} ${word.text}`;
      const nextDuration = word.endSeconds - currentGroup.startSeconds;
      const gap = Math.max(0, word.startSeconds - currentGroup.endSeconds);

      if (nextText.length <= maxChars && nextDuration <= maxDurationSeconds && gap <= maxGapSeconds) {
        currentGroup = {
          startSeconds: currentGroup.startSeconds,
          endSeconds: word.endSeconds,
          text: nextText,
        };
        continue;
      }

      groups.push(currentGroup);
      currentGroup = {
        startSeconds: word.startSeconds,
        endSeconds: word.endSeconds,
        text: word.text,
      };
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups.map((group) => ({
      name: group.text,
      startFrame: toFrame(group.startSeconds),
      durationFrames: Math.max(1, toFrame(group.endSeconds) - toFrame(group.startSeconds)),
      source: "element" as const,
      mediaUrl: null,
      previewX: preferences.previewX,
      previewY: preferences.previewY,
      previewWidth: preferences.previewWidth,
      previewHeight: preferences.previewHeight,
      ...buildSubtitleStyleFields(preferences.style),
    }));
  })();

  const subtitleFromSegments = transcriptSegments
    .flatMap((segment) => {
      const text = segment.text.replace(/\s+/g, " ").trim();
      const durationSeconds = Math.max(segment.endSeconds - segment.startSeconds, 0.05);
      if (!text) {
        return [];
      }

      const chunks = splitSubtitleText(text, preferences.maxCharsPerChunk);
      if (chunks.length <= 1) {
        return [
          {
            name: text,
            startFrame: toFrame(segment.startSeconds),
            durationFrames: Math.max(1, toFrame(segment.endSeconds) - toFrame(segment.startSeconds)),
            source: "element" as const,
            mediaUrl: null,
            previewX: preferences.previewX,
            previewY: preferences.previewY,
            previewWidth: preferences.previewWidth,
            previewHeight: preferences.previewHeight,
            ...buildSubtitleStyleFields(preferences.style),
          },
        ];
      }

      let wordsPassed = 0;
      const totalWords = Math.max(text.split(" ").filter(Boolean).length, 1);

      return chunks.map((chunk, index) => {
        const wordsInChunk = Math.max(chunk.split(" ").filter(Boolean).length, 1);
        const chunkStart = segment.startSeconds + (durationSeconds * wordsPassed) / totalWords;
        wordsPassed += wordsInChunk;
        const chunkEnd =
          index === chunks.length - 1
            ? segment.endSeconds
            : segment.startSeconds + (durationSeconds * wordsPassed) / totalWords;

        return {
          name: chunk,
          startFrame: toFrame(chunkStart),
          durationFrames: Math.max(1, toFrame(chunkEnd) - toFrame(chunkStart)),
          source: "element" as const,
          mediaUrl: null,
          previewX: preferences.previewX,
          previewY: preferences.previewY,
          previewWidth: preferences.previewWidth,
          previewHeight: preferences.previewHeight,
          ...buildSubtitleStyleFields(preferences.style),
        };
      });
    })
    .map((clip) => {
      const maxStart = Math.max(sequence.durationFrames - 1, 0);
      const safeStart = Math.min(Math.max(clip.startFrame, 0), maxStart);
      const safeDuration = Math.max(1, Math.min(clip.durationFrames, sequence.durationFrames - safeStart));
      return {
        ...clip,
        startFrame: safeStart,
        durationFrames: safeDuration,
      };
    })
    .filter((clip) => clip.durationFrames > 0)
    .sort((a, b) => a.startFrame - b.startFrame);

  const subtitleClips = subtitleFromWords.length > 0 ? subtitleFromWords : subtitleFromSegments;

  return {
    version: "1.0",
    assistantMessage:
      preferences.timingMode === "word"
        ? "Субтитры добавлены в режиме по словам с выбранным стилем."
        : "Субтитры добавлены фразами с выбранным стилем.",
    durationFrames: null,
    tracks: [
      {
        type: "subtitle",
        index: 0,
        clips: subtitleClips,
      },
    ],
  };
};const getPreviewDefaultsForItem = (item: SidebarTimelineItem) => {
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
  const [, setAiStatus] = useState<string | null>(null);
  const [isAiRequestInFlight, setIsAiRequestInFlight] = useState(false);
  const [showAiThinking, setShowAiThinking] = useState(false);
  const [toolPanelWidth, setToolPanelWidth] = useState(360);
  const [transcriptByAssetId, setTranscriptByAssetId] = useState<Record<string, TranscriptSegment[]>>({});
  const [transcriptWordsByAssetId, setTranscriptWordsByAssetId] = useState<Record<string, TranscriptWord[]>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const chatThreadEndRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    chatThreadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aiMessages, isAiRequestInFlight]);

  useEffect(() => {
    const clampWidth = () => {
      const workspaceWidth = workspaceRef.current?.clientWidth ?? 0;
      if (!workspaceWidth) {
        return;
      }
      const maxAllowed = Math.max(TOOL_PANEL_MIN_WIDTH, Math.floor(workspaceWidth * 0.5));
      setToolPanelWidth((currentWidth) => Math.min(Math.max(currentWidth, TOOL_PANEL_MIN_WIDTH), maxAllowed));
    };

    clampWidth();
    window.addEventListener("resize", clampWidth);

    return () => {
      window.removeEventListener("resize", clampWidth);
    };
  }, []);

  const streamAssistantText = async (fullText: string) => {
    const text = fullText.trim();
    if (!text) {
      return;
    }

    setShowAiThinking(false);

    const messageId = `assistant-${crypto.randomUUID()}`;
    setAiMessages((currentMessages) => [...currentMessages, { id: messageId, role: "assistant", text: "" }]);

    let cursor = 0;
    while (cursor < text.length) {
      cursor = Math.min(cursor + STREAMING_CHUNK_SIZE, text.length);
      const nextText = text.slice(0, cursor);
      setAiMessages((currentMessages) =>
        currentMessages.map((message) => (message.id === messageId ? { ...message, text: nextText } : message)),
      );
      // Smooth visible streaming in the chat bubble.
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), STREAMING_STEP_MS);
      });
    }
  };

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

  const handleAiInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (!isAiRequestInFlight) {
      void handleAiEditSubmit();
    }
  };

  const handleToolPanelResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!workspaceRef.current) {
      return;
    }

    event.preventDefault();

    const startX = event.clientX;
    const startWidth = toolPanelWidth;
    const maxWidth = Math.max(TOOL_PANEL_MIN_WIDTH, Math.floor(workspaceRef.current.clientWidth * 0.5));

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.min(Math.max(startWidth + delta, TOOL_PANEL_MIN_WIDTH), maxWidth);
      setToolPanelWidth(nextWidth);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const hasTimelineChanged = (before: TimelineSequence, after: TimelineSequence): boolean =>
    JSON.stringify(before) !== JSON.stringify(after);

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
    setShowAiThinking(true);

    try {
      const isSubtitleRequest = SUBTITLE_REQUEST_PATTERN.test(trimmedMessage);
      let transcriptSegments: TranscriptSegment[] = [];
      let transcriptWords: TranscriptWord[] = [];

      if (isSubtitleRequest) {
        const transcriptionAsset = getTranscriptionCandidate(assets);

        if (!transcriptionAsset) {
          await streamAssistantText("Cannot create real subtitles: no video or audio source was found for transcription.");
          setAiStatus("Transcription source is missing.");
          return;
        }

        const cachedTranscript = transcriptByAssetId[transcriptionAsset.id];
        const cachedWords = transcriptWordsByAssetId[transcriptionAsset.id];
        if (cachedTranscript && cachedTranscript.length > 0) {
          transcriptSegments = cachedTranscript;
          transcriptWords = cachedWords ?? [];
        } else {
          setAiStatus(`Transcribing ${transcriptionAsset.file.name}...`);

          const preparedTranscriptionFile = await createTranscriptionAudioFile(transcriptionAsset.file);
          const transcriptionForm = new FormData();
          transcriptionForm.append(
            "file",
            preparedTranscriptionFile,
            preparedTranscriptionFile.name,
          );

          const transcriptionResponse = await fetch("/api/transcribe", {
            method: "POST",
            body: transcriptionForm,
          });

          const transcriptionPayload = (await transcriptionResponse.json()) as TranscriptionRouteResponse;

          if (!transcriptionResponse.ok || !transcriptionPayload.segments?.length) {
            const errorText = transcriptionPayload.error ?? "Transcription request failed.";
            const extraDetails = transcriptionPayload.details ? ` ${transcriptionPayload.details}` : "";
            await streamAssistantText(`${errorText}${extraDetails}`.trim());
            setAiStatus("Transcription failed.");
            return;
          }

          transcriptSegments = transcriptionPayload.segments;
          transcriptWords = Array.isArray(transcriptionPayload.words) ? transcriptionPayload.words : [];
          setTranscriptByAssetId((current) => ({
            ...current,
            [transcriptionAsset.id]: transcriptionPayload.segments ?? [],
          }));
          setTranscriptWordsByAssetId((current) => ({
            ...current,
            [transcriptionAsset.id]: transcriptionPayload.words ?? [],
          }));
        }

        const subtitlePreferences = parseSubtitleGenerationPreferences(trimmedMessage);
        const directSubtitleSchema = createSubtitleEditingSchemaFromTranscript(
          transcriptSegments,
          transcriptWords,
          currentSequenceRef.current,
          subtitlePreferences,
        );
        const previousSequence = currentSequenceRef.current;
        const nextSequence = applyEditingSchemaToTimeline(
          previousSequence,
          directSubtitleSchema,
        );

        if (!hasTimelineChanged(previousSequence, nextSequence)) {
          await streamAssistantText("Не получилось применить изменения на дорожку. Уточните, что именно добавить или изменить.");
          setAiStatus("Subtitle schema produced no timeline changes.");
          return;
        }

        setTimelineSequence(nextSequence);
        currentSequenceRef.current = nextSequence;
        setTimelinePanelKey((current) => current + 1);
        await streamAssistantText(directSubtitleSchema.assistantMessage);
        setAiStatus("Real subtitle track applied from transcript.");
        return;
      }

      let assistantMessageId: string | null = null;
      let hasReceivedAssistantDelta = false;

      const ensureAssistantMessage = () => {
        if (assistantMessageId) {
          return assistantMessageId;
        }
        const nextId = `assistant-${crypto.randomUUID()}`;
        assistantMessageId = nextId;
        setAiMessages((currentMessages) => [...currentMessages, { id: nextId, role: "assistant", text: "" }]);
        return nextId;
      };

      const patchAssistantMessage = (applyPatch: (previousText: string) => string) => {
        const targetMessageId = ensureAssistantMessage();
        setAiMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === targetMessageId ? { ...message, text: applyPatch(message.text) } : message,
          ),
        );
      };

      const response = await fetch("/api/ai-edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userMessage: trimmedMessage,
          assets: buildAiAssetContext(assets),
          currentSequence: currentSequenceRef.current,
          transcriptSegments,
        }),
      });

      if (!response.ok) {
        setShowAiThinking(false);
        let fallbackError = "AI Edit request failed.";
        try {
          const payload = (await response.json()) as AiEditRouteResponse;
          const errorText = payload.error ?? fallbackError;
          const extraDetails = payload.details ? ` ${payload.details}` : "";
          fallbackError = `${errorText}${extraDetails}`.trim();
        } catch {
          // Keep fallback error text.
        }
        patchAssistantMessage(() => fallbackError);
        setAiStatus("Failed to apply AI editing schema.");
        return;
      }

      if (!response.body) {
        setShowAiThinking(false);
        patchAssistantMessage(() => "AI Edit stream is empty.");
        setAiStatus("Failed to apply AI editing schema.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let editingSchema: EditingSchema | null = null;
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        streamBuffer += decoder.decode(value, { stream: true });

        let lineBreakIndex = streamBuffer.indexOf("\n");
        while (lineBreakIndex !== -1) {
          const line = streamBuffer.slice(0, lineBreakIndex).trim();
          streamBuffer = streamBuffer.slice(lineBreakIndex + 1);

          if (line) {
            try {
              const streamEvent = JSON.parse(line) as AiEditStreamEvent;
              if (streamEvent.type === "assistant_delta" && typeof streamEvent.delta === "string") {
                if (!hasReceivedAssistantDelta) {
                  setShowAiThinking(false);
                }
                patchAssistantMessage((previousText) => {
                  if (!hasReceivedAssistantDelta) {
                    hasReceivedAssistantDelta = true;
                    return streamEvent.delta;
                  }
                  return previousText + streamEvent.delta;
                });
              } else if (streamEvent.type === "error") {
                setShowAiThinking(false);
                const details = streamEvent.details ? ` ${streamEvent.details}` : "";
                streamError = `${streamEvent.error}${details}`.trim();
                patchAssistantMessage(() => streamError ?? "AI Edit stream error.");
              } else if (streamEvent.type === "done") {
                setShowAiThinking(false);
                editingSchema = streamEvent.editingSchema;
                patchAssistantMessage(() => streamEvent.editingSchema.assistantMessage);
              }
            } catch {
              // Ignore malformed line and continue stream parsing.
            }
          }

          lineBreakIndex = streamBuffer.indexOf("\n");
        }
      }

      if (streamError) {
        setAiStatus("Failed to apply AI editing schema.");
        return;
      }

      if (!editingSchema) {
        patchAssistantMessage((previousText) => previousText || "AI Edit stream completed without schema.");
        setAiStatus("AI response did not include editing schema.");
        return;
      }

      const previousSequence = currentSequenceRef.current;
      const nextSequence = applyEditingSchemaToTimeline(previousSequence, editingSchema);

      if (!hasTimelineChanged(previousSequence, nextSequence)) {
        patchAssistantMessage((previousText) => {
          const fallbackText = "Не внес изменения на дорожку. Уточните задачу или добавьте нужные ассеты.";
          return previousText.trim().length > 0
            ? `${previousText}\n\n${fallbackText}`
            : fallbackText;
        });
        setAiStatus("AI schema produced no timeline changes.");
        return;
      }

      setTimelineSequence(nextSequence);
      currentSequenceRef.current = nextSequence;
      setTimelinePanelKey((current) => current + 1);
      setAiStatus("Editing schema applied to timeline.");
    } catch {
      setShowAiThinking(false);
      await streamAssistantText("Network error while requesting OpenAI API.");
      setAiStatus("Network error.");
    } finally {
      setIsAiRequestInFlight(false);
      setShowAiThinking(false);
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
          {showAiThinking ? <p className={styles.chatThinkingStatus}>Thinking...</p> : null}
          <div className={styles.chatThread}>
            {aiMessages.length === 0 && !showAiThinking ? (
              <div className={styles.chatEmptyState}>
                <div className={styles.chatEmptyLogo} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                    <path d="M7.2 7.2l9.6 9.6" />
                    <path d="M16.8 7.2l-9.6 9.6" />
                  </svg>
                </div>
              </div>
            ) : null}
            {aiMessages.map((message) => (
              <div
                key={message.id}
                className={message.role === "user" ? styles.chatRowUser : styles.chatRowAssistant}
              >
                <article className={message.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant}>
                  {message.role === "assistant" ? (
                    <div className={styles.chatMarkdown}>{renderMarkdownMessage(message.text)}</div>
                  ) : (
                    <p className={styles.chatPlainText}>{message.text}</p>
                  )}
                </article>
              </div>
            ))}
            <div ref={chatThreadEndRef} />
          </div>
          <div className={styles.chatComposer}>
            <div className={styles.chatInputWrap}>
              <textarea
                className={styles.chatInput}
                value={aiMessageDraft}
                onChange={(event) => setAiMessageDraft(event.target.value)}
                onKeyDown={handleAiInputKeyDown}
                placeholder="Describe the edit you need..."
              />
              <button
                type="button"
                className={styles.chatSendInline}
                onClick={() => void handleAiEditSubmit()}
                disabled={isAiRequestInFlight || aiMessageDraft.trim().length === 0}
                aria-label="Send message"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h11" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </>
      );
    }

    if (activeItem.id === "assets") {
      return (
        <>
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
          <p className={styles.libraryIntro}>Ready-made typography presets: from H1 to subtitle and body.</p>
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
        <p className={styles.toolPanelText}>Panel for {activeItem.label} will appear here.</p>
      </>
    );
  };

  return (
    <main className={styles.page}>
      <div ref={workspaceRef} className={styles.workspace}>
        <div className={styles.leftRail}>
          <header className={`${styles.columnHeader} ${styles.leftRailHeader}`} aria-label="Tools header">
            <span className={styles.topHeaderBrandMark} aria-hidden="true">
              V
            </span>
          </header>
          <aside className={styles.sidebar} aria-label="Editor tools">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.sidebarItem} ${
                  activeItemId === item.id ? styles.sidebarItemActive : ""
                }`}
                onClick={() => handleSidebarItemClick(item.id)}
                aria-label={item.label}
                title={item.label}
              >
                <span className={styles.sidebarIcon} aria-hidden="true">
                  <SidebarNavIcon itemId={item.id} />
                </span>
                <span className={styles.sidebarItemLabel}>{item.label}</span>
              </button>
            ))}
          </aside>
        </div>
        {activeItem ? (
          <div
            className={styles.toolPanelColumn}
            style={{ width: toolPanelWidth, minWidth: toolPanelWidth, maxWidth: toolPanelWidth }}
          >
            <header className={styles.columnHeader} aria-label="Panel header">
              <span className={styles.panelHeaderTitle}>{activeItem.label}</span>
            </header>
            <aside className={styles.toolPanel}>{renderSidebarPanel()}</aside>
            <div
              className={styles.toolPanelResizeHandle}
              onPointerDown={handleToolPanelResizeStart}
              role="separator"
              aria-label="Resize sidebar panel"
              aria-orientation="vertical"
            />
          </div>
        ) : null}
        <section className={styles.editorColumn}>
          <header className={`${styles.columnHeader} ${styles.editorHeader}`} aria-label="Preview header">
            <div className={styles.previewHeaderLeft}>
              <button type="button" className={styles.previewHeaderGhostButton} aria-label="Layout">
                []
              </button>
              <button type="button" className={styles.previewHeaderModeButton}>
                <span className={styles.previewHeaderModeDot} aria-hidden="true" />
                RVE
              </button>
            </div>
            <div className={styles.previewHeaderRight}>
              <button type="button" className={styles.previewHeaderGhostButton} aria-label="History">
                H
              </button>
              <button type="button" className={styles.previewHeaderGhostButton} aria-label="Notifications">
                N
              </button>
              <button type="button" className={styles.previewHeaderPrimaryAction}>
                Render Video
              </button>
            </div>
          </header>
          <div className={styles.editorContent}>
            <TimelinePanel
              key={timelinePanelKey}
              sequence={timelineSequence}
              onSequenceChange={(nextSequence) => {
                currentSequenceRef.current = nextSequence;
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}







