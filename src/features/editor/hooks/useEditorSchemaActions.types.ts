import { Dispatch, SetStateAction } from "react";
import { AssetItem, SelectedTimelineTrack } from "../model/types";
import { VideoElement, VideoSchema } from "../model/schema";

export type SelectedOverlayElement =
  | {
      sceneId: string;
      elementIndex: number;
      element: VideoElement;
    }
  | null;

export type UseEditorSchemaActionsParams = {
  currentFrame: number;
  selectedTimelineTrack: SelectedTimelineTrack | null;
  selectedOverlayElement: SelectedOverlayElement;
  resolveAssetById: (assetId: string) => AssetItem | undefined;
  setVideoSchema: Dispatch<SetStateAction<VideoSchema>>;
  setSelectedElementKey: Dispatch<SetStateAction<string | null>>;
  setSelectedTimelineTrack: Dispatch<SetStateAction<SelectedTimelineTrack | null>>;
};
