"use client";

import { ChangeEvent, PointerEvent, useState } from "react";
import styles from "./PlaybackToolbar.module.css";

type PlaybackToolbarProps = {
  isPlaying: boolean;
  zoom: number;
  onZoomChange: (value: number) => void;
  onZoomStep: (delta: number) => void;
  onTogglePlay: () => void;
  onRewind: () => void;
  onForward: () => void;
  onSplitFocusedTrack: () => void;
  onRender: () => void;
  isTimelineResizing: boolean;
  onTimelineResizeStart: (event: PointerEvent<HTMLButtonElement>) => void;
};

const speedOptions = ["0.5x", "1x", "1.5x", "2x"];

function IconChevron() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  );
}

function IconSkipStart() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 3V13" />
      <path d="M12 4L7 8L12 12V4Z" />
    </svg>
  );
}

function IconRewind() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M13 4L8 8L13 12V4Z" />
      <path d="M8 4L3 8L8 12V4Z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 3.5L12.5 8L5 12.5V3.5Z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5.5 3.5H7.5V12.5H5.5V3.5Z" />
      <path d="M8.5 3.5H10.5V12.5H8.5V3.5Z" />
    </svg>
  );
}

function IconForward() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 4L8 8L3 12V4Z" />
      <path d="M8 4L13 8L8 12V4Z" />
    </svg>
  );
}

function IconSkipEnd() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M12 3V13" />
      <path d="M4 4L9 8L4 12V4Z" />
    </svg>
  );
}

function IconReload() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M11.7 6.4A4.7 4.7 0 1 0 12 8" />
      <path d="M10.5 3.5H13.5V6.5" />
    </svg>
  );
}

function IconVolume() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 6H5.3L8.3 3.5V12.5L5.3 10H2.5V6Z" />
      <path d="M10.7 6A2.6 2.6 0 0 1 10.7 10" />
    </svg>
  );
}

function IconFocus() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 2.5H2.5V6" />
      <path d="M10 2.5H13.5V6" />
      <path d="M6 13.5H2.5V10" />
      <path d="M10 13.5H13.5V10" />
    </svg>
  );
}

function IconSplit() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2V14" />
      <path d="M4 4.5H7" />
      <path d="M9 11.5H12" />
    </svg>
  );
}

function IconRender() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M9.8 2.2L13.8 2.2L12.2 6.2L9.8 2.2Z" />
      <path d="M7 3.4C5.5 4.9 4.5 6.6 4.2 8.4L2.1 10.5C1.6 11 1.6 11.8 2.1 12.3C2.6 12.8 3.4 12.8 3.9 12.3L6 10.2C7.8 9.9 9.5 8.9 11 7.4L7 3.4Z" />
      <path d="M5.2 11.1L6.9 12.8" />
    </svg>
  );
}

export function PlaybackToolbar({
  isPlaying,
  zoom,
  onZoomChange,
  onZoomStep,
  onTogglePlay,
  onRewind,
  onForward,
  onSplitFocusedTrack,
  onRender,
  isTimelineResizing,
  onTimelineResizeStart,
}: PlaybackToolbarProps) {
  const [speed, setSpeed] = useState(speedOptions[1]);

  function adjustZoom(step: number) {
    onZoomStep(step);
  }

  function handleZoomChange(event: ChangeEvent<HTMLInputElement>) {
    onZoomChange(Number(event.target.value));
  }

  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        className={`${styles.resizeHandle} ${isTimelineResizing ? styles.resizeHandleActive : ""}`}
        onPointerDown={onTimelineResizeStart}
        aria-label="Resize timeline height"
      />
      <div className={styles.leftGroup}>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.zoomStepButton}`}
          onClick={() => adjustZoom(-10)}
          aria-label="Zoom out"
        >
          <span aria-hidden="true">-</span>
        </button>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={zoom}
          onChange={handleZoomChange}
          className={styles.zoomSlider}
          aria-label="Zoom timeline"
        />
        <button
          type="button"
          className={`${styles.iconButton} ${styles.zoomStepButton}`}
          onClick={() => adjustZoom(10)}
          aria-label="Zoom in"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      <div className={styles.centerGroup}>
        <label className={styles.selectWrap}>
          <select value={speed} onChange={(event) => setSpeed(event.target.value)} aria-label="Playback speed">
            {speedOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <IconChevron />
        </label>

        <div className={styles.iconGroups}>
          <div className={styles.transport}>
            <button type="button" className={styles.iconButton} onClick={onRewind} aria-label="Skip to start">
              <IconSkipStart />
            </button>
            <button type="button" className={styles.iconButton} onClick={onRewind} aria-label="Rewind 5 seconds">
              <IconRewind />
            </button>
            <button type="button" className={styles.iconButtonPrimary} onClick={onTogglePlay} aria-label="Play or pause">
              {isPlaying ? <IconPause /> : <IconPlay />}
            </button>
            <button type="button" className={styles.iconButton} onClick={onForward} aria-label="Forward 5 seconds">
              <IconForward />
            </button>
            <button type="button" className={styles.iconButton} onClick={onForward} aria-label="Skip to end">
              <IconSkipEnd />
            </button>
          </div>

          <div className={styles.utilityGroup}>
            <button type="button" className={styles.iconButtonBlue} aria-label="Reload preview">
              <IconReload />
            </button>
            <button type="button" className={styles.iconButton} aria-label="Mute">
              <IconVolume />
            </button>
          </div>

          <div className={styles.zoomGroup}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={onSplitFocusedTrack}
              aria-label="Split focused track"
              title="Split focused track"
            >
              <IconSplit />
            </button>
            <button type="button" className={styles.iconButton} aria-label="Fullscreen preview">
              <IconFocus />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.renderActions}>
        <button type="button" className={styles.discardLabel} aria-label="Discard changes">
          Discard
        </button>
        <button type="button" className={styles.renderButton} onClick={onRender}>
          <IconRender />
          <span>Save</span>
        </button>
      </div>
    </div>
  );
}
