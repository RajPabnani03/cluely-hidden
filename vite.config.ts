import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `VITE_BROWSER_MOCK=1` (npm run dev:browser) swaps the Tauri IPC layer for an
// in-browser simulation so the overlay UI can be designed/tested without macOS.
const browserMock = process.env.VITE_BROWSER_MOCK === "1";
const mockDir = fileURLToPath(new URL("./src/lib/tauri-mock", import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: browserMock
    ? {
        alias: {
          "@tauri-apps/api/core": `${mockDir}/core.ts`,
          "@tauri-apps/api/event": `${mockDir}/event.ts`,
        },
      }
    : undefined,

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 1421,
    },
    watch: {
      // Tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Env variables starting with the item of `envPrefix` will be exposed in tauri's source code through `import.meta.env`.
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: "safari13",
    // Default minification for release builds
    minify: true,
    sourcemap: false,
  },
});
