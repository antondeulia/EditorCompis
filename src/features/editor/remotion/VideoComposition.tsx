"use client";

import { CSSProperties } from "react";
import { AbsoluteFill, Audio, Easing, Img, Sequence, Video, interpolate, useCurrentFrame } from "remotion";
import {
  AudioTrack,
  ElementAnimation,
  SceneEffect,
  TimelineTransition,
  VideoElement,
  VideoScene,
  VideoSchema,
} from "../model/schema";
import { getElementEffectiveTimelineRange, getFrameRange } from "../lib/utils";
import { editableOverlayKinds } from "../model/constants";

type VideoCompositionProps = {
  schema: VideoSchema;
};

type CameraState = {
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
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

function resolveTransformOrigin(origin?: VideoElement["transformOrigin"]) {
  switch (origin) {
    case "top-left":
      return "left top";
    case "top-right":
      return "right top";
    case "bottom-left":
      return "left bottom";
    case "bottom-right":
      return "right bottom";
    default:
      return "center center";
  }
}

function buildEffectsFilter(effects?: SceneEffect[]) {
  if (!effects || effects.length === 0) {
    return "";
  }

  return effects
    .map((effect) => {
      switch (effect.type) {
        case "blur":
          return `blur(${Math.max(0, effect.amount)}px)`;
        case "brightness":
          return `brightness(${effect.value})`;
        case "contrast":
          return `contrast(${effect.value})`;
        case "saturation":
          return `saturate(${effect.value})`;
        case "hue-rotate":
          return `hue-rotate(${effect.degrees}deg)`;
        case "vignette":
          return `drop-shadow(0 0 ${Math.max(0, effect.amount) * 12}px rgba(0, 0, 0, 0.45))`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join(" ");
}

function mergeFilters(...filters: Array<string | undefined>) {
  return filters.filter((item) => item && item.trim().length > 0).join(" ");
}

function getTransitionProgress(frame: number, durationInFrames: number, edge: "in" | "out") {
  const safeDuration = Math.max(1, durationInFrames);

  if (edge === "in") {
    return clamp01(frame / safeDuration);
  }

  return clamp01((safeDuration - frame) / safeDuration);
}

function applyTransition(
  transition: TimelineTransition | undefined,
  frame: number,
  totalDurationInFrames: number,
  edge: "in" | "out",
) {
  if (!transition) {
    return {
      opacity: 1,
      scale: 1,
      translateX: 0,
      blur: 0,
      clipLeft: 0,
      clipRight: 0,
    };
  }

  const transitionDuration = Math.max(1, transition.durationInFrames);
  const active = edge === "in" ? frame <= transitionDuration : frame >= totalDurationInFrames - transitionDuration;
  if (!active) {
    return {
      opacity: 1,
      scale: 1,
      translateX: 0,
      blur: 0,
      clipLeft: 0,
      clipRight: 0,
    };
  }

  const localFrame =
    edge === "in"
      ? frame
      : transitionDuration - (totalDurationInFrames - frame);
  const baseProgress = getTransitionProgress(localFrame, transitionDuration, "in");
  const eased = resolveEasing(transition.easing)(baseProgress);

  switch (transition.type) {
    case "cut":
      return {
        opacity: eased >= 1 ? 1 : 0,
        scale: 1,
        translateX: 0,
        blur: 0,
        clipLeft: 0,
        clipRight: 0,
      };
    case "fade":
    case "dissolve":
      return {
        opacity: eased,
        scale: 1,
        translateX: 0,
        blur: 0,
        clipLeft: 0,
        clipRight: 0,
      };
    case "slide-left":
      return {
        opacity: 1,
        scale: 1,
        translateX: interpolate(eased, [0, 1], [80, 0]),
        blur: 0,
        clipLeft: 0,
        clipRight: 0,
      };
    case "slide-right":
      return {
        opacity: 1,
        scale: 1,
        translateX: interpolate(eased, [0, 1], [-80, 0]),
        blur: 0,
        clipLeft: 0,
        clipRight: 0,
      };
    case "zoom-in":
      return {
        opacity: eased,
        scale: interpolate(eased, [0, 1], [0.85, 1]),
        translateX: 0,
        blur: 0,
        clipLeft: 0,
        clipRight: 0,
      };
    case "zoom-out":
      return {
        opacity: eased,
        scale: interpolate(eased, [0, 1], [1.15, 1]),
        translateX: 0,
        blur: 0,
        clipLeft: 0,
        clipRight: 0,
      };
    case "blur":
      return {
        opacity: eased,
        scale: 1,
        translateX: 0,
        blur: interpolate(eased, [0, 1], [8, 0]),
        clipLeft: 0,
        clipRight: 0,
      };
    case "wipe-left":
      return {
        opacity: 1,
        scale: 1,
        translateX: 0,
        blur: 0,
        clipLeft: 100 - eased * 100,
        clipRight: 0,
      };
    case "wipe-right":
      return {
        opacity: 1,
        scale: 1,
        translateX: 0,
        blur: 0,
        clipLeft: 0,
        clipRight: 100 - eased * 100,
      };
    default:
      return {
        opacity: 1,
        scale: 1,
        translateX: 0,
        blur: 0,
        clipLeft: 0,
        clipRight: 0,
      };
  }
}

function interpolateCamera(scene: VideoScene, frame: number): CameraState {
  const keyframes = [...(scene.cameraKeyframes ?? [])].sort((a, b) => a.frame - b.frame);
  if (keyframes.length === 0) {
    return { zoom: 1, panX: 0, panY: 0, rotation: 0 };
  }

  const first = keyframes[0];
  if (frame <= first.frame) {
    return {
      zoom: first.zoom ?? 1,
      panX: first.panX ?? 0,
      panY: first.panY ?? 0,
      rotation: first.rotation ?? 0,
    };
  }

  const last = keyframes[keyframes.length - 1];
  if (frame >= last.frame) {
    return {
      zoom: last.zoom ?? 1,
      panX: last.panX ?? 0,
      panY: last.panY ?? 0,
      rotation: last.rotation ?? 0,
    };
  }

  for (let index = 1; index < keyframes.length; index += 1) {
    const next = keyframes[index];
    if (frame > next.frame) {
      continue;
    }

    const prev = keyframes[index - 1];
    const span = Math.max(1, next.frame - prev.frame);
    const rawProgress = clamp01((frame - prev.frame) / span);
    const eased = resolveEasing(next.easing)(rawProgress);
    return {
      zoom: interpolate(eased, [0, 1], [prev.zoom ?? 1, next.zoom ?? 1]),
      panX: interpolate(eased, [0, 1], [prev.panX ?? 0, next.panX ?? 0]),
      panY: interpolate(eased, [0, 1], [prev.panY ?? 0, next.panY ?? 0]),
      rotation: interpolate(eased, [0, 1], [prev.rotation ?? 0, next.rotation ?? 0]),
    };
  }

  return { zoom: 1, panX: 0, panY: 0, rotation: 0 };
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

    if (animation.type === "move" || animation.type === "pan") {
      x = interpolate(eased, [0, 1], [animation.from.x, animation.to.x]);
      y = interpolate(eased, [0, 1], [animation.from.y, animation.to.y]);
    }

    if (animation.type === "scale" || animation.type === "zoom-in" || animation.type === "zoom-out") {
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
  const transitionIn = applyTransition(element.transitionIn, frame, element.durationInFrames, "in");
  const transitionOut = applyTransition(element.transitionOut, frame, element.durationInFrames, "out");
  const combinedOpacity = motion.opacity * Math.min(transitionIn.opacity, transitionOut.opacity);
  const combinedScale = motion.scale * transitionIn.scale * transitionOut.scale;
  const combinedTranslateX = transitionIn.translateX + transitionOut.translateX;
  const combinedBlur = Math.max(transitionIn.blur, transitionOut.blur);
  const clipLeft = Math.max(transitionIn.clipLeft, transitionOut.clipLeft);
  const clipRight = Math.max(transitionIn.clipRight, transitionOut.clipRight);

  return {
    position: "absolute",
    left: motion.x,
    top: motion.y,
    width: element.width,
    height: element.height,
    zIndex: element.zIndex,
    opacity: combinedOpacity,
    transform: `translateX(${combinedTranslateX}px) scale(${combinedScale}) rotate(${motion.rotation}deg)`,
    transformOrigin: resolveTransformOrigin(element.transformOrigin),
    overflow: "hidden",
    mixBlendMode: element.blendMode,
    clipPath:
      clipLeft > 0 || clipRight > 0
        ? `inset(0 ${clipRight.toFixed(2)}% 0 ${clipLeft.toFixed(2)}%)`
        : undefined,
    filter: mergeFilters(
      combinedBlur > 0 ? `blur(${combinedBlur.toFixed(2)}px)` : "",
      buildEffectsFilter(element.effects),
    ),
  };
}

function RenderElement({ element, inheritedEffects }: { element: VideoElement; inheritedEffects?: SceneEffect[] }) {
  const frame = useCurrentFrame();
  const style = buildElementStyle(element, frame);
  const filter = mergeFilters(style.filter as string | undefined, buildEffectsFilter(inheritedEffects));

  if (element.kind === "video") {
    return (
      <Video
        src={element.src}
        style={{ ...style, objectFit: element.objectFit ?? "cover", filter }}
        playbackRate={element.playbackRate ?? 1}
        muted={element.muted ?? false}
      />
    );
  }

  if (element.kind === "image") {
    return (
      <Img
        src={element.src}
        style={{
          ...style,
          objectFit: element.objectFit ?? "cover",
          borderRadius: element.borderRadius,
          filter,
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
          filter,
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
        filter,
      }}
    >
      {element.text}
    </div>
  );
}

function RenderAudioTrack({ track }: { track: AudioTrack }) {
  const frame = useCurrentFrame();
  const baseVolume = track.volume ?? 1;
  const fadeInFrames = Math.max(0, track.fadeInFrames ?? 0);
  const fadeOutFrames = Math.max(0, track.fadeOutFrames ?? 0);
  const fadeIn = fadeInFrames > 0 ? clamp01(frame / fadeInFrames) : 1;
  const fadeOutStart = Math.max(0, track.durationInFrames - fadeOutFrames);
  const fadeOut = fadeOutFrames > 0 ? clamp01((track.durationInFrames - frame) / Math.max(1, track.durationInFrames - fadeOutStart)) : 1;

  return <Audio src={track.src} volume={baseVolume * fadeIn * fadeOut} />;
}

function RenderScene({ scene, schema }: { scene: VideoScene; schema: VideoSchema }) {
  const frame = useCurrentFrame();
  const sceneTrimStart = Math.max(0, scene.timelineTrimStartFrames ?? 0);
  const sceneTransitionIn = scene.transitionIn ?? schema.globalTransitions?.sceneDefaultIn;
  const sceneTransitionOut = scene.transitionOut ?? schema.globalTransitions?.sceneDefaultOut;
  const transitionIn = applyTransition(sceneTransitionIn, frame, scene.durationInFrames, "in");
  const transitionOut = applyTransition(sceneTransitionOut, frame, scene.durationInFrames, "out");
  const camera = interpolateCamera(scene, frame);
  const sceneFilter = mergeFilters(
    buildEffectsFilter(scene.effects),
    transitionIn.blur > 0 || transitionOut.blur > 0 ? `blur(${Math.max(transitionIn.blur, transitionOut.blur).toFixed(2)}px)` : "",
  );

  return (
    <Sequence
      key={scene.id}
      from={scene.startFrame}
      durationInFrames={getFrameRange(scene.startFrame, scene.durationInFrames).durationInFrames}
    >
      <Sequence from={-sceneTrimStart}>
        <AbsoluteFill
          style={{
            backgroundColor: scene.backgroundColor ?? schema.backgroundColor,
            opacity: Math.min(transitionIn.opacity, transitionOut.opacity),
            transform: `translateX(${transitionIn.translateX + transitionOut.translateX}px) scale(${transitionIn.scale * transitionOut.scale})`,
          }}
        >
          <AbsoluteFill
            style={{
              transform: `translate(${camera.panX}px, ${camera.panY}px) scale(${camera.zoom}) rotate(${camera.rotation}deg)`,
              transformOrigin: "center center",
              filter: sceneFilter || undefined,
            }}
          >
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
                  <RenderElement element={element} inheritedEffects={scene.effects} />
                </Sequence>
              );
            })}
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>
    </Sequence>
  );
}

export function VideoComposition({ schema }: VideoCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: schema.backgroundColor }}>
      {schema.scenes.map((scene) => (
        <RenderScene key={scene.id} scene={scene} schema={schema} />
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
              <Sequence from={-Math.max(0, element.timelineTrimStartFrames ?? 0)}>
                <RenderElement element={element} inheritedEffects={scene.effects} />
              </Sequence>
            </Sequence>
          );
        }),
      )}

      {(schema.audioTracks ?? []).map((track) => {
        const startFrame = Math.max(0, track.startFrame);
        const durationInFrames = Math.max(1, track.durationInFrames);

        return (
          <Sequence key={`master-audio-${track.id}`} from={startFrame} durationInFrames={durationInFrames}>
            <RenderAudioTrack track={track} />
          </Sequence>
        );
      })}

      {schema.scenes.flatMap((scene) =>
        (scene.audioTracks ?? []).map((track) => {
          const startFrame = Math.max(0, scene.startFrame + track.startFrame);
          const maxDuration = Math.max(0, scene.durationInFrames - track.startFrame);
          const durationInFrames = Math.max(0, Math.min(track.durationInFrames, maxDuration));
          if (durationInFrames <= 0) {
            return null;
          }

          return (
            <Sequence
              key={`scene-audio-${scene.id}-${track.id}`}
              from={startFrame}
              durationInFrames={durationInFrames}
            >
              <RenderAudioTrack track={{ ...track, durationInFrames }} />
            </Sequence>
          );
        }),
      )}
    </AbsoluteFill>
  );
}
