import { NextResponse } from "next/server";

import {
  EDITING_SCHEMA_JSON_SCHEMA,
  isEditingSchema,
} from "@/features/ai-editing/types/editingSchema";
import { TimelineSequence } from "@/features/timeline/types/timeline";

interface AiEditAssetContext {
  id: string;
  name: string;
  mediaType: "video" | "audio" | "subtitle" | "unknown";
  durationFrames: number | null;
}

interface AiEditRequestBody {
  userMessage?: string;
  apiKey?: string;
  assets?: AiEditAssetContext[];
  currentSequence?: TimelineSequence;
  model?: string;
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";

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

const buildSystemPrompt = () =>
  [
    "You are an AI video editing planner.",
    "Return only valid JSON in the requested schema.",
    "Build an EditingSchema that can be applied directly to a timeline.",
    "Use only provided assets when source is 'asset'.",
    "Keep frame ranges inside sequence duration.",
    "Set track index as index among tracks of same type: 0 means first track of that type.",
    "Use type subtitle for subtitle/caption lines and source element for these clips.",
    "Subtitle clip.name must contain the actual subtitle text to show on screen.",
    "assistantMessage must be short and practical.",
  ].join(" ");

const buildUserPrompt = (
  userMessage: string,
  assets: AiEditAssetContext[],
  currentSequence: TimelineSequence,
) =>
  JSON.stringify(
    {
      userRequest: userMessage,
      assets,
      currentSequence,
      notes: [
        "Prefer deterministic editing decisions.",
        "If user asks to rebuild montage, provide full clips list for relevant tracks.",
        "When user asks for subtitles, create subtitle track clips with short readable text chunks.",
      ],
    },
    null,
    2,
  );

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
    const model =
      typeof body.model === "string" && body.model.trim().length > 0
        ? body.model.trim()
        : DEFAULT_MODEL;

    const openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: buildSystemPrompt(),
          },
          {
            role: "user",
            content: buildUserPrompt(userMessage, assets, currentSequence),
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
      return NextResponse.json(
        {
          error: `OpenAI request failed (${openAiResponse.status}).`,
          details: errorText.slice(0, 1000),
        },
        { status: 502 },
      );
    }

    const openAiPayload = (await openAiResponse.json()) as unknown;
    const rawText = extractResponseText(openAiPayload);

    if (!rawText) {
      return NextResponse.json(
        { error: "OpenAI returned empty response." },
        { status: 502 },
      );
    }

    let parsedSchema: unknown;
    try {
      parsedSchema = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "OpenAI returned non-JSON response." },
        { status: 502 },
      );
    }

    if (!isEditingSchema(parsedSchema)) {
      return NextResponse.json(
        { error: "OpenAI returned JSON that does not match EditingSchema." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      editingSchema: parsedSchema,
      usage: (openAiPayload as { usage?: unknown }).usage ?? null,
      model,
    });
  } catch {
    return NextResponse.json(
      { error: "Unexpected AI Edit server error." },
      { status: 500 },
    );
  }
}
