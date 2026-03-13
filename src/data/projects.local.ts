"use client";

import { createEmptyVideoSchema } from "@/features/editor/model/schema";
import { CreateProjectInput, CreateVideoInput, Project, ProjectVideo } from "./projects";

const PROJECTS_STORAGE_KEY = "editor-compis:projects";
const EDITOR_DRAFT_STORAGE_KEY_PREFIX = "editor-compis:draft:";

function nowIsoString() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createStableId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function readProjects(): Project[] {
  if (!canUseStorage()) {
    return [];
  }

  const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Project[]) : [];
  } catch {
    return [];
  }
}

function writeProjects(projects: Project[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

function createProjectRecord(input: CreateProjectInput): Project {
  const timestamp = nowIsoString();
  const normalizedName = input.name.trim();

  return {
    id: createStableId("project"),
    name: normalizedName,
    slug: slugify(normalizedName) || "project",
    description: input.description.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    videos: [],
  };
}

function createVideoRecord(projectId: string, input: CreateVideoInput): ProjectVideo {
  const timestamp = nowIsoString();
  const normalizedTitle = input.title.trim();

  return {
    id: createStableId("video"),
    projectId,
    title: normalizedTitle,
    description: input.description.trim(),
    slug: `${slugify(normalizedTitle) || "video"}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    source: input.source,
    status: "draft",
    previewAssetUrl: input.previewAssetUrl,
  };
}

function createVideoDraftSnapshot(video: ProjectVideo) {
  return {
    slug: video.slug,
    schema: createEmptyVideoSchema({
      id: `schema-${video.id}`,
      title: video.title,
    }),
    updatedAt: video.updatedAt,
  };
}

export const localProjectLibraryGateway = {
  async listProjects() {
    return readProjects();
  },

  async createProject(input: CreateProjectInput) {
    const createdProject = createProjectRecord(input);
    const nextProjects = [createdProject, ...readProjects()];
    writeProjects(nextProjects);
    return createdProject;
  },

  async createVideo(projectId: string, input: CreateVideoInput) {
    const projects = readProjects();
    const projectIndex = projects.findIndex((project) => project.id === projectId);
    if (projectIndex < 0) {
      throw new Error("Project not found.");
    }

    const createdVideo = createVideoRecord(projectId, input);
    const updatedProject: Project = {
      ...projects[projectIndex],
      updatedAt: createdVideo.updatedAt,
      videos: [createdVideo, ...projects[projectIndex].videos],
    };

    const nextProjects = [...projects];
    nextProjects[projectIndex] = updatedProject;
    writeProjects(nextProjects);

    window.localStorage.setItem(
      `${EDITOR_DRAFT_STORAGE_KEY_PREFIX}${createdVideo.slug}`,
      JSON.stringify(createVideoDraftSnapshot(createdVideo)),
    );

    return updatedProject;
  },
};
