import { SidebarTimelineItem } from "@/features/timeline/lib/dragTransfer";
import { TimelineClip } from "@/features/timeline/types/timeline";

import { clamp } from "./clamp";

const TEXT_PRESET_PATTERN = /(title|subtitle|header|text|quote|description|body|h1|h2|h3|lower third)/i;
const PREVIEW_ORIGIN_MAX = 0.92;
const PREVIEW_SIZE_MIN = 0.08;

export interface PreviewLayout {
  previewX: number;
  previewY: number;
  previewWidth: number;
  previewHeight: number;
}

const DEFAULT_CLIP_LAYOUT: PreviewLayout = {
  previewX: 0.2,
  previewY: 0.2,
  previewWidth: 0.6,
  previewHeight: 0.22,
};

const DEFAULT_ELEMENT_LAYOUT: PreviewLayout = {
  previewX: 0.33,
  previewY: 0.3,
  previewWidth: 0.34,
  previewHeight: 0.2,
};

const getDescriptorText = (input: string | Pick<TimelineClip, "name" | "elementPreset">) => {
  if (typeof input === "string") {
    return input;
  }

  return input.elementPreset?.trim() || input.name;
};

const getClipText = (input: string | Pick<TimelineClip, "name" | "content">) => {
  if (typeof input === "string") {
    return input;
  }

  return input.content?.displayText?.trim() || input.name;
};

const getDefaultPreviewLayoutForLabel = (label: string): PreviewLayout => {
  const loweredLabel = label.toLowerCase();

  if (loweredLabel.includes("background") || loweredLabel.includes("backdrop")) {
    return {
      previewX: 0,
      previewY: 0,
      previewWidth: 1,
      previewHeight: 1,
    };
  }

  if (loweredLabel.includes("lower third")) {
    return {
      previewX: 0.05,
      previewY: 0.74,
      previewWidth: 0.48,
      previewHeight: 0.16,
    };
  }

  if (loweredLabel.includes("callout")) {
    return {
      previewX: 0.57,
      previewY: 0.18,
      previewWidth: 0.28,
      previewHeight: 0.24,
    };
  }

  if (loweredLabel.includes("progress")) {
    return {
      previewX: 0.12,
      previewY: 0.84,
      previewWidth: 0.76,
      previewHeight: 0.08,
    };
  }

  if (loweredLabel.includes("split")) {
    return {
      previewX: 0.08,
      previewY: 0.14,
      previewWidth: 0.84,
      previewHeight: 0.66,
    };
  }

  if (loweredLabel.includes("arrow")) {
    return {
      previewX: 0.18,
      previewY: 0.44,
      previewWidth: 0.64,
      previewHeight: 0.16,
    };
  }

  if (loweredLabel.includes("burst")) {
    return {
      previewX: 0.64,
      previewY: 0.12,
      previewWidth: 0.2,
      previewHeight: 0.2,
    };
  }

  if (isTextPresetLabel(loweredLabel)) {
    if (loweredLabel.includes("subtitle")) {
      return {
        previewX: 0.26,
        previewY: 0.78,
        previewWidth: 0.48,
        previewHeight: 0.11,
      };
    }

    if (loweredLabel.includes("h1") || loweredLabel.includes("hero")) {
      return {
        previewX: 0.18,
        previewY: 0.1,
        previewWidth: 0.64,
        previewHeight: 0.18,
      };
    }

    if (loweredLabel.includes("h2") || loweredLabel.includes("h3") || loweredLabel.includes("header")) {
      return {
        previewX: 0.16,
        previewY: 0.18,
        previewWidth: 0.68,
        previewHeight: 0.14,
      };
    }

    return {
      previewX: 0.16,
      previewY: 0.3,
      previewWidth: 0.68,
      previewHeight: 0.18,
    };
  }

  if (loweredLabel.includes("circle")) {
    return {
      previewX: 0.39,
      previewY: 0.32,
      previewWidth: 0.22,
      previewHeight: 0.22,
    };
  }

  if (loweredLabel.includes("triangle")) {
    return {
      previewX: 0.35,
      previewY: 0.36,
      previewWidth: 0.3,
      previewHeight: 0.22,
    };
  }

  if (loweredLabel.includes("line")) {
    return {
      previewX: 0.25,
      previewY: 0.47,
      previewWidth: 0.5,
      previewHeight: 0.07,
    };
  }

  return DEFAULT_ELEMENT_LAYOUT;
};

export const normalizePreviewLayout = (layout: PreviewLayout): PreviewLayout => ({
  previewX: clamp(layout.previewX, 0, PREVIEW_ORIGIN_MAX),
  previewY: clamp(layout.previewY, 0, PREVIEW_ORIGIN_MAX),
  previewWidth: clamp(layout.previewWidth, PREVIEW_SIZE_MIN, 1),
  previewHeight: clamp(layout.previewHeight, PREVIEW_SIZE_MIN, 1),
});

export const isTextPresetLabel = (label: string) => TEXT_PRESET_PATTERN.test(label.toLowerCase());

export const getPreviewDefaultsForSidebarItem = (
  item: Pick<
    SidebarTimelineItem,
    "label" | "mediaType" | "source" | "previewX" | "previewY" | "previewWidth" | "previewHeight"
  >,
): PreviewLayout => {
  if (
    typeof item.previewX === "number" &&
    typeof item.previewY === "number" &&
    typeof item.previewWidth === "number" &&
    typeof item.previewHeight === "number"
  ) {
    return normalizePreviewLayout({
      previewX: item.previewX,
      previewY: item.previewY,
      previewWidth: item.previewWidth,
      previewHeight: item.previewHeight,
    });
  }

  if (item.source === "asset" && item.mediaType === "video") {
    return {
      previewX: 0,
      previewY: 0,
      previewWidth: 1,
      previewHeight: 1,
    };
  }

  return getDefaultPreviewLayoutForLabel(item.label);
};

export const getPreviewLayoutForClip = (clip: TimelineClip): PreviewLayout => {
  const hasExplicitLayout =
    typeof clip.previewX === "number" &&
    typeof clip.previewY === "number" &&
    typeof clip.previewWidth === "number" &&
    typeof clip.previewHeight === "number";

  if (hasExplicitLayout) {
    return normalizePreviewLayout({
      previewX: clip.previewX!,
      previewY: clip.previewY!,
      previewWidth: clip.previewWidth!,
      previewHeight: clip.previewHeight!,
    });
  }

  if (clip.source === "asset" && clip.mediaUrl) {
    return {
      previewX: 0,
      previewY: 0,
      previewWidth: 1,
      previewHeight: 1,
    };
  }

  if (clip.source === "element") {
    return getDefaultPreviewLayoutForLabel(getDescriptorText(clip));
  }

  return DEFAULT_CLIP_LAYOUT;
};

export type PreviewElementVariant =
  | "text"
  | "background"
  | "circle"
  | "triangle"
  | "line"
  | "callout"
  | "progress"
  | "split"
  | "arrow"
  | "burst"
  | "shape";

export const getPreviewElementVariant = (
  input: string | Pick<TimelineClip, "name" | "elementPreset">,
): PreviewElementVariant => {
  const loweredName = getDescriptorText(input).toLowerCase();

  if (loweredName.includes("background") || loweredName.includes("backdrop")) {
    return "background";
  }

  if (loweredName.includes("callout") || loweredName.includes("lower third")) {
    return "callout";
  }

  if (loweredName.includes("progress")) {
    return "progress";
  }

  if (loweredName.includes("split")) {
    return "split";
  }

  if (loweredName.includes("arrow")) {
    return "arrow";
  }

  if (loweredName.includes("burst")) {
    return "burst";
  }

  if (isTextPresetLabel(loweredName)) {
    return "text";
  }

  if (loweredName.includes("circle")) {
    return "circle";
  }

  if (loweredName.includes("triangle")) {
    return "triangle";
  }

  if (loweredName.includes("line")) {
    return "line";
  }

  return "shape";
};

export const getPreviewTextLabel = (input: string | Pick<TimelineClip, "name" | "content">) => {
  const raw = getClipText(input).replace(/\s*\(h\d\)/i, "").trim();
  const presetPrefixedMatch = /^(hero title|section title|topic header|subtitle|description|body text|quote block|lower third pro|callout bubble)\s*:\s*(.+)$/i.exec(raw);
  if (presetPrefixedMatch?.[2]) {
    return presetPrefixedMatch[2].trim();
  }

  return raw;
};

export const isFullFramePreviewLayout = (layout: PreviewLayout) => {
  return (
    layout.previewX <= 0.001 &&
    layout.previewY <= 0.001 &&
    layout.previewWidth >= 0.999 &&
    layout.previewHeight >= 0.999
  );
};
