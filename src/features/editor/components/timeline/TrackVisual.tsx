"use client";

import { TrackVisualKind } from "../../model/types";
import styles from "../../styles/editor.module.css";

type TrackVisualProps = {
  kind: TrackVisualKind;
  title: string;
  src?: string;
  waveformSeed?: string;
  durationInFrames?: number;
  trimStartFrames?: number;
  fps?: number;
};

function getWaveformSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildWaveformBars(seedInput: string, barsCount: number) {
  const seed = getWaveformSeed(seedInput);
  return Array.from({ length: barsCount }, (_, index) => {
    const noise = Math.abs(Math.sin(seed * 0.013 + index * 0.77));
    return 20 + Math.round(noise * 72);
  });
}

const waveformBarsCache = new Map<string, number[]>();

function getWaveformBars(seedInput: string, barsCount: number) {
  const cacheKey = `${seedInput}:${barsCount}`;
  const cached = waveformBarsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const nextBars = buildWaveformBars(seedInput, barsCount);
  waveformBarsCache.set(cacheKey, nextBars);
  return nextBars;
}

export function TrackVisual({ kind, title, src, waveformSeed, durationInFrames, trimStartFrames, fps }: TrackVisualProps) {
  if (kind === "video" || kind === "image") {
    const frameCount = 6;
    const trimStartSeconds = trimStartFrames && fps ? trimStartFrames / fps : 0;

    return (
      <div className={styles.clipFrames}>
        {Array.from({ length: frameCount }, (_, index) => (
          <span key={index} className={styles.clipFrame}>
            {src ? (
              kind === "video" ? (
                <video
                  className={styles.clipFrameVideo}
                  src={
                    durationInFrames && fps
                      ? `${src}#t=${(trimStartSeconds + ((index + 0.5) / frameCount) * (durationInFrames / fps)).toFixed(2)}`
                      : src
                  }
                  muted
                  preload="none"
                  playsInline
                />
              ) : (
                <span className={styles.clipFrameImage} style={{ backgroundImage: `url("${src}")` }} />
              )
            ) : (
              <span className={styles.clipFrameFallback} />
            )}
          </span>
        ))}
      </div>
    );
  }

  if (kind === "audio") {
    const bars = getWaveformBars(waveformSeed ?? title, 42);
    return (
      <div className={styles.audioWave}>
        {bars.map((height, index) => (
          <span key={index} className={styles.audioWaveBar} style={{ height: `${height}%` }} />
        ))}
      </div>
    );
  }

  return <div className={styles.textTrackFill} aria-hidden="true" />;
}


