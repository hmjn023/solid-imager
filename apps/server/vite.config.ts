import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import solidPlugin from "vite-plugin-solid";
import { nitro } from "nitro/vite";
import { devtools } from "@tanstack/devtools-vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    dedupe: ["solid-js", "@tanstack/solid-router", "@tanstack/solid-query"],
    alias: {
      "@solid-imager/core": path.resolve(
        __dirname,
        "../../packages/core/src"
      ),
      "@": path.resolve(__dirname, "../../packages/core/src"),
      "~": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    devtools(),
    nitro(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackRouter({
      target: "solid",
      autoCodeSplitting: true,
    }),
    tailwindcss(),
    tanstackStart(),
    solidPlugin({ ssr: true }),
  ],
  ssr: {
    external: [
      "pg",
      "sharp",
      "ffmpeg-static",
      "ffmpeg-static-static",
      "fluent-ffmpeg",
      "archiver"
    ],
    noExternal: [
      "@tanstack/solid-router",
      "@tanstack/solid-start",
      "@tanstack/solid-query",
      "@tanstack/router-core",
      "@tanstack/history",
      "solid-js",
      "solid-sonner",
      "corvu",
      "@kobalte/core",
      "@solid-primitives/.*"
    ],
  },
});