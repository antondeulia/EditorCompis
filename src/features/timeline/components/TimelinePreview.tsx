import { useEffect, useMemo, useRef } from "react";

import { TimelineTrack } from "@/features/timeline/types/timeline";

import styles from "./TimelinePanel.module.css";

interface TimelinePreviewProps {
  tracks: TimelineTrack[];
  currentFrame: number;
  frameRate: number;
  isPlaying: boolean;
}

const findActiveVideoClip = (tracks: TimelineTrack[], frame: number) => {
  const videoTracks = tracks.filter((track) => track.type === "video");

  for (const track of videoTracks) {
    const activeClip = track.clips.find(
      (clip) => frame >= clip.startFrame && frame < clip.startFrame + clip.durationFrames,
    );

    if (activeClip) {
      return { clip: activeClip, track };
    }
  }

  return null;
};

export const TimelinePreview = ({ tracks, currentFrame, frameRate, isPlaying }: TimelinePreviewProps) => {
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const backdropVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeVideo = useMemo(() => findActiveVideoClip(tracks, currentFrame), [tracks, currentFrame]);
  const hasActiveVideo = Boolean(activeVideo?.clip.mediaUrl);

  const relativeSeconds = useMemo(() => {
    if (!activeVideo) {
      return 0;
    }

    return Math.max((currentFrame - activeVideo.clip.startFrame) / frameRate, 0);
  }, [activeVideo, currentFrame, frameRate]);

  useEffect(() => {
    const videoElements = [mainVideoRef.current, backdropVideoRef.current].filter(
      (video): video is HTMLVideoElement => video !== null,
    );

    if (videoElements.length === 0 || !activeVideo?.clip.mediaUrl) {
      return;
    }

    for (const video of videoElements) {
      if (isPlaying) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            // Ignore autoplay restrictions in preview.
          });
        }
      } else {
        video.pause();
      }
    }
  }, [activeVideo?.clip.id, activeVideo?.clip.mediaUrl, isPlaying]);

  useEffect(() => {
    const videoElements = [mainVideoRef.current, backdropVideoRef.current].filter(
      (video): video is HTMLVideoElement => video !== null,
    );

    if (videoElements.length === 0 || !activeVideo?.clip.mediaUrl || !Number.isFinite(relativeSeconds)) {
      return;
    }

    const driftThreshold = isPlaying ? 0.25 : 0.05;

    for (const video of videoElements) {
      if (Math.abs(video.currentTime - relativeSeconds) > driftThreshold) {
        try {
          video.currentTime = relativeSeconds;
        } catch {
          // Ignore seeking errors while metadata is loading.
        }
      }
    }
  }, [activeVideo?.clip.id, activeVideo?.clip.mediaUrl, isPlaying, relativeSeconds]);

  return (
    <section
      className={`${styles.previewPanel} ${hasActiveVideo ? "" : styles.previewPanelEmpty}`}
      aria-label="Program preview"
    >
      <div className={styles.previewViewport}>
        {activeVideo?.clip.mediaUrl ? (
          <>
            <video
              key={`${activeVideo.clip.id}-backdrop`}
              ref={backdropVideoRef}
              src={activeVideo.clip.mediaUrl}
              className={styles.previewBackdropVideo}
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
            />
            <div className={styles.previewVideoFrame}>
              <video
                key={`${activeVideo.clip.id}-main`}
                ref={mainVideoRef}
                src={activeVideo.clip.mediaUrl}
                className={styles.previewVideo}
                playsInline
                preload="metadata"
              />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
};


