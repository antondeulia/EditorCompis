"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterBar } from "@/components/layout/FilterBar";
import { NewProjectModal } from "@/components/modals/NewProjectModal";
import { NewVideoModal } from "@/components/modals/NewVideoModal";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { VideoCard } from "@/components/projects/VideoCard";
import { createProjectMock, createVideoMock } from "@/data/mocks/projects.mock-api";
import { CreateProjectInput, CreateVideoInput, Project } from "@/data/mocks/projects.mock";
import styles from "./ProjectsWorkspace.module.css";

type ProjectsWorkspaceProps = {
  initialProjects: Project[];
  selectedProjectId?: string;
};

export function ProjectsWorkspace({
  initialProjects,
  selectedProjectId,
}: ProjectsWorkspaceProps) {
  const tabItems = [
    { label: "All", count: 87 },
    { label: "Current", count: 6, active: true },
    { label: "Pending", count: 2 },
    { label: "Completed", count: 79 },
    { label: "Failed" },
  ];

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );
  const isProjectView = Boolean(selectedProject);

  async function handleCreateProject(payload: CreateProjectInput) {
    const created = await createProjectMock(payload);
    setProjects((currentProjects) => [created, ...currentProjects]);
  }

  async function handleCreateVideo(payload: CreateVideoInput) {
    if (!selectedProjectId) {
      return;
    }

    const createdVideo = await createVideoMock(payload);
    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === selectedProjectId
          ? { ...project, videos: [createdVideo, ...project.videos] }
          : project,
      ),
    );
  }

  const openCreateModal = useCallback(() => {
    if (selectedProject) {
      setIsVideoModalOpen(true);
      return;
    }

    setIsModalOpen(true);
  }, [selectedProject]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey && event.key === "Enter")) {
        return;
      }

      if (isModalOpen || isVideoModalOpen) {
        return;
      }

      event.preventDefault();
      openCreateModal();
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isModalOpen, isVideoModalOpen, openCreateModal]);

  return (
    <>
      <section className={styles.toolbarSection}>
        <div className={styles.toolbarHeader}>
          <div className={styles.headerBreadcrumb}>
            {selectedProject ? (
              <>
                <Link href="/" className={styles.headerBreadcrumbLink}>
                  Projects
                </Link>
                <span className={styles.headerBreadcrumbSeparator}>/</span>
                <span className={styles.headerBreadcrumbCurrent}>{selectedProject.name}</span>
              </>
            ) : (
              <span className={styles.headerBreadcrumbCurrent}>Projects</span>
            )}
          </div>
          <div className={styles.tabs}>
            {tabItems.map((tabItem) => (
              <button
                key={tabItem.label}
                type="button"
                className={tabItem.active ? styles.tabActive : styles.tab}
              >
                {tabItem.label}
                {typeof tabItem.count === "number" ? (
                  <span className={styles.tabCount}>{tabItem.count}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={isProjectView ? "Search videos" : "Search projects"}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M10.5 4a6.5 6.5 0 0 1 5.05 10.6l3.93 3.93a1 1 0 1 1-1.42 1.42l-3.93-3.93A6.5 6.5 0 1 1 10.5 4Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"
                />
              </svg>
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Notifications"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 3a5 5 0 0 1 5 5v2.59l1.7 2.97A1 1 0 0 1 17.84 15H6.16a1 1 0 0 1-.86-1.44L7 10.6V8a5 5 0 0 1 5-5Zm0 18a3 3 0 0 0 2.83-2H9.17A3 3 0 0 0 12 21Zm0-16a3 3 0 0 0-3 3v2.86c0 .17-.04.34-.12.49L7.88 13h8.24l-1-1.65a1 1 0 0 1-.12-.49V8a3 3 0 0 0-3-3Z"
                />
              </svg>
            </button>
            <button type="button" className={styles.userButton} aria-label="Profile">
              <span className={styles.userBadge}>3</span>
              <span className={styles.userAvatar}>A</span>
            </button>
          </div>
        </div>

        {selectedProject ? (
          <>
            <Link href="/" className={styles.backLink}>
              Back to projects
            </Link>
            <h1 className={styles.contentTitle}>{selectedProject.name}</h1>
            <p className={styles.projectDescription}>{selectedProject.description}</p>
            <FilterBar
              searchPlaceholder="Search videos"
              filters={["Published", "Draft", "Newest"]}
            />
          </>
        ) : (
          <>
            <h1 className={styles.contentTitle}>Projects</h1>
            <FilterBar
              searchPlaceholder="Search projects"
              filters={["Recent", "Published", "Draft"]}
            />
          </>
        )}
      </section>

      {!selectedProject ? (
        <section className={styles.grid}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </section>
      ) : (
        <section className={styles.videoGrid}>
          {selectedProject.videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </section>
      )}
      <div className={styles.floatingAddButtonWrap}>
        <span className={styles.floatingAddTooltip} role="tooltip">
          Ctrl + Enter
        </span>
        <button
          type="button"
          className={styles.floatingAddButton}
          onClick={openCreateModal}
          aria-label={selectedProject ? "Create new video" : "Create new project"}
        >
          +
        </button>
      </div>
      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />
      <NewVideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        onCreate={handleCreateVideo}
      />
    </>
  );
}
