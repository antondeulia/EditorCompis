import styles from "./TimelinePanel.module.css";

interface TimelineToolbarProps {
  durationFrames: number;
  frameRate: number;
  currentTimeMs: number;
  aspectRatio?: number;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onResizePointerDown: (event: React.PointerEvent<HTMLElement>) => void;
}

const formatToolbarTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatAspectRatio = (aspectRatio?: number) => {
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return "16:9";
  }

  const presets = [
    { label: "16:9", value: 16 / 9 },
    { label: "9:16", value: 9 / 16 },
    { label: "1:1", value: 1 },
    { label: "4:5", value: 4 / 5 },
    { label: "21:9", value: 21 / 9 },
  ];

  const matchedPreset = presets.find((preset) => Math.abs(preset.value - aspectRatio) <= 0.02);
  if (matchedPreset) {
    return matchedPreset.label;
  }

  const width = Math.max(1, Math.round(aspectRatio * 100));
  const height = 100;
  return `${width}:${height}`;
};
export const TimelineToolbar = ({
  durationFrames,
  frameRate,
  currentTimeMs,
  aspectRatio,
  isPlaying,
  onTogglePlayback,
  onResizePointerDown,
}: TimelineToolbarProps) => {
  const totalMilliseconds = (durationFrames / frameRate) * 1000;

  return (
    <header
      className={styles.timelineToolbar}
      aria-label="Timeline controls"
      onPointerDown={onResizePointerDown}
    >
      <div className={styles.toolbarGroup}>
        <button type="button" className={styles.toolbarButton} aria-label="Cut tool">
          CUT
        </button>
      </div>

      <div className={styles.toolbarGroup}>
        <button type="button" className={styles.toolbarChip} aria-label="Playback speed">
          1x
        </button>
        <button
          type="button"
          className={styles.toolbarButton}
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={onTogglePlayback}
        >
          {isPlaying ? "PAUSE" : "PLAY"}
        </button>
        <span className={styles.toolbarTimecode}>
          {formatToolbarTime(currentTimeMs)} / {formatToolbarTime(totalMilliseconds)}
        </span>
      </div>

      <div className={styles.toolbarGroup}>
        <button type="button" className={styles.toolbarChip} aria-label="Aspect ratio">
          {formatAspectRatio(aspectRatio)} v
        </button>
        <button type="button" className={styles.toolbarButton} aria-label="Search">
          FIND
        </button>
        <div className={styles.zoomControl}>
          <button type="button" className={styles.toolbarButton} aria-label="Zoom out">
            -
          </button>
          <input
            className={styles.zoomSlider}
            type="range"
            min={0}
            max={100}
            value={35}
            readOnly
            aria-label="Timeline zoom"
          />
          <button type="button" className={styles.toolbarButton} aria-label="Zoom in">
            +
          </button>
        </div>
        <button type="button" className={styles.toolbarButton} aria-label="Fullscreen">
          FULL
        </button>
      </div>
    </header>
  );
};









