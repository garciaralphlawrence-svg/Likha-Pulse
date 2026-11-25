import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    base: mode === "demo" ? "/Likha-Pulse/" : "/",
    server: { port: 5173, proxy: env.VITE_API_URL ? undefined : { "/api": "http://localhost:8000" } },
    build: { chunkSizeWarningLimit: 900 },
  };
});
