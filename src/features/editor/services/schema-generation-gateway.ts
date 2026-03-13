import { hydrateVideoSchema, VideoSchema } from "../model/schema";
import { isVideoSchema } from "../model/schema-validation";
import { resolveCompisApiUrl } from "./compis-api-url";
import { isJsonRecord, JsonValue, tryParseJson } from "./http-json";

type GenerateSchemaResult = {
  schema: VideoSchema;
};

type GenerateSchemaApiSuccess = {
  schema: VideoSchema;
};

type GenerateSchemaApiError = {
  message?: string;
  error?: string;
  details?: string;
};

function parseGenerateSchemaSuccess(
  value: JsonValue | undefined,
): GenerateSchemaApiSuccess | null {
  if (!isJsonRecord(value) || !("schema" in value) || !isVideoSchema(value.schema)) {
    return null;
  }

  return { schema: hydrateVideoSchema(value.schema) };
}

function parseErrorMessage(value: JsonValue | undefined): string | null {
  if (!isJsonRecord(value)) {
    return null;
  }

  const errorPayload = value as GenerateSchemaApiError;
  return errorPayload.message ?? errorPayload.error ?? null;
}

export async function generateVideoSchema(
  prompt: string,
  currentSchema: VideoSchema,
): Promise<GenerateSchemaResult> {
  const response = await fetch(
    `${resolveCompisApiUrl()}/editor/generate-schema`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        currentSchema,
      }),
    },
  );

  const rawPayload = await tryParseJson(response);
  const parsed = parseGenerateSchemaSuccess(rawPayload);

  if (!response.ok) {
    throw new Error(parseErrorMessage(rawPayload) ?? "Failed to generate schema.");
  }

  if (!parsed) {
    throw new Error("AI returned invalid schema.");
  }

  return parsed;
}
