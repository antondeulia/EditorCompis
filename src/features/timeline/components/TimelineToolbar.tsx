import styles from "./TimelinePanel.module.css";

interface TimelineToolbarProps {
  durationFrames: number;
  frameRate: number;
  currentTimeMs: number;
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

export const TimelineToolbar = ({
  durationFrames,
  frameRate,
  currentTimeMs,
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
          16:9 v
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




