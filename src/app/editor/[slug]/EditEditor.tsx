"use client";

import Link from "next/link";
import { CSSProperties, ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlaybackToolbar } from "./components/PlaybackToolbar/PlaybackToolbar";
import { TimelineInspector } from "./components/TimelineInspector/TimelineInspector";
import styles from "./page.module.css";

type EditEditorProps = {
  slug: string;
};

type AssetKind = "video" | "audio" | "other";

type AssetItem = {
  id: string;
  name: string;
  kind: AssetKind;
  src?: string;
  sizeLabel: string;
  revokeOnDispose?: boolean;
};

const timelineSegments = [
  { start: "0%", width: "24%" },
  { start: "24%", width: "26%" },
  { start: "50%", width: "25%" },
  { start: "75%", width: "25%" },
];
const transportSeekStep = 5;
const keyboardSeekStep = 1;
const initialAssets: AssetItem[] = [
  { id: "asset-1", name: "IMG_1507.MP4", kind: "video", src: "/videos/IMG_1507.MP4", sizeLabel: "Video" },
  { id: "asset-2", name: "music-track.wav", kind: "audio", sizeLabel: "Audio" },
  { id: "asset-3", name: "captions.srt", kind: "other", sizeLabel: "Subtitle" },
];

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "File";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00.00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(
    hundredths,
  ).padStart(2, "0")}`;
}

export function EditEditor({ slug }: EditEditorProps) {
  const defaultSidebarWidth = 400;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const tracksRef = useRef<HTMLDivElement | null>(null);
  const scrubZoneRef = useRef<HTMLButtonElement | null>(null);
  const assetUploadInputRef = useRef<HTMLInputElement | null>(null);
  const assetsRef = useRef<AssetItem[]>(initialAssets);
  const leftRailResizeStateRef = useRef({ startX: 0, startWidth: defaultSidebarWidth });
  const resizeStateRef = useRef({ startX: 0, startWidth: defaultSidebarWidth });
  const animationFrameRef = useRef<number | null>(null);
  const chatScrollbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isLeftRailResizing, setIsLeftRailResizing] = useState(false);
  const [leftRailWidth, setLeftRailWidth] = useState(defaultSidebarWidth);
  const [isInspectorResizing, setIsInspectorResizing] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(defaultSidebarWidth);
  const [isLeftRailCollapsed, setIsLeftRailCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState<"chat" | "assets">("chat");
  const [isChatScrollbarVisible, setIsChatScrollbarVisible] = useState(false);
  const [assets, setAssets] = useState<AssetItem[]>(initialAssets);

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const timelineMarks = useMemo(
    () => Array.from({ length: 6 }, (_, i) => formatTime((duration * i) / 5)),
    [duration],
  );
  const boundedInspectorWidth = Math.max(inspectorWidth, 250);

  const stopAnimationFrame = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const startAnimationFrame = useCallback(() => {
    stopAnimationFrame();

    const tick = () => {
      const videoElement = videoRef.current;

      if (!videoElement) {
        animationFrameRef.current = null;
        return;
      }

      setCurrentTime(videoElement.currentTime);

      if (!videoElement.paused && !videoElement.ended) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      animationFrameRef.current = null;
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
  }, [stopAnimationFrame]);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    function handleTimeUpdate() {
      setCurrentTime(videoElement.currentTime);
    }

    function handleLoadedMetadata() {
      setDuration(videoElement.duration);
      setCurrentTime(videoElement.currentTime || 0);
    }

    function handlePlay() {
      setIsPlaying(true);
      startAnimationFrame();
    }

    function handlePause() {
      setIsPlaying(false);
      stopAnimationFrame();
      setCurrentTime(videoElement.currentTime);
    }

    function handleEnded() {
      setIsPlaying(false);
      stopAnimationFrame();
      setCurrentTime(videoElement.duration || 0);
    }

    videoElement.addEventListener("timeupdate", handleTimeUpdate);
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);
    videoElement.addEventListener("ended", handleEnded);

    return () => {
      stopAnimationFrame();
      videoElement.removeEventListener("timeupdate", handleTimeUpdate);
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
      videoElement.removeEventListener("ended", handleEnded);
    };
  }, [startAnimationFrame, stopAnimationFrame]);

  const seekBy = useCallback((deltaSeconds: number) => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    const maxDuration = Number.isFinite(videoElement.duration) && videoElement.duration > 0 ? videoElement.duration : Infinity;
    const nextTime = Math.min(Math.max(videoElement.currentTime + deltaSeconds, 0), maxDuration);
    videoElement.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, []);

  const togglePlay = useCallback(async () => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    if (videoElement.paused || videoElement.ended) {
      await videoElement.play();
      return;
    }

    videoElement.pause();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        void togglePlay();
        return;
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekBy(-keyboardSeekStep);
        return;
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        seekBy(keyboardSeekStep);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [seekBy, togglePlay]);

  function rewind() {
    seekBy(-transportSeekStep);
  }

  function forward() {
    seekBy(transportSeekStep);
  }

  function handleSeek(nextTime: number) {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    videoElement.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const scrubZoneElement = scrubZoneRef.current;

      if (!scrubZoneElement || duration <= 0) {
        return;
      }

      const scrubZoneRect = scrubZoneElement.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - scrubZoneRect.left) / Math.max(scrubZoneRect.width, 1), 0), 1);

      handleSeek(ratio * duration);
    },
    [duration],
  );

  function beginScrub(clientX: number) {
    seekFromClientX(clientX);
    setIsScrubbing(true);
  }

  useEffect(() => {
    if (!isScrubbing) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      seekFromClientX(event.clientX);
    }

    function stopScrub() {
      setIsScrubbing(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopScrub);
    window.addEventListener("pointercancel", stopScrub);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopScrub);
      window.removeEventListener("pointercancel", stopScrub);
    };
  }, [isScrubbing, seekFromClientX]);

  useEffect(() => {
    if (!isLeftRailResizing) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const { startX, startWidth } = leftRailResizeStateRef.current;
      const nextWidth = startWidth + (event.clientX - startX);
      setLeftRailWidth(Math.max(250, nextWidth));
    }

    function stopResizing() {
      setIsLeftRailResizing(false);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isLeftRailResizing]);

  useEffect(() => {
    if (!isInspectorResizing) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const { startX, startWidth } = resizeStateRef.current;
      const nextWidth = startWidth + (event.clientX - startX);
      setInspectorWidth(Math.max(250, nextWidth));
    }

    function stopResizing() {
      setIsInspectorResizing(false);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isInspectorResizing]);

  function handleInspectorResizeStart(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: boundedInspectorWidth,
    };
    setIsInspectorResizing(true);
  }

  function handleLeftRailResizeStart(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    leftRailResizeStateRef.current = {
      startX: event.clientX,
      startWidth: leftRailWidth,
    };
    setIsLeftRailResizing(true);
  }

  const handleChatScroll = useCallback(() => {
    setIsChatScrollbarVisible(true);

    if (chatScrollbarTimerRef.current) {
      clearTimeout(chatScrollbarTimerRef.current);
    }

    chatScrollbarTimerRef.current = setTimeout(() => {
      setIsChatScrollbarVisible(false);
      chatScrollbarTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (chatScrollbarTimerRef.current) {
        clearTimeout(chatScrollbarTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    return () => {
      for (const asset of assetsRef.current) {
        if (asset.revokeOnDispose && asset.src) {
          URL.revokeObjectURL(asset.src);
        }
      }
    };
  }, []);

  const handleAssetUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    const nextAssets: AssetItem[] = Array.from(files).map((file, index) => {
      const src = URL.createObjectURL(file);
      const kind: AssetKind = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : "other";

      return {
        id: `${Date.now()}-${index}-${file.name}`,
        name: file.name,
        kind,
        src,
        revokeOnDispose: true,
        sizeLabel: formatFileSize(file.size),
      };
    });

    setAssets((prev) => [...nextAssets, ...prev]);
    event.target.value = "";
  }, []);

  return (
    <div className={styles.editorShell}>
      <header className={styles.topBar}>
        <nav className={styles.menuBar} aria-label="Editor menu">
          <Link
            href={{ pathname: "/", query: { project: slug } }}
            className={styles.backToProjectButton}
            aria-label="Back to project"
            title="Back to project"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10.5 3.2L5.5 8l5 4.8V3.2z" />
            </svg>
          </Link>
          <button type="button">File</button>
          <button type="button">View</button>
          <button type="button">Tools</button>
          <button type="button">Packages</button>
          <button type="button">Help</button>
        </nav>
        <div className={styles.projectTitle}>{slug}</div>
        <div className={styles.topBarActions}>
          <button
            type="button"
            className={styles.topBarIconButton}
            onClick={() => setIsLeftRailCollapsed((prev) => !prev)}
            aria-label={isLeftRailCollapsed ? "Expand left sidebar" : "Collapse left sidebar"}
            title={isLeftRailCollapsed ? "Expand left sidebar" : "Collapse left sidebar"}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2" y="3" width="12" height="10" rx="1.3" />
              <path d="M6 3v10" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.topBarIconButton}
            onClick={() => setIsInspectorCollapsed((prev) => !prev)}
            aria-label={isInspectorCollapsed ? "Expand timeline inspector" : "Collapse timeline inspector"}
            title={isInspectorCollapsed ? "Expand timeline inspector" : "Collapse timeline inspector"}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2" y="3" width="12" height="10" rx="1.3" />
              <path d="M10 3v10" />
            </svg>
          </button>
        </div>
      </header>

      <div
        className={styles.workspace}
        style={
          {
            "--left-rail-width": isLeftRailCollapsed ? "0px" : `${leftRailWidth}px`,
            "--left-rail-min": isLeftRailCollapsed ? "0px" : "250px",
          } as CSSProperties
        }
      >
        <aside className={`${styles.leftRail} ${isLeftRailCollapsed ? styles.leftRailCollapsed : ""}`}>
          <button
            type="button"
            className={`${styles.leftRailResizeHandle} ${isLeftRailResizing ? styles.leftRailResizeHandleActive : ""}`}
            onPointerDown={handleLeftRailResizeStart}
            aria-label="Resize composition sidebar"
          />
          <div className={styles.panelTabs}>
            <button
              type="button"
              className={activeLeftTab === "chat" ? styles.tabActive : styles.tab}
              onClick={() => setActiveLeftTab("chat")}
            >
              <span className={styles.tabWithIcon}>
                Edit with AI
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    className={styles.magicIconPrimary}
                    d="M10 3L12.4 8.1L17.5 10.5L12.4 12.9L10 18L7.6 12.9L2.5 10.5L7.6 8.1L10 3Z"
                  />
                  <path
                    className={styles.magicIconSecondary}
                    d="M17.6 13.4L18.8 15.9L21.3 17.1L18.8 18.3L17.6 20.8L16.4 18.3L13.9 17.1L16.4 15.9L17.6 13.4Z"
                  />
                </svg>
              </span>
            </button>
            <button
              type="button"
              className={activeLeftTab === "assets" ? styles.tabActive : styles.tab}
              onClick={() => setActiveLeftTab("assets")}
            >
              <span className={styles.tabWithIcon}>
                Assets
                <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.assetsTabIcon}>
                  <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-11Z" />
                  <path d="M7.2 12.2L9.2 10.2L10.8 11.8L13.3 9.3L15.3 11.3V15H4.7v-1.5l2.5-1.3Z" />
                </svg>
              </span>
            </button>
          </div>
          {activeLeftTab === "chat" ? (
            <div className={styles.chatPanel}>
              <header className={styles.chatHeader}>
                <div className={styles.chatIdentity}>
                  <span className={styles.chatAvatar} aria-hidden="true" />
                  <span className={styles.chatName}>Compis</span>
                </div>
                <button type="button" className={styles.chatMenuButton} aria-label="More options">
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="4" cy="8" r="1.1" />
                    <circle cx="8" cy="8" r="1.1" />
                    <circle cx="12" cy="8" r="1.1" />
                  </svg>
                </button>
              </header>

              <div
                className={`${styles.chatBody} ${isChatScrollbarVisible ? styles.chatBodyScrollbarVisible : ""}`}
                onScroll={handleChatScroll}
              >
                <p>I&apos;ll build a sophisticated AI video editing platform. Here&apos;s my plan:</p>
                <p className={styles.chatSectionTitle}>Key Features:</p>
                <ol>
                  <li>
                    <strong>Dashboard</strong> - Overview of projects with stats
                  </li>
                  <li>
                    <strong>Video Upload &amp; Project Creation</strong> - Upload videos and create editing projects
                  </li>
                  <li>
                    <strong>AI-Powered Editing Tools</strong> - Text-to-edit commands, auto-captions, style transfer
                  </li>
                  <li>
                    <strong>Project Timeline/Editor</strong> - Visual editor with AI suggestions
                  </li>
                  <li>
                    <strong>Export &amp; Download</strong> - Final video export options
                  </li>
                </ol>
                <p>Let me build this now.</p>
                <div className={styles.chatTime}>a few seconds ago</div>
              </div>

              <footer className={styles.chatComposer}>
                <div className={styles.chatComposerInput}>
                  <textarea placeholder="What would you like to change?" rows={3} />
                  <div className={styles.chatComposerRow}>
                    <div className={styles.chatComposerActions}>
                      <button type="button" aria-label="Settings">
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M9.4 1.7L10 3.1L11.6 3.5L12.2 5L11.1 6.2L11.2 7.8L12.2 9L11.6 10.5L10 10.9L9.4 12.3L7.8 12.2L6.6 13.2L5.1 12.6L4.7 11L3.3 10.4L3.4 8.8L2.4 7.6L3 6.1L4.6 5.7L5.2 4.3L6.8 4.4L8 3.4L9.4 4L9.8 5.6L11.2 6.2" />
                          <circle cx="8" cy="8" r="2.2" />
                        </svg>
                      </button>
                      <button type="button" aria-label="Add">+</button>
                      <button type="button" className={styles.chatModeButton}>
                        Discuss
                      </button>
                    </div>
                    <button type="button" className={styles.chatMicButton} aria-label="Voice input">
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <rect x="6" y="2.5" width="4" height="7" rx="2" />
                        <path d="M4.2 7.8C4.2 10 5.9 11.7 8 11.7C10.1 11.7 11.8 10 11.8 7.8" />
                        <path d="M8 11.8V14" />
                      </svg>
                    </button>
                  </div>
                </div>
              </footer>
            </div>
          ) : (
            <div className={styles.assetsPanel}>
              <input
                ref={assetUploadInputRef}
                type="file"
                accept="video/*,audio/*"
                multiple
                className={styles.assetsFileInput}
                onChange={handleAssetUpload}
              />
              <button
                type="button"
                className={styles.assetsUploadButton}
                onClick={() => assetUploadInputRef.current?.click()}
              >
                Upload New Asset
              </button>
              <div className={styles.assetList}>
                {assets.map((asset) => (
                  <article key={asset.id} className={styles.assetCard}>
                    {asset.kind === "video" && asset.src ? (
                      <video className={styles.assetPreview} src={asset.src} controls preload="metadata" />
                    ) : null}
                    {asset.kind === "audio" && asset.src ? (
                      <audio className={styles.assetAudio} src={asset.src} controls preload="metadata" />
                    ) : null}
                    {asset.kind === "audio" && !asset.src ? (
                      <div className={styles.assetAudioPlaceholder}>
                        <span>Audio Preview</span>
                      </div>
                    ) : null}
                    {asset.kind === "other" ? (
                      <div className={styles.assetFilePlaceholder}>
                        <span>File</span>
                      </div>
                    ) : null}
                    <div className={styles.assetMeta}>
                      <p className={styles.assetName}>{asset.name}</p>
                      <p className={styles.assetType}>{asset.sizeLabel}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className={styles.previewArea}>
          <div className={styles.previewStage}>
            <div className={styles.previewCanvas}>
              <video
                ref={videoRef}
                src="/videos/IMG_1507.MP4"
                className={styles.previewVideo}
                preload="metadata"
                playsInline
                onClick={togglePlay}
              />
            </div>
          </div>
        </section>
      </div>

      <PlaybackToolbar
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onRewind={rewind}
        onForward={forward}
        onRender={togglePlay}
      />

      <section className={styles.timeline}>
        <div
          className={styles.timelineBody}
          style={
            {
              "--inspector-width": isInspectorCollapsed ? "0px" : `${boundedInspectorWidth}px`,
              "--inspector-min": isInspectorCollapsed ? "0px" : "250px",
            } as CSSProperties
          }
        >
          {!isInspectorCollapsed ? (
            <TimelineInspector
              currentTimeLabel={formatTime(currentTime)}
              isResizing={isInspectorResizing}
              onResizeStart={handleInspectorResizeStart}
            />
          ) : null}
          <div className={styles.timelineMain}>
            <div className={styles.timelineHeader}>
              {timelineMarks.map((mark, index) => (
                <span key={`${mark}-${index}`}>{mark}</span>
              ))}
            </div>
            <div className={styles.tracks} ref={tracksRef}>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.001}
                value={duration ? currentTime : 0}
                onChange={(event) => handleSeek(Number(event.target.value))}
                className={styles.timelineScrubber}
                aria-label="Timeline scrubber"
              />
              <button
                type="button"
                className={styles.timelineScrubZone}
                ref={scrubZoneRef}
                onPointerDown={(event) => beginScrub(event.clientX)}
                aria-label="Seek timeline"
              />
              {[0, 1, 2, 3].map((track) => (
                <div className={styles.trackRow} key={track}>
                  <div className={styles.trackLabel}>{"<Series.Sequence>"}</div>
                  <div className={styles.trackLane}>
                    <div
                      className={styles.clip}
                      style={{
                        left: timelineSegments[track].start,
                        width: timelineSegments[track].width,
                      }}
                    />
                  </div>
                </div>
              ))}
              <div className={styles.playheadLayer}>
                <button
                  type="button"
                  className={styles.playhead}
                  onPointerDown={(event) => beginScrub(event.clientX)}
                  aria-label="Drag playhead"
                  style={
                    {
                      "--playhead-progress": `${progress * 100}%`,
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
