import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      {
        // The GitHub Pages demo is fully static, so lock it down with a strict CSP (Bantay, 2026-11-26).
        name: "demo-csp",
        transformIndexHtml: (html: string) =>
          mode === "demo"
            ? html.replace(
                "<meta charset=\"UTF-8\" />",
                "<meta charset=\"UTF-8\" />\n    <meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'\" />",
              )
            : html,
      },
    ],
    base: mode === "demo" ? "/Likha-Pulse/" : "/",
    server: { port: 5173, proxy: env.VITE_API_URL ? undefined : { "/api": "http://localhost:8000" } },
    build: { chunkSizeWarningLimit: 900 },
  };
});
