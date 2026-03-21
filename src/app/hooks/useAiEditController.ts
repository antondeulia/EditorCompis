import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

import { applyEditingSchemaToTimeline } from "@/features/ai-editing/services/applyEditingSchemaToTimeline";
import { EditingSchema } from "@/features/ai-editing/types/editingSchema";
import { TimelineSequence } from "@/features/timeline/types/timeline";

import {
  STREAMING_CHUNK_SIZE,
  STREAMING_STEP_MS,
  SUBTITLE_REQUEST_PATTERN,
} from "../editor-data";
import {
  buildAiAssetContext,
  getTranscriptionCandidate,
} from "../editor-asset-utils";
import { hasTimelineChanged } from "../editor-timeline-utils";
import {
  createSubtitleEditingSchemaFromTranscript,
  createTranscriptionAudioFile,
  parseSubtitleGenerationPreferences,
} from "../editor-subtitles";
import {
  AiEditMessage,
  AiEditRouteResponse,
  AiEditStreamEvent,
  AssetItem,
  TranscriptSegment,
  TranscriptWord,
  TranscriptionRouteResponse,
} from "../editor-types";

interface UseAiEditControllerOptions {
  applySequence: (nextSequence: TimelineSequence) => void;
  assets: AssetItem[];
  getCurrentSequence: () => TimelineSequence;
}

const hasConcreteTimelineEdits = (schema: EditingSchema) =>
  schema.tracks.some((track) => track.clips.length > 0);

const CYRILLIC_PATTERN = /[А-Яа-яЁё]/;

const buildNoTimelineChangesFallback = (draftMessage: string) =>
  CYRILLIC_PATTERN.test(draftMessage)
    ? "Я не внёс изменений в таймлайн. Напиши точнее, что именно нужно поменять, и я попробую снова."
    : "I didn't end up changing the timeline. Tell me what to change and I'll try again.";

export const useAiEditController = ({
  applySequence,
  assets,
  getCurrentSequence,
}: UseAiEditControllerOptions) => {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AiEditMessage[]>([]);
  const [isRequestInFlight, setIsRequestInFlight] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcriptByAssetId, setTranscriptByAssetId] = useState<Record<string, TranscriptSegment[]>>({});
  const [transcriptWordsByAssetId, setTranscriptWordsByAssetId] = useState<Record<string, TranscriptWord[]>>({});

  const chatThreadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatThreadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isRequestInFlight, messages]);

  const streamAssistantText = useCallback(async (fullText: string) => {
    const text = fullText.trim();
    if (!text) {
      return;
    }

    setIsThinking(false);

    const messageId = `assistant-${crypto.randomUUID()}`;
    setMessages((currentMessages) => [
      ...currentMessages,
      { id: messageId, role: "assistant", text: "" },
    ]);

    let cursor = 0;
    while (cursor < text.length) {
      cursor = Math.min(cursor + STREAMING_CHUNK_SIZE, text.length);
      const nextText = text.slice(0, cursor);
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === messageId ? { ...message, text: nextText } : message,
        ),
      );

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, STREAMING_STEP_MS);
      });
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedMessage = draft.trim();
    if (!trimmedMessage) {
      return;
    }

    const userMessage: AiEditMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: "user",
      text: trimmedMessage,
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setDraft("");
    setIsRequestInFlight(true);
    setIsThinking(true);

    try {
      const isSubtitleRequest = SUBTITLE_REQUEST_PATTERN.test(trimmedMessage);
      let transcriptSegments: TranscriptSegment[] = [];
      let transcriptWords: TranscriptWord[] = [];

      if (isSubtitleRequest) {
        const transcriptionAsset = getTranscriptionCandidate(assets);
        if (!transcriptionAsset) {
          await streamAssistantText(
            "Cannot create real subtitles: no video or audio source was found for transcription.",
          );
          return;
        }

        const cachedTranscript = transcriptByAssetId[transcriptionAsset.id];
        const cachedWords = transcriptWordsByAssetId[transcriptionAsset.id];

        if (cachedTranscript && cachedTranscript.length > 0) {
          transcriptSegments = cachedTranscript;
          transcriptWords = cachedWords ?? [];
        } else {
          const preparedTranscriptionFile = await createTranscriptionAudioFile(transcriptionAsset.file);
          const transcriptionForm = new FormData();
          transcriptionForm.append("file", preparedTranscriptionFile, preparedTranscriptionFile.name);

          const transcriptionResponse = await fetch("/api/transcribe", {
            method: "POST",
            body: transcriptionForm,
          });
          const transcriptionPayload =
            (await transcriptionResponse.json()) as TranscriptionRouteResponse;

          if (!transcriptionResponse.ok || !transcriptionPayload.segments?.length) {
            const errorText = transcriptionPayload.error ?? "Transcription request failed.";
            const extraDetails = transcriptionPayload.details ? ` ${transcriptionPayload.details}` : "";
            await streamAssistantText(`${errorText}${extraDetails}`.trim());
            return;
          }

          transcriptSegments = transcriptionPayload.segments;
          transcriptWords = Array.isArray(transcriptionPayload.words)
            ? transcriptionPayload.words
            : [];
          setTranscriptByAssetId((currentById) => ({
            ...currentById,
            [transcriptionAsset.id]: transcriptionPayload.segments ?? [],
          }));
          setTranscriptWordsByAssetId((currentById) => ({
            ...currentById,
            [transcriptionAsset.id]: transcriptionPayload.words ?? [],
          }));
        }

        const subtitlePreferences = parseSubtitleGenerationPreferences(trimmedMessage);
        const subtitleSchema = createSubtitleEditingSchemaFromTranscript(
          transcriptSegments,
          transcriptWords,
          getCurrentSequence(),
          subtitlePreferences,
        );
        const previousSequence = getCurrentSequence();
        const nextSequence = applyEditingSchemaToTimeline(previousSequence, subtitleSchema);

        if (!hasTimelineChanged(previousSequence, nextSequence)) {
          await streamAssistantText(
            "The subtitle request did not produce timeline changes. Try being more specific about style or placement.",
          );
          return;
        }

        applySequence(nextSequence);
        await streamAssistantText(subtitleSchema.assistantMessage);
        return;
      }

      let assistantMessageId: string | null = null;
      let hasReceivedAssistantDelta = false;

      const ensureAssistantMessage = () => {
        if (assistantMessageId) {
          return assistantMessageId;
        }

        const nextId = `assistant-${crypto.randomUUID()}`;
        assistantMessageId = nextId;
        setMessages((currentMessages) => [
          ...currentMessages,
          { id: nextId, role: "assistant", text: "" },
        ]);
        return nextId;
      };

      const patchAssistantMessage = (
        applyPatchToText: (previousText: string) => string,
      ) => {
        const targetMessageId = ensureAssistantMessage();
        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === targetMessageId
              ? { ...message, text: applyPatchToText(message.text) }
              : message,
          ),
        );
      };

      const response = await fetch("/api/ai-edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userMessage: trimmedMessage,
          assets: buildAiAssetContext(assets),
          currentSequence: getCurrentSequence(),
          transcriptSegments,
        }),
      });

      if (!response.ok) {
        setIsThinking(false);
        let fallbackError = "AI Edit request failed.";

        try {
          const payload = (await response.json()) as AiEditRouteResponse;
          const errorText = payload.error ?? fallbackError;
          const extraDetails = payload.details ? ` ${payload.details}` : "";
          fallbackError = `${errorText}${extraDetails}`.trim();
        } catch {
          // Keep fallback text.
        }

        patchAssistantMessage(() => fallbackError);
        return;
      }

      if (!response.body) {
        setIsThinking(false);
        patchAssistantMessage(() => "AI Edit stream is empty.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let editingSchema: EditingSchema | null = null;
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        streamBuffer += decoder.decode(value, { stream: true });

        let lineBreakIndex = streamBuffer.indexOf("\n");
        while (lineBreakIndex !== -1) {
          const line = streamBuffer.slice(0, lineBreakIndex).trim();
          streamBuffer = streamBuffer.slice(lineBreakIndex + 1);

          if (line) {
            try {
              const streamEvent = JSON.parse(line) as AiEditStreamEvent;

              if (streamEvent.type === "assistant_started") {
                setIsThinking(false);
                ensureAssistantMessage();
              } else if (streamEvent.type === "assistant_delta" && typeof streamEvent.delta === "string") {
                if (!hasReceivedAssistantDelta) {
                  setIsThinking(false);
                }

                patchAssistantMessage((previousText) => {
                  if (!hasReceivedAssistantDelta) {
                    hasReceivedAssistantDelta = true;
                    return streamEvent.delta;
                  }

                  return previousText + streamEvent.delta;
                });
              } else if (streamEvent.type === "error") {
                setIsThinking(false);
                const details = streamEvent.details ? ` ${streamEvent.details}` : "";
                streamError = `${streamEvent.error}${details}`.trim();
                patchAssistantMessage(() => streamError ?? "AI Edit stream error.");
              } else if (streamEvent.type === "done") {
                setIsThinking(false);
                editingSchema = streamEvent.editingSchema;
                patchAssistantMessage(() => streamEvent.editingSchema.assistantMessage);
              }
            } catch {
              // Ignore malformed lines and keep parsing the stream.
            }
          }

          lineBreakIndex = streamBuffer.indexOf("\n");
        }
      }

      if (streamError) {
        return;
      }

      if (!editingSchema) {
        patchAssistantMessage((previousText) => previousText || "AI Edit stream completed without schema.");
        return;
      }

      const previousSequence = getCurrentSequence();
      const nextSequence = applyEditingSchemaToTimeline(previousSequence, editingSchema);

      if (!hasTimelineChanged(previousSequence, nextSequence)) {
        if (!hasConcreteTimelineEdits(editingSchema)) {
          return;
        }

        patchAssistantMessage((previousText) => {
          if (previousText.trim().length > 0) {
            return previousText;
          }

          return buildNoTimelineChangesFallback(trimmedMessage);
        });
        return;
      }

      applySequence(nextSequence);
    } catch {
      setIsThinking(false);
      await streamAssistantText("Network error while requesting OpenAI API.");
    } finally {
      setIsRequestInFlight(false);
      setIsThinking(false);
    }
  }, [
    applySequence,
    assets,
    draft,
    getCurrentSequence,
    streamAssistantText,
    transcriptByAssetId,
    transcriptWordsByAssetId,
  ]);

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      event.preventDefault();
      if (!isRequestInFlight) {
        void handleSubmit();
      }
    },
    [handleSubmit, isRequestInFlight],
  );

  return {
    chatThreadEndRef,
    draft,
    handleInputKeyDown,
    handleSubmit,
    isRequestInFlight,
    isThinking,
    messages,
    setDraft,
  };
};


