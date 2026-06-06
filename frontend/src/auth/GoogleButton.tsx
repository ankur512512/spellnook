import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID, useAuth } from "./authStore";

// Minimal typing for the Google Identity Services global.
declare global {
  interface Window {
    google?: any;
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gis_load_failed"));
    document.head.appendChild(s);
  });
}

export function GoogleButton() {
  const login = useAuth((s) => s.login);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp: { credential: string }) => login(resp.credential),
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: "filled_blue",
          size: "large",
          shape: "pill",
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [login]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="hint">
        Google sign-in isn’t configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> (and{" "}
        <code>GOOGLE_CLIENT_ID</code> on the backend) — see docs/AUTH_SETUP.md.
      </p>
    );
  }
  return <div ref={ref} />;
}
