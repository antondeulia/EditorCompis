export function resolveCompisApiUrl() {
  const raw = process.env.NEXT_PUBLIC_COMPIS_API_URL?.trim();
  const baseUrl = raw && raw.length > 0 ? raw : "http://localhost:4200";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}
