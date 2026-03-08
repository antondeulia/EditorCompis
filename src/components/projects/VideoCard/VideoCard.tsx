import Link from "next/link";
import { useRef, useState } from "react";
import { ProjectVideo } from "@/data/mocks/projects.mock";
import styles from "./VideoCard.module.css";

type VideoCardProps = {
  video: ProjectVideo;
};

export function VideoCard({ video }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const uploadDate = new Date(video.uploadedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  async function togglePreviewPlayback() {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    if (videoElement.paused) {
      await videoElement.play();
      setIsPreviewPlaying(true);
      return;
    }

    videoElement.pause();
    setIsPreviewPlaying(false);
  }

  return (
    <article className={styles.videoCard}>
      <div className={styles.videoPreview}>
        <video
          ref={videoRef}
          src="/videos/IMG_1507.MP4"
          className={styles.videoPreviewMedia}
          preload="metadata"
          muted
          loop
          playsInline
        />
        <span className={styles.videoStatusBadge}>{video.status}</span>
        <button
          type="button"
          className={styles.videoPlayIcon}
          onClick={togglePreviewPlayback}
          aria-label={isPreviewPlaying ? "Pause preview" : "Play preview"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {isPreviewPlaying ? (
              <>
                <path fill="currentColor" d="M8 7.5h2.7v9H8z" />
                <path fill="currentColor" d="M13.3 7.5H16v9h-2.7z" />
              </>
            ) : (
              <path
                fill="currentColor"
                d="M9 7.5a1.5 1.5 0 0 1 2.3-1.27l6.5 4.15a1.5 1.5 0 0 1 0 2.54l-6.5 4.15A1.5 1.5 0 0 1 9 15.8V7.5Z"
              />
            )}
          </svg>
        </button>
      </div>
      <div className={styles.videoCardBody}>
        <h2 className={styles.videoCardTitle}>{video.title}</h2>
        <p className={styles.videoCardDescription}>{video.description}</p>
        <div className={styles.videoCardFooter}>
          <p className={styles.videoCardMeta}>Uploaded: {uploadDate}</p>
          <Link href={`/editor/${video.id}`} className={styles.videoEditButton}>
            Edit
          </Link>
        </div>
      </div>
    </article>
  );
}
