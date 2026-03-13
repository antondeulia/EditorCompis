import Link from "next/link";
import { Project } from "@/data/projects";
import styles from "./ProjectCard.module.css";

type ProjectCardProps = {
  project: Project;
};

export function ProjectCard({ project }: ProjectCardProps) {
  const logoThemeVariants = [styles.logoSports, styles.logoHomechoice, styles.logoPodcast];
  const logoTheme = logoThemeVariants[project.name.length % logoThemeVariants.length];
  const logoLabel = project.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((token) => token[0]?.toUpperCase() ?? "")
    .join("");
  const latestVideos = [...project.videos]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);

  return (
    <Link href={`/?project=${project.id}`} className={styles.projectCard}>
      <div className={styles.projectCardTop}>
        <span className={`${styles.projectCardLogo} ${logoTheme}`}>{logoLabel}</span>
        <span className={styles.projectDots} aria-hidden="true">
          ...
        </span>
      </div>
      <h2 className={styles.projectCardTitle}>{project.name}</h2>
      <p className={styles.projectCardWorkspace}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M14 3h7v7h-2V6.41l-9.3 9.3-1.4-1.42 9.29-9.29H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z"
          />
        </svg>
        {project.slug}
      </p>
      <p className={styles.projectCardDescription}>{project.description}</p>
      <div className={styles.latestVideosBlock}>
        <p className={styles.latestVideosTitle}>Latest videos</p>
        <div className={styles.latestVideosViewport}>
          <ul className={styles.latestVideosList}>
            {latestVideos.map((video) => (
              <li key={video.id} className={styles.latestVideoItem}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M8 6.5a1.5 1.5 0 0 1 2.31-1.26l7 4.5a1.5 1.5 0 0 1 0 2.52l-7 4.5A1.5 1.5 0 0 1 8 15.5v-9Z"
                  />
                </svg>
                <span>{video.title}</span>
              </li>
            ))}
          </ul>
          <span className={styles.latestVideosFog} aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}
