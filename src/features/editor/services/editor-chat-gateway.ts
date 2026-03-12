import { resolveCompisApiUrl } from "./compis-api-url";

export type EditorChatMessagePayload = {
  role: "user" | "assistant";
  content: string;
};

type StreamEvent =
  | { type: "token"; token: string }
  | { type: "done" }
  | { type: "error"; message: string };

function parseSseEvent(raw: string): StreamEvent | null {
  const normalized = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");

  if (!normalized) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as StreamEvent;
    if (parsed.type === "token" && typeof parsed.token === "string") {
      return parsed;
    }

    if (parsed.type === "done") {
      return parsed;
    }

    if (parsed.type === "error" && typeof parsed.message === "string") {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export async function requestEditorChatReplyStream(params: {
  message: string;
  history: EditorChatMessagePayload[];
  onToken: (token: string) => void;
}): Promise<void> {
  const response = await fetch(`${resolveCompisApiUrl()}/editor/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: params.message,
      history: params.history,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || "Failed to send chat message.");
  }

  if (!response.body) {
    throw new Error("Chat API returned empty stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawChunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const event = parseSseEvent(rawChunk);
      if (event?.type === "token") {
        params.onToken(event.token);
      }
      if (event?.type === "error") {
        throw new Error(event.message);
      }
      if (event?.type === "done") {
        return;
      }

      boundary = buffer.indexOf("\n\n");
    }
  }
}
