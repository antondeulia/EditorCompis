import {
  CreateProjectInput,
  CreateVideoInput,
  Project,
  ProjectVideo,
  projectsSeed,
} from "./projects.mock";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// Adapter layer for future real API integration.
export async function getProjectsMock(): Promise<Project[]> {
  return clone(projectsSeed);
}

export async function createProjectMock(input: CreateProjectInput): Promise<Project> {
  const id = input.name.toLowerCase().trim().replace(/\s+/g, "-");
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: `${id || "project"}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    description: input.description.trim(),
    createdAt: today,
    lastPublishedAt: input.lastPublishedAt,
    videos: [],
  };
}

export async function createVideoMock(input: CreateVideoInput): Promise<ProjectVideo> {
  const today = new Date().toISOString().slice(0, 10);
  const baseId = input.title.toLowerCase().trim().replace(/\s+/g, "-");

  return {
    id: `${baseId || "video"}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title.trim(),
    description: input.description.trim(),
    uploadedAt: today,
    status: "Draft",
  };
}
