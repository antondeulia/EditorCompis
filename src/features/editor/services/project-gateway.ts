import { VideoSchema } from "../model/schema";

export type EditorProjectSnapshot = {
  slug: string;
  schema: VideoSchema;
  updatedAt: string;
};

export type EditorProjectGateway = {
  saveDraft: (snapshot: EditorProjectSnapshot) => Promise<void>;
  loadDraft: (slug: string) => Promise<EditorProjectSnapshot | null>;
};

const storageKeyPrefix = "editor-compis:draft:";

export const localProjectGateway: EditorProjectGateway = {
  async saveDraft(snapshot) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(`${storageKeyPrefix}${snapshot.slug}`, JSON.stringify(snapshot));
  },

  async loadDraft(slug) {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = window.localStorage.getItem(`${storageKeyPrefix}${slug}`);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as EditorProjectSnapshot;
    } catch {
      return null;
    }
  },
};




