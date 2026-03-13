"use client";

import { Dispatch, SetStateAction, useCallback, useMemo, useState } from "react";
import { normalizeOverlayTimeline } from "../lib/utils";
import { ChatMessage } from "../model/chat";
import { SelectedTimelineTrack } from "../model/types";
import { VideoSchema } from "../model/schema";
import { createChatMessage, INITIAL_CHAT_MESSAGES, isSchemaGenerationRequest, shouldUseEditWorkflow, buildWorkflowSteps } from "../lib/chat-workflow";
import { requestEditorChatReplyStream } from "../services/editor-chat-gateway";
import { generateVideoSchema } from "../services/schema-generation-gateway";

type UseEditorChatParams = {
  videoSchema: VideoSchema;
  setVideoSchema: Dispatch<SetStateAction<VideoSchema>>;
  setSelectedElementKey: Dispatch<SetStateAction<string | null>>;
  setSelectedTimelineTrack: Dispatch<SetStateAction<SelectedTimelineTrack | null>>;
  seekToFrame: (frame: number) => void;
};

export function useEditorChat({
  videoSchema,
  setVideoSchema,
  setSelectedElementKey,
  setSelectedTimelineTrack,
  seekToFrame,
}: UseEditorChatParams) {
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatWorkflowStatus, setChatWorkflowStatus] = useState<"idle" | "planning" | "applying">("idle");

  const applyGeneratedSchema = useCallback(async (prompt: string) => {
    setChatWorkflowStatus("planning");

    const schemaPrompt = prompt.startsWith("/schema")
      ? prompt.replace(/^\/schema\s*/i, "").trim()
      : prompt;
    const data = await generateVideoSchema(
      schemaPrompt.length > 0 ? schemaPrompt : "Generate video schema based on recent chat context",
      videoSchema,
    );

    setChatWorkflowStatus("applying");
    const nextSchema = normalizeOverlayTimeline(data.schema);
    setVideoSchema(nextSchema);
    setSelectedElementKey(null);
    setSelectedTimelineTrack(null);
    seekToFrame(0);
    setChatWorkflowStatus("idle");
    setChatMessages((prev) => [
      ...prev,
      createChatMessage("assistant", "Updated edit schema generated from your prompt and applied to the timeline."),
    ]);
  }, [seekToFrame, setSelectedElementKey, setSelectedTimelineTrack, setVideoSchema, videoSchema]);

  const handleChatSubmit = useCallback(async () => {
    const prompt = chatPrompt.trim();
    if (!prompt || isChatLoading) {
      return;
    }

    const userMessage = createChatMessage("user", prompt);
    const history = chatMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setChatMessages((prev) => [...prev, userMessage]);
    setChatPrompt("");
    setIsChatLoading(true);

    try {
      if (isSchemaGenerationRequest(prompt) || shouldUseEditWorkflow(prompt)) {
        await applyGeneratedSchema(prompt);
        return;
      }

      const assistantMessageId = `assistant-stream-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      setChatMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
        },
      ]);

      await requestEditorChatReplyStream({
        message: prompt,
        history,
        onToken: (token) => {
          setChatMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId ? { ...message, content: `${message.content}${token}` } : message,
            ),
          );
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setChatWorkflowStatus("idle");
      setChatMessages((prev) => [...prev, createChatMessage("assistant", `Error: ${message}`)]);
    } finally {
      setIsChatLoading(false);
    }
  }, [applyGeneratedSchema, chatMessages, chatPrompt, isChatLoading]);

  const chatWorkflowSteps = useMemo(() => buildWorkflowSteps(chatWorkflowStatus), [chatWorkflowStatus]);

  return {
    chatPrompt,
    setChatPrompt,
    chatMessages,
    isChatLoading,
    chatWorkflowStatus,
    chatWorkflowSteps,
    handleChatSubmit,
  };
}
