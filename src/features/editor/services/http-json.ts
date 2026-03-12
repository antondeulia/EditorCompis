type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonRecord | JsonValue[];
export type JsonRecord = { [key: string]: JsonValue };

export function isJsonRecord(value: JsonValue | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function tryParseJson(response: Response): Promise<JsonValue | undefined> {
  try {
    return (await response.json()) as JsonValue;
  } catch {
    return undefined;
  }
}

