import { PointerEvent as ReactPointerEvent } from "react";

import { TIMELINE_LAYOUT } from "../constants/timelineLayout";
import styles from "./TimelinePanel.module.css";

interface TimelineRulerProps {
  durationFrames: number;
  frameRate: number;
  framePixelRatio: number;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

interface TimelineTick {
  second: number;
  isMajor: boolean;
}

const buildTicks = (totalSeconds: number): TimelineTick[] => {
  const ticks: TimelineTick[] = [];

  for (let second = 0; second <= totalSeconds; second += TIMELINE_LAYOUT.minorTickStepSeconds) {
    ticks.push({
      second,
      isMajor: second % TIMELINE_LAYOUT.majorTickStepSeconds === 0,
    });
  }

  return ticks;
};

export const TimelineRuler = ({
  durationFrames,
  frameRate,
  framePixelRatio,
  onPointerDown,
}: TimelineRulerProps) => {
  const totalSeconds = Math.ceil(durationFrames / frameRate);
  const ticks = buildTicks(totalSeconds);

  return (
    <div className={styles.timelineRuler} onPointerDown={onPointerDown}>
      {ticks.map((tick) => {
        const leftOffsetPx = tick.second * frameRate * framePixelRatio;

        return (
          <div
            key={tick.second}
            className={tick.isMajor ? styles.tickMarkMajor : styles.tickMarkMinor}
            style={{ left: `${leftOffsetPx}px` }}
          >
            {tick.isMajor ? (
              <span className={styles.tickLabel}>{`${tick.second}s`}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
