import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "demo" ? process.env.DEMO_BASE_PATH || "/repo-control/" : "/",
  build: {
    outDir: mode === "demo" ? "../../dist/demo" : "dist",
    emptyOutDir: true
  },
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": process.env.REPO_CONTROL_API_URL ?? "http://127.0.0.1:3747"
    }
  }
}));
