import { VideoSchema } from "../model/schema";

export function ensureFallbackScene(schema: VideoSchema): VideoSchema {
  if (schema.scenes.length > 0) {
    return schema;
  }

  return {
    ...schema,
    scenes: [
      {
        id: `scene-${Date.now().toString(36)}`,
        name: "Scene",
        startFrame: 0,
        durationInFrames: Math.max(1, schema.durationInFrames),
        backgroundColor: schema.backgroundColor,
        elements: [],
      },
    ],
  };
}
