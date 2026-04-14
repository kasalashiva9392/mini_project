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

function isBrowserOnDeployedHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h !== "localhost" && h !== "127.0.0.1";
}

function apiBaseLooksLocal(base: string): boolean {
  return base.includes("localhost") || base.includes("127.0.0.1");
}

/** Shown when the browser cannot reach the API (wrong baked-in URL or API down). */
export function apiUnreachableUserMessage(): string {
  const base = getApiBaseUrl();
  if (isBrowserOnDeployedHost() && apiBaseLooksLocal(base)) {
    return `Cannot reach API — the bundle still points to ${base}. On Render (static site): Environment → set VITE_API_URL to your public API URL (e.g. https://your-api.onrender.com), then Clear build cache & redeploy.`;
  }
  if (isBrowserOnDeployedHost() && !apiBaseLooksLocal(base)) {
    return `Cannot reach API at ${base}. If /health opens OK, this is often CORS: on your Render API service set CLIENT_URL to this page’s origin (${typeof window !== "undefined" ? window.location.origin : "your frontend URL"}) and redeploy the API. See the browser console for CORS errors.`;
  }
  return `Cannot reach API at ${base}. If you are deployed, set VITE_API_URL at build time. Otherwise start the API and check the Network tab.`;
}
