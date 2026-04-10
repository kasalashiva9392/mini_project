/**
 * API origin for REST + Socket.IO. Set VITE_API_URL at build time in production
 * (e.g. https://api.yourdomain.com). Falls back to local dev server.
 */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_URL;
  if (typeof v === "string" && v.trim().length > 0) {
    return v.replace(/\/$/, "");
  }
  return "http://localhost:5000";
}
