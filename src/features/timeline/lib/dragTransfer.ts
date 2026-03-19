import { TimelineTrackType } from "@/features/timeline/types/timeline";

export interface SidebarTimelineItem {
  label: string;
  mediaType: TimelineTrackType;
  durationFrames: number;
  source: "asset" | "element";
  mediaUrl?: string;
  previewX?: number;
  previewY?: number;
  previewWidth?: number;
  previewHeight?: number;
}

let currentTimelineDragItem: SidebarTimelineItem | null = null;
const TIMELINE_DRAG_MIME = "application/x-timeline-item";

export const setCurrentTimelineDragItem = (item: SidebarTimelineItem | null) => {
  currentTimelineDragItem = item;
};

export const getCurrentTimelineDragItem = () => currentTimelineDragItem;

export const clearCurrentTimelineDragItem = () => {
  currentTimelineDragItem = null;
};

export const parseTimelineDragItemFromDataTransfer = (
  dataTransfer: DataTransfer,
): SidebarTimelineItem | null => {
  const payload = dataTransfer.getData(TIMELINE_DRAG_MIME);

  if (!payload) {
    return getCurrentTimelineDragItem();
  }

  try {
    const parsed = JSON.parse(payload) as Partial<SidebarTimelineItem>;

    if (
      typeof parsed.label !== "string" ||
      (parsed.mediaType !== "video" && parsed.mediaType !== "audio" && parsed.mediaType !== "subtitle") ||
      typeof parsed.durationFrames !== "number" ||
      (parsed.source !== "asset" && parsed.source !== "element") ||
      (parsed.mediaUrl !== undefined && typeof parsed.mediaUrl !== "string")
    ) {
      return getCurrentTimelineDragItem();
    }

    if (
      (parsed.previewX !== undefined && typeof parsed.previewX !== "number") ||
      (parsed.previewY !== undefined && typeof parsed.previewY !== "number") ||
      (parsed.previewWidth !== undefined && typeof parsed.previewWidth !== "number") ||
      (parsed.previewHeight !== undefined && typeof parsed.previewHeight !== "number")
    ) {
      return getCurrentTimelineDragItem();
    }

    return {
      label: parsed.label,
      mediaType: parsed.mediaType,
      durationFrames: parsed.durationFrames,
      source: parsed.source,
      mediaUrl: parsed.mediaUrl,
      previewX: parsed.previewX,
      previewY: parsed.previewY,
      previewWidth: parsed.previewWidth,
      previewHeight: parsed.previewHeight,
    };
  } catch {
    return getCurrentTimelineDragItem();
  }
};