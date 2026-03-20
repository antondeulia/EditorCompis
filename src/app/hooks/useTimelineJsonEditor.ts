import { useCallback, useState } from "react";

import { TimelineSequence } from "@/features/timeline/types/timeline";

import { isTimelineSequence } from "../editor-timeline-utils";

interface UseTimelineJsonEditorOptions {
  applySequence: (nextSequence: TimelineSequence) => void;
  getCurrentSequence: () => TimelineSequence;
}

export const useTimelineJsonEditor = ({
  applySequence,
  getCurrentSequence,
}: UseTimelineJsonEditorOptions) => {
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);

  const prepareJsonDraft = useCallback(() => {
    setJsonDraft(JSON.stringify(getCurrentSequence(), null, 2));
    setJsonStatus(null);
  }, [getCurrentSequence]);

  const loadCurrentJson = useCallback(() => {
    setJsonDraft(JSON.stringify(getCurrentSequence(), null, 2));
    setJsonStatus("Loaded current timeline JSON.");
  }, [getCurrentSequence]);

  const clearJsonDraft = useCallback(() => {
    setJsonDraft("");
  }, []);

  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonDraft);
      setJsonStatus("JSON copied to clipboard.");
    } catch {
      setJsonStatus("Unable to copy JSON. Browser blocked clipboard access.");
    }
  }, [jsonDraft]);

  const applyJson = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonDraft);

      if (!isTimelineSequence(parsed)) {
        setJsonStatus("JSON schema is invalid for timeline sequence.");
        return;
      }

      applySequence(parsed);
      setJsonStatus("Timeline updated from JSON.");
    } catch {
      setJsonStatus("JSON parse error. Check syntax and try again.");
    }
  }, [applySequence, jsonDraft]);

  return {
    applyJson,
    clearJsonDraft,
    copyJson,
    jsonDraft,
    jsonStatus,
    loadCurrentJson,
    prepareJsonDraft,
    setJsonDraft,
  };
};
