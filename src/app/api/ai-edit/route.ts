import { NextResponse } from "next/server";

import {
  AiEditorAssetContext,
  AiEditorTranscriptSegment,
  buildVideoEditorSystemPrompt,
  buildVideoEditorUserPrompt,
  DEFAULT_AI_EDIT_MODEL,
} from "@/features/ai-editing/agent/editorAgent";
import {
  EDITING_SCHEMA_JSON_SCHEMA,
  isEditingSchema,
} from "@/features/ai-editing/types/editingSchema";
import {
  ensureNonEmptyEditingSchemaForIntent,
  normalizeEditingSchema,
} from "@/features/ai-editing/services/normalizeEditingSchema";
import { TimelineSequence } from "@/features/timeline/types/timeline";

interface AiEditRequestBody {
  userMessage?: string;
  apiKey?: string;
  assets?: AiEditorAssetContext[];
  currentSequence?: TimelineSequence;
  transcriptSegments?: AiEditorTranscriptSegment[];
  model?: string;
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const STREAM_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

const isTimelineSequenceLike = (value: unknown): value is TimelineSequence => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TimelineSequence>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.frameRate === "number" &&
    Number.isFinite(candidate.frameRate) &&
    candidate.frameRate > 0 &&
    typeof candidate.durationFrames === "number" &&
    Number.isFinite(candidate.durationFrames) &&
    candidate.durationFrames > 0 &&
    Array.isArray(candidate.tracks)
  );
};

const extractResponseText = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const maybeOutputText = (payload as { output_text?: unknown }).output_text;
  if (typeof maybeOutputText === "string" && maybeOutputText.trim().length > 0) {
    return maybeOutputText;
  }

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  for (const outputItem of output) {
    if (!outputItem || typeof outputItem !== "object") {
      continue;
    }

    const content = (outputItem as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") {
        continue;
      }

      const maybeText = (contentItem as { text?: unknown }).text;
      if (typeof maybeText === "string" && maybeText.trim().length > 0) {
        return maybeText;
      }
    }
  }

  return "";
};

const extractDeltaText = (eventPayload: unknown): string => {
  if (!eventPayload || typeof eventPayload !== "object") {
    return "";
  }

  const maybeDelta = (eventPayload as { delta?: unknown }).delta;
  if (typeof maybeDelta === "string" && maybeDelta.length > 0) {
    return maybeDelta;
  }

  const maybeText = (eventPayload as { text?: unknown }).text;
  if (typeof maybeText === "string" && maybeText.length > 0) {
    return maybeText;
  }

  return "";
};

const extractJsonCandidate = (raw: string): string => {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return raw;
  }
  return raw.slice(firstBrace, lastBrace + 1);
};

const extractAssistantMessageFromPartialJson = (rawJson: string): string | null => {
  const keyMatch = /"assistantMessage"\s*:\s*"/.exec(rawJson);
  if (!keyMatch) {
    return null;
  }

  let cursor = keyMatch.index + keyMatch[0].length;
  let decoded = "";
  let isEscaping = false;

  while (cursor < rawJson.length) {
    const char = rawJson[cursor];

    if (isEscaping) {
      if (char === "u") {
        const codePoint = rawJson.slice(cursor + 1, cursor + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(codePoint)) {
          break;
        }
        decoded += String.fromCharCode(Number.parseInt(codePoint, 16));
        cursor += 5;
        isEscaping = false;
        continue;
      }

      if (char === "n") {
        decoded += "\n";
      } else if (char === "r") {
        decoded += "\r";
      } else if (char === "t") {
        decoded += "\t";
      } else if (char === "b") {
        decoded += "\b";
      } else if (char === "f") {
        decoded += "\f";
      } else {
        decoded += char;
      }

      cursor += 1;
      isEscaping = false;
      continue;
    }

    if (char === "\\") {
      isEscaping = true;
      cursor += 1;
      continue;
    }

    if (char === "\"") {
      return decoded;
    }

    decoded += char;
    cursor += 1;
  }

  return decoded;
};

const sanitizeTranscriptSegments = (value: unknown): AiEditorTranscriptSegment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((segment) => {
      if (!segment || typeof segment !== "object") {
        return null;
      }

      const typed = segment as Partial<AiEditorTranscriptSegment>;
      if (
        typeof typed.startSeconds !== "number" ||
        !Number.isFinite(typed.startSeconds) ||
        typeof typed.endSeconds !== "number" ||
        !Number.isFinite(typed.endSeconds) ||
        typed.endSeconds <= typed.startSeconds ||
        typeof typed.text !== "string"
      ) {
        return null;
      }

      const text = typed.text.trim();
      if (!text) {
        return null;
      }

      return {
        startSeconds: Math.max(0, typed.startSeconds),
        endSeconds: Math.max(typed.endSeconds, typed.startSeconds + 0.01),
        text,
      };
    })
    .filter((segment): segment is AiEditorTranscriptSegment => segment !== null);
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AiEditRequestBody;
    const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
    const apiKey =
      typeof body.apiKey === "string" && body.apiKey.trim().length > 0
        ? body.apiKey.trim()
        : process.env.OPENAI_API_KEY;

    if (!userMessage) {
      return NextResponse.json(
        { error: "userMessage is required." },
        { status: 400 },
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is missing. Provide apiKey or OPENAI_API_KEY." },
        { status: 400 },
      );
    }

    const currentSequence = body.currentSequence;
    if (!isTimelineSequenceLike(currentSequence)) {
      return NextResponse.json(
        { error: "currentSequence is invalid." },
        { status: 400 },
      );
    }

    const assets = Array.isArray(body.assets) ? body.assets : [];
    const transcriptSegments = sanitizeTranscriptSegments(body.transcriptSegments);
    const model =
      typeof body.model === "string" && body.model.trim().length > 0
        ? body.model.trim()
        : DEFAULT_AI_EDIT_MODEL;

    const openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        input: [
          {
            role: "system",
            content: buildVideoEditorSystemPrompt(),
          },
          {
            role: "user",
            content: buildVideoEditorUserPrompt({
              userMessage,
              assets,
              currentSequence,
              transcriptSegments,
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "editing_schema",
            schema: EDITING_SCHEMA_JSON_SCHEMA,
            strict: true,
          },
        },
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "error",
                error: `OpenAI request failed (${openAiResponse.status}).`,
                details: errorText.slice(0, 1000),
              })}\n`,
            ),
          );
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: STREAM_HEADERS });
    }

    if (!openAiResponse.body) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", error: "OpenAI stream is empty." })}\n`));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: STREAM_HEADERS });
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const reader = openAiResponse.body!.getReader();
        const decoder = new TextDecoder();

        const emit = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };

        let buffer = "";
        let rawJsonText = "";
        let streamedAssistantChars = 0;
        let completedResponsePayload: unknown = null;

        const tryEmitAssistantDelta = () => {
          const partialMessage = extractAssistantMessageFromPartialJson(rawJsonText);
          if (partialMessage === null || partialMessage.length <= streamedAssistantChars) {
            return;
          }
          emitAssistantStarted();
          const delta = partialMessage.slice(streamedAssistantChars);
          streamedAssistantChars = partialMessage.length;
          emit({ type: "assistant_delta", delta });
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            let boundaryIndex = buffer.indexOf("\n\n");
            while (boundaryIndex !== -1) {
              const eventBlock = buffer.slice(0, boundaryIndex);
              buffer = buffer.slice(boundaryIndex + 2);

              const dataLines = eventBlock
                .split("\n")
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trimStart());

              if (dataLines.length > 0) {
                const dataValue = dataLines.join("\n");
                if (dataValue === "[DONE]") {
                  boundaryIndex = buffer.indexOf("\n\n");
                  continue;
                }

                try {
                  const parsedEvent = JSON.parse(dataValue) as { type?: unknown; response?: unknown };
                  const eventType = typeof parsedEvent.type === "string" ? parsedEvent.type : "";

                  if (eventType === "error") {
                    emit({ type: "error", error: "OpenAI streaming error.", details: dataValue.slice(0, 1000) });
                    controller.close();
                    return;
                  }

                  const isJsonTextDelta =
                    eventType === "response.output_text.delta" || eventType === "response.delta";
                  const deltaChunk = isJsonTextDelta ? extractDeltaText(parsedEvent) : "";
                  if (deltaChunk.length > 0) {
                    rawJsonText += deltaChunk;
                    tryEmitAssistantDelta();
                  }

                  if (eventType === "response.completed") {
                    completedResponsePayload = parsedEvent.response;
                  }
                } catch {
                  // Ignore malformed single events and continue reading stream.
                }
              }

              boundaryIndex = buffer.indexOf("\n\n");
            }
          }

          const completedText = completedResponsePayload
            ? extractResponseText(completedResponsePayload)
            : "";
          const preferredRawText = completedText.trim().length > 0 ? completedText : rawJsonText;

          if (!preferredRawText.trim()) {
            emit({ type: "error", error: "OpenAI returned empty response." });
            controller.close();
            return;
          }

          let parsedSchema: unknown;
          try {
            parsedSchema = JSON.parse(preferredRawText);
          } catch {
            try {
              parsedSchema = JSON.parse(extractJsonCandidate(preferredRawText));
            } catch {
              emit({ type: "error", error: "OpenAI returned non-JSON response." });
              controller.close();
              return;
            }
          }

          if (!isEditingSchema(parsedSchema)) {
            emit({ type: "error", error: "OpenAI returned JSON that does not match EditingSchema." });
            controller.close();
            return;
          }

          const normalizedSchema = normalizeEditingSchema({
            schema: parsedSchema,
            currentSequence,
            assets,
            userMessage,
          });

          const ensuredSchema = ensureNonEmptyEditingSchemaForIntent({
            schema: normalizedSchema,
            currentSequence,
            userMessage,
          });

          if (ensuredSchema.assistantMessage.length > streamedAssistantChars) {
            emit({
              type: "assistant_delta",
              delta: ensuredSchema.assistantMessage.slice(streamedAssistantChars),
            });
          }

          emit({
            type: "done",
            editingSchema: ensuredSchema,
            usage: (completedResponsePayload as { usage?: unknown } | null)?.usage ?? null,
            model,
          });
          controller.close();
        } catch {
          emit({ type: "error", error: "Unexpected AI Edit server error." });
          controller.close();
        }
      },
    });

    return new Response(stream, { status: 200, headers: STREAM_HEADERS });
  } catch {
    return NextResponse.json(
      { error: "Unexpected AI Edit server error." },
      { status: 500 },
    );
  }
}



