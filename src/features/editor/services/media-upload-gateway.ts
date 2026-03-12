import { AssetKind } from "../model/types";
import { resolveCompisApiUrl } from "./compis-api-url";
import { isJsonRecord, JsonValue, tryParseJson } from "./http-json";

export type UploadedMediaAsset = {
  id: string;
  name: string;
  kind: AssetKind;
  src: string;
  mimeType: string;
  sizeBytes: number;
};

type UploadSuccessPayload = {
  asset: UploadedMediaAsset;
};

type UploadErrorPayload = {
  message?: string;
  error?: string;
};

function isAssetKind(value: JsonValue | undefined): value is AssetKind {
  return value === "video" || value === "audio" || value === "image" || value === "other";
}

function parseUploadSuccess(value: JsonValue | undefined): UploadSuccessPayload | null {
  if (!isJsonRecord(value) || !isJsonRecord(value.asset)) {
    return null;
  }

  const asset = value.asset;
  if (
    typeof asset.id !== "string" ||
    typeof asset.name !== "string" ||
    !isAssetKind(asset.kind) ||
    typeof asset.src !== "string" ||
    typeof asset.mimeType !== "string" ||
    typeof asset.sizeBytes !== "number" ||
    !Number.isFinite(asset.sizeBytes) ||
    asset.sizeBytes < 0
  ) {
    return null;
  }

  return {
    asset: {
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      src: asset.src,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
    },
  };
}

function parseErrorMessage(value: JsonValue | undefined): string | null {
  if (!isJsonRecord(value)) {
    return null;
  }

  const payload = value as UploadErrorPayload;
  return payload.message ?? payload.error ?? null;
}

export async function uploadEditorAsset(file: File): Promise<UploadedMediaAsset> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${resolveCompisApiUrl()}/editor/media/upload`, {
    method: "POST",
    body: formData,
  });

  const rawPayload = await tryParseJson(response);
  const parsed = parseUploadSuccess(rawPayload);

  if (!response.ok) {
    throw new Error(parseErrorMessage(rawPayload) ?? "Failed to upload media.");
  }

  if (!parsed) {
    throw new Error("Upload API returned invalid payload.");
  }

  const src = parsed.asset.src.startsWith("http")
    ? parsed.asset.src
    : `${resolveCompisApiUrl()}${parsed.asset.src}`;

  return {
    ...parsed.asset,
    src,
  };
}
