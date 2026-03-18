import { TimelineTrackType } from "@/features/timeline/types/timeline";

export interface SidebarTimelineItem {
  label: string;
  mediaType: TimelineTrackType;
  durationFrames: number;
  source: "asset" | "element";
  mediaUrl?: string;
}

let currentTimelineDragItem: SidebarTimelineItem | null = null;

export const setCurrentTimelineDragItem = (item: SidebarTimelineItem | null) => {
  currentTimelineDragItem = item;
};

export const getCurrentTimelineDragItem = () => currentTimelineDragItem;

export const clearCurrentTimelineDragItem = () => {
  currentTimelineDragItem = null;
};
