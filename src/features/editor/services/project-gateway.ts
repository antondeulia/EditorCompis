import { createEmptyVideoSchema, hydrateVideoSchema, VideoSchema } from "../model/schema";
import { normalizeOverlayTimeline } from "../lib/utils";

export type EditorProjectSnapshot = {
  slug: string;
  schema: VideoSchema;
  updatedAt: string;
};

export type EditorProjectGateway = {
  saveDraft: (snapshot: EditorProjectSnapshot) => Promise<void>;
  loadDraft: (slug: string) => Promise<EditorProjectSnapshot | null>;
  createEmptyDraft: (slug: string) => EditorProjectSnapshot;
};

const storageKeyPrefix = "editor-compis:draft:";

function buildSchemaTitleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

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
      const parsed = JSON.parse(raw) as EditorProjectSnapshot;
      return {
        ...parsed,
        schema: normalizeOverlayTimeline(hydrateVideoSchema(parsed.schema)),
      };
    } catch {
      return null;
    }
  },

  createEmptyDraft(slug) {
    return {
      slug,
      schema: normalizeOverlayTimeline(
        createEmptyVideoSchema({
          title: buildSchemaTitleFromSlug(slug) || "Untitled Video",
        }),
      ),
      updatedAt: new Date().toISOString(),
    };
  },
};




