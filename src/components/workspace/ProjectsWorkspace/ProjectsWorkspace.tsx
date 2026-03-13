"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterBar } from "@/components/layout/FilterBar";
import { NewProjectModal } from "@/components/modals/NewProjectModal";
import { NewVideoModal } from "@/components/modals/NewVideoModal";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { VideoCard } from "@/components/projects/VideoCard";
import { localProjectLibraryGateway } from "@/data/projects.local";
import { CreateProjectInput, CreateVideoInput, Project } from "@/data/projects";
import styles from "./ProjectsWorkspace.module.css";

type ProjectsWorkspaceProps = {
  selectedProjectId?: string;
};

export function ProjectsWorkspace({
  selectedProjectId,
}: ProjectsWorkspaceProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );
  const isProjectView = Boolean(selectedProject);
  const totalVideoCount = useMemo(
    () => projects.reduce((sum, project) => sum + project.videos.length, 0),
    [projects],
  );
  const publishedVideoCount = useMemo(
    () =>
      projects.reduce(
        (sum, project) => sum + project.videos.filter((video) => video.status === "published").length,
        0,
      ),
    [projects],
  );
  const draftVideoCount = totalVideoCount - publishedVideoCount;
  const tabItems = useMemo(
    () => [
      { label: "Projects", count: projects.length, active: !isProjectView },
      { label: "Videos", count: totalVideoCount, active: isProjectView },
      { label: "Published", count: publishedVideoCount },
      { label: "Drafts", count: draftVideoCount },
    ],
    [draftVideoCount, isProjectView, projects.length, publishedVideoCount, totalVideoCount],
  );

  useEffect(() => {
    let isCancelled = false;

    void localProjectLibraryGateway.listProjects().then((storedProjects) => {
      if (isCancelled) {
        return;
      }

      setProjects(storedProjects);
      setIsHydrated(true);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleCreateProject(payload: CreateProjectInput) {
    const created = await localProjectLibraryGateway.createProject(payload);
    setProjects((currentProjects) => [created, ...currentProjects]);
  }

  async function handleCreateVideo(payload: CreateVideoInput) {
    if (!selectedProjectId) {
      return;
    }

    const updatedProject = await localProjectLibraryGateway.createVideo(selectedProjectId, payload);
    setProjects((currentProjects) =>
      currentProjects.map((project) => (project.id === selectedProjectId ? updatedProject : project)),
    );
  }

  const openCreateModal = useCallback(() => {
    if (selectedProject) {
      setIsVideoModalOpen(true);
      return;
    }

    setIsModalOpen(true);
  }, [selectedProject]);

  const isEmptyState = isHydrated && projects.length === 0;

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
          {isEmptyState ? (
            <p className={styles.projectDescription}>Create your first project to start building videos.</p>
          ) : (
            projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))
          )}
        </section>
      ) : (
        <section className={styles.videoGrid}>
          {selectedProject.videos.length === 0 ? (
            <p className={styles.projectDescription}>This project does not contain videos yet.</p>
          ) : (
            selectedProject.videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))
          )}
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
