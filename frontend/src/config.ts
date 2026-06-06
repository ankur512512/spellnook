/**
 * Runtime configuration.
 *
 * Values come from `/config.js` (injected per-environment at container start by
 * the prod nginx entrypoint), so ONE built frontend image works in any
 * environment. In dev, `public/config.js` is empty and we fall back to Vite's
 * build-time `import.meta.env` values.
 */
interface RuntimeConfig {
  apiUrl?: string;
  googleClientId?: string;
}

const runtime: RuntimeConfig =
  (typeof window !== "undefined" && (window as any).__SPELLNOOK_CONFIG__) || {};

// API base: empty string => same-origin relative URLs (dev proxy + prod nginx).
export const API_URL: string = runtime.apiUrl || import.meta.env.VITE_API_URL || "";

export const GOOGLE_CLIENT_ID: string =
  runtime.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
