export type ProjectVideoStatus = "draft" | "published";

export type ProjectVideoSource = "blank" | "template" | "upload";

export type ProjectVideo = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  source: ProjectVideoSource;
  status: ProjectVideoStatus;
  previewAssetUrl?: string;
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  videos: ProjectVideo[];
};

export type CreateProjectInput = {
  name: string;
  description: string;
};

export type CreateVideoInput = {
  title: string;
  description: string;
  source: ProjectVideoSource;
  previewAssetUrl?: string;
};
