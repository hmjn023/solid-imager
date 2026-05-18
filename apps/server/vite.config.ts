import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import solidPlugin from "vite-plugin-solid";
import { nitro } from "nitro/vite";
import { devtools } from "@tanstack/devtools-vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@solid-imager/core": path.resolve(
        __dirname,
        "../../packages/core/src"
      ),
      "@": path.resolve(__dirname, "../../packages/core/src"),
      "~": path.resolve(__dirname, "./src"),
    },
    tsconfigPaths: true,
  },
  plugins: [
    devtools(),
    nitro(),
    tanstackRouter({
      target: "solid",
      autoCodeSplitting: true,
    }),
    tailwindcss(),
    tanstackStart(),
    solidPlugin({ ssr: true }),
  ],
  customLogger: {
    warn(msg, options) {
      if (typeof msg === "string" && msg.includes("externalized for browser compatibility")) return;
      console.warn(msg, options);
    },
    warnOnce(msg, options) { this.warn(msg, options); },
    info: console.info,
    error: console.error,
    clearScreen: () => {},
    hasWarned: false,
  },
  ssr: {
    noExternal: [
      "@tanstack/solid-router",
      "@tanstack/solid-query",
      "@tanstack/solid-start",
      "@kobalte/core",
      "solid-sonner",
      "corvu",
      "@solid-primitives/.*"
    ],
    external: [
      "@electric-sql/pglite",
      "pg",
      "sharp",
      "ffmpeg-static",
      "ffmpeg-static-static",
      "fluent-ffmpeg",
      "archiver",
      "@lancedb/lancedb",
      "apache-arrow"
    ],
  },
});
