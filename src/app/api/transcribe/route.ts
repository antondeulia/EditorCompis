import { NextResponse } from "next/server";

interface TranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

interface TranscriptWord {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

interface OpenAiVerboseSegment {
  start?: unknown;
  end?: unknown;
  text?: unknown;
}

interface OpenAiVerboseWord {
  start?: unknown;
  end?: unknown;
  word?: unknown;
}

const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const TRANSCRIPTION_MODEL = "whisper-1";

interface TranscriptionAttemptResult {
  ok: boolean;
  status: number;
  payload: unknown | null;
  errorText: string;
}

const extractSegmentsFromPayload = (payload: unknown): TranscriptSegment[] => {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const segments = (payload as { segments?: unknown }).segments;
  if (!Array.isArray(segments)) {
    return [];
  }

  return segments
    .map((segment) => {
      if (!segment || typeof segment !== "object") {
        return null;
      }

      const typedSegment = segment as OpenAiVerboseSegment;
      if (
        typeof typedSegment.start !== "number" ||
        !Number.isFinite(typedSegment.start) ||
        typeof typedSegment.end !== "number" ||
        !Number.isFinite(typedSegment.end) ||
        typedSegment.end <= typedSegment.start ||
        typeof typedSegment.text !== "string"
      ) {
        return null;
      }

      const text = typedSegment.text.trim();
      if (!text) {
        return null;
      }

      return {
        startSeconds: Math.max(0, typedSegment.start),
        endSeconds: Math.max(typedSegment.end, typedSegment.start + 0.01),
        text,
      };
    })
    .filter((segment): segment is TranscriptSegment => segment !== null);
};

const extractWordsFromPayload = (payload: unknown): TranscriptWord[] => {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const words = (payload as { words?: unknown }).words;
  if (!Array.isArray(words)) {
    return [];
  }

  return words
    .map((wordItem) => {
      if (!wordItem || typeof wordItem !== "object") {
        return null;
      }

      const typedWord = wordItem as OpenAiVerboseWord;
      if (
        typeof typedWord.start !== "number" ||
        !Number.isFinite(typedWord.start) ||
        typeof typedWord.end !== "number" ||
        !Number.isFinite(typedWord.end) ||
        typedWord.end <= typedWord.start ||
        typeof typedWord.word !== "string"
      ) {
        return null;
      }

      const text = typedWord.word.trim();
      if (!text) {
        return null;
      }

      return {
        startSeconds: Math.max(0, typedWord.start),
        endSeconds: Math.max(typedWord.end, typedWord.start + 0.01),
        text,
      };
    })
    .filter((word): word is TranscriptWord => word !== null);
};

const buildOpenAiForm = (file: File, language: string | null) => {
  const openAiForm = new FormData();
  openAiForm.append("model", TRANSCRIPTION_MODEL);
  openAiForm.append("response_format", "verbose_json");
  openAiForm.append("timestamp_granularities[]", "segment");
  openAiForm.append("timestamp_granularities[]", "word");
  if (language) {
    openAiForm.append("language", language);
  }
  openAiForm.append("file", file, file.name);
  return openAiForm;
};

const requestOpenAiTranscription = async (
  apiKey: string,
  file: File,
  language: string | null,
): Promise<TranscriptionAttemptResult> => {
  const openAiResponse = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: buildOpenAiForm(file, language),
  });

  if (!openAiResponse.ok) {
    return {
      ok: false,
      status: openAiResponse.status,
      payload: null,
      errorText: await openAiResponse.text(),
    };
  }

  return {
    ok: true,
    status: openAiResponse.status,
    payload: (await openAiResponse.json()) as unknown,
    errorText: "",
  };
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is missing. Set OPENAI_API_KEY." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const fileField = formData.get("file");
    const languageField = formData.get("language");
    const language =
      typeof languageField === "string" && languageField.trim().length > 0
        ? languageField.trim()
        : null;

    if (!(fileField instanceof File)) {
      return NextResponse.json(
        { error: "file is required and must be a File." },
        { status: 400 },
      );
    }

    const openAiResult = await requestOpenAiTranscription(apiKey, fileField, language);

    if (!openAiResult.ok) {
      const sizeHint =
        openAiResult.status === 413
          ? " File is over OpenAI content-size limit. Try a shorter clip or smaller export."
          : "";

      return NextResponse.json(
        {
          error: `OpenAI transcription failed (${openAiResult.status}).`,
          details: `${openAiResult.errorText.slice(0, 1000)}${sizeHint}`.trim(),
        },
        { status: 502 },
      );
    }

    const segments = extractSegmentsFromPayload(openAiResult.payload);
    const words = extractWordsFromPayload(openAiResult.payload);
    if (segments.length === 0) {
      return NextResponse.json(
        { error: "OpenAI transcription returned no segments." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      segments,
      words,
    });
  } catch {
    return NextResponse.json(
      { error: "Unexpected transcription server error." },
      { status: 500 },
    );
  }
}
