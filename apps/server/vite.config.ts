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

export default defineConfig(({ command }) => {
  const isTauriBuild = process.env.VITE_TAURI === "true" && command === "build";

  return {
    resolve: {
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
      ...(isTauriBuild ? [] : [nitro()]),
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tanstackRouter({
        target: "solid",
        autoCodeSplitting: true,
      }),
      tailwindcss(),
      tanstackStart(isTauriBuild ? { spa: { enabled: true } } : undefined),
      solidPlugin({ ssr: !isTauriBuild }),
    ],
    define: {
      __TAURI_BUILD__: isTauriBuild,
    },
    ...(isTauriBuild ? {} : {
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
          "archiver"
        ],
      },
    }),
  };
});
