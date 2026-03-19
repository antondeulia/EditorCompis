import { TimelineSequence } from "@/features/timeline/types/timeline";

export const createInitialTimelineSequence = (): TimelineSequence => ({
  id: "sequence-main",
  name: "Main Sequence",
  frameRate: 30,
  durationFrames: 30 * 300,
  tracks: [
    {
      id: "track-v1",
      name: "V1",
      type: "video",
      clips: [],
    },
    {
      id: "track-v2",
      name: "V2",
      type: "video",
      clips: [],
    },
    {
      id: "track-v3",
      name: "V3",
      type: "video",
      clips: [],
    },
    {
      id: "track-a1",
      name: "A1",
      type: "audio",
      clips: [],
    },
    {
      id: "track-a2",
      name: "A2",
      type: "audio",
      clips: [],
    },
    {
      id: "track-a3",
      name: "A3",
      type: "audio",
      clips: [],
    },
    {
      id: "track-s1",
      name: "S1",
      type: "subtitle",
      clips: [],
    },
  ],
});
