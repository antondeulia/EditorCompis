import { SidebarTimelineItem } from "@/features/timeline/lib/dragTransfer";

export type EditorSidebarItemId = "assets" | "chat" | "elements" | "text" | "json";

export interface EditorAssetItem {
  id: string;
  file: File;
  previewUrl: string | null;
  durationSeconds: number | null;
}

export interface EditorSidebarItemDefinition {
  id: EditorSidebarItemId;
  label: string;
}

export interface EditorSidebarLibraryItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  dragItem: SidebarTimelineItem;
}

export interface EditorSidebarLibrarySection {
  id: string;
  title: string;
  items: EditorSidebarLibraryItem[];
}

export interface EditorChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}
