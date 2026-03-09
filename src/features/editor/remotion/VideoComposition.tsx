"use client";

import { CSSProperties } from "react";
import { AbsoluteFill, Easing, Img, Sequence, Video, interpolate, useCurrentFrame } from "remotion";
import { ElementAnimation, VideoElement, VideoSchema } from "../model/schema";
import { getElementEffectiveTimelineRange, getFrameRange } from "../lib/utils";
import { editableOverlayKinds } from "../model/constants";

type VideoCompositionProps = {
  schema: VideoSchema;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function resolveEasing(name?: ElementAnimation["easing"]) {
  if (name === "ease-in-out") {
    return Easing.inOut(Easing.cubic);
  }

  if (name === "ease-out") {
    return Easing.out(Easing.cubic);
  }

  return Easing.linear;
}

function applyAnimations(element: VideoElement, frame: number) {
  let x = element.x;
  let y = element.y;
  let opacity = element.opacity ?? 1;
  let scale = element.scale ?? 1;
  let rotation = element.rotation ?? 0;

  for (const animation of element.animations ?? []) {
    const durationInFrames = Math.max(1, animation.durationInFrames);
    const progress = clamp01((frame - animation.startFrame) / durationInFrames);
    const eased = resolveEasing(animation.easing)(progress);

    if (animation.type === "fade") {
      opacity = interpolate(eased, [0, 1], [animation.from, animation.to]);
    }

    if (animation.type === "move") {
      x = interpolate(eased, [0, 1], [animation.from.x, animation.to.x]);
      y = interpolate(eased, [0, 1], [animation.from.y, animation.to.y]);
    }

    if (animation.type === "scale") {
      scale = interpolate(eased, [0, 1], [animation.from, animation.to]);
    }

    if (animation.type === "rotate") {
      rotation = interpolate(eased, [0, 1], [animation.from, animation.to]);
    }
  }

  return { x, y, opacity, scale, rotation };
}

function buildElementStyle(element: VideoElement, frame: number): CSSProperties {
  const motion = applyAnimations(element, frame);

  return {
    position: "absolute",
    left: motion.x,
    top: motion.y,
    width: element.width,
    height: element.height,
    zIndex: element.zIndex,
    opacity: motion.opacity,
    transform: `scale(${motion.scale}) rotate(${motion.rotation}deg)`,
    transformOrigin: "center center",
    overflow: "hidden",
  };
}

function RenderElement({ element }: { element: VideoElement }) {
  const frame = useCurrentFrame();
  const style = buildElementStyle(element, frame);

  if (element.kind === "video") {
    return <Video src={element.src} style={{ ...style, objectFit: element.objectFit ?? "cover" }} />;
  }

  if (element.kind === "image") {
    return (
      <Img
        src={element.src}
        style={{
          ...style,
          objectFit: element.objectFit ?? "cover",
          borderRadius: element.borderRadius,
        }}
      />
    );
  }

  if (element.kind === "shape") {
    return (
      <div
        style={{
          ...style,
          backgroundColor: element.fill,
          borderRadius: element.shape === "circle" ? "50%" : (element.borderRadius ?? 0),
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent:
          element.textAlign === "center" ? "center" : element.textAlign === "right" ? "flex-end" : "flex-start",
        textAlign: element.textAlign ?? "left",
        color: element.color ?? "#ffffff",
        fontSize: element.fontSize ?? 44,
        fontWeight: element.fontWeight ?? 600,
        fontFamily: element.fontFamily,
        letterSpacing: element.letterSpacing,
        lineHeight: element.lineHeight ?? 1.2,
        backgroundColor: element.backgroundColor,
        borderRadius: element.borderRadius,
        padding: element.padding,
        whiteSpace: "pre-wrap",
      }}
    >
      {element.text}
    </div>
  );
}

export function VideoComposition({ schema }: VideoCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: schema.backgroundColor }}>
      {schema.scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={getFrameRange(scene.startFrame, scene.durationInFrames).durationInFrames}
        >
          <AbsoluteFill style={{ backgroundColor: scene.backgroundColor ?? schema.backgroundColor }}>
            {scene.elements.map((element) => {
              if (editableOverlayKinds.has(element.kind)) {
                return null;
              }

              const timelineRange = getElementEffectiveTimelineRange(
                scene.startFrame,
                scene.durationInFrames,
                element,
                schema.durationInFrames,
              );

              if (timelineRange.durationInFrames <= 0) {
                return null;
              }

              return (
                <Sequence
                  key={element.id}
                  from={timelineRange.startFrame - scene.startFrame}
                  durationInFrames={timelineRange.durationInFrames}
                >
                  <RenderElement element={element} />
                </Sequence>
              );
            })}
          </AbsoluteFill>
        </Sequence>
      ))}
      {schema.scenes.flatMap((scene) =>
        scene.elements.map((element, index) => {
          if (!editableOverlayKinds.has(element.kind)) {
            return null;
          }

          const timelineRange = getElementEffectiveTimelineRange(
            scene.startFrame,
            scene.durationInFrames,
            element,
            schema.durationInFrames,
            { constrainToScene: false },
          );

          if (timelineRange.durationInFrames <= 0) {
            return null;
          }

          return (
            <Sequence
              key={`${scene.id}:${index}`}
              from={timelineRange.startFrame}
              durationInFrames={timelineRange.durationInFrames}
            >
              <RenderElement element={element} />
            </Sequence>
          );
        }),
      )}
    </AbsoluteFill>
  );
}

