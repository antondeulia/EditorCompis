type TimelineRulerMark = {
  frame: number;
  timeSeconds: number;
  label: string;
};

function formatTimelineRulerLabel(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function buildTimelineRulerMarks(
  fps: number,
  timelineDurationSeconds: number,
  timelineFrameSpan: number,
) {
  if (timelineDurationSeconds <= 0) {
    return [{ frame: 0, timeSeconds: 0, label: formatTimelineRulerLabel(0) }];
  }

  const majorStepSeconds = 5;
  const marks: TimelineRulerMark[] = [];

  for (let second = 0; second <= timelineDurationSeconds + 0.0001; second += majorStepSeconds) {
    const frame = Math.min(Math.round(second * fps), Math.max(timelineFrameSpan - 1, 0));
    marks.push({
      frame,
      timeSeconds: second,
      label: formatTimelineRulerLabel(second),
    });
  }

  if (marks.length === 0 || marks[marks.length - 1].frame !== Math.max(timelineFrameSpan - 1, 0)) {
    marks.push({
      frame: Math.max(timelineFrameSpan - 1, 0),
      timeSeconds: timelineDurationSeconds,
      label: formatTimelineRulerLabel(timelineDurationSeconds),
    });
  }

  return marks;
}

export type { TimelineRulerMark };
