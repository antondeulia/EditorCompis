import { EditingSchema } from "@/features/ai-editing/types/editingSchema";
import { SidebarTimelineItem } from "@/features/timeline/lib/dragTransfer";

export type SidebarItemId = "assets" | "ai-edit" | "ai-tools" | "elements" | "text" | "json";

export interface AssetItem {
  id: string;
  file: File;
  previewUrl: string | null;
  durationSeconds: number | null;
}

export interface AiEditMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface AiEditAssetContext {
  id: string;
  name: string;
  mediaType: "video" | "audio" | "unknown";
  durationFrames: number | null;
}

export interface AiEditRouteResponse {
  editingSchema?: EditingSchema;
  error?: string;
  details?: string;
}

export interface AiEditStreamDoneEvent {
  type: "done";
  editingSchema: EditingSchema;
  usage?: unknown;
  model?: string;
}

export interface AiEditStreamErrorEvent {
  type: "error";
  error: string;
  details?: string;
}

export interface AiEditStreamDeltaEvent {
  type: "assistant_delta";
  delta: string;
}

export interface AiEditStreamStartedEvent {
  type: "assistant_started";
}

export type AiEditStreamEvent =
  | AiEditStreamDoneEvent
  | AiEditStreamErrorEvent
  | AiEditStreamDeltaEvent
  | AiEditStreamStartedEvent;

export interface TranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface TranscriptWord {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface TranscriptionRouteResponse {
  segments?: TranscriptSegment[];
  words?: TranscriptWord[];
  error?: string;
  details?: string;
}

export type SubtitleTimingMode = "phrase" | "word";

export interface SubtitleVisualStylePreferences {
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

export interface SubtitleGenerationPreferences {
  timingMode: SubtitleTimingMode;
  previewX: number;
  previewY: number;
  previewWidth: number;
  previewHeight: number;
  maxCharsPerChunk: number;
  style: SubtitleVisualStylePreferences;
}

export interface SidebarItemDefinition {
  id: SidebarItemId;
  label: string;
}

export interface SidebarLibraryItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  dragItem: SidebarTimelineItem;
}

export interface SidebarLibrarySection {
  id: string;
  title: string;
  items: SidebarLibraryItem[];
}
