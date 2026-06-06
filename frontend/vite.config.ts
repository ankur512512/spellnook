import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy /api to the backend container so the frontend can call
// relative URLs (same as prod behind nginx). Override host via env if needed.
const API_TARGET = process.env.VITE_API_TARGET || "http://backend:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
      "/ws": {
        target: API_TARGET,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
