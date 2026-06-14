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

const bypassSecFetchDestPlugin = () => ({
  name: "bypass-sec-fetch-dest",
  configureServer(server: any) {
    server.middlewares.use((req: any, _res: any, next: any) => {
      if (req.url?.startsWith("/api/")) {
        if (req.headers["sec-fetch-dest"] === "image") {
          req.headers["x-orig-sec-fetch-dest"] = req.headers["sec-fetch-dest"];
          delete req.headers["sec-fetch-dest"];
        }
      }
      next();
    });
  },
});

export default defineConfig({
  resolve: {
    alias: {
      "@solid-imager/core": path.resolve(__dirname, "../../packages/core/src"),
      "@": path.resolve(__dirname, "../../packages/core/src"),
      "~": path.resolve(__dirname, "./src"),
    },
    tsconfigPaths: true,
  },
  plugins: [
    bypassSecFetchDestPlugin(),
    devtools(),
    nitro(),
    tanstackRouter({
      target: "solid",
      autoCodeSplitting: true,
      routeFileIgnorePattern: ".*/components/.*",
    }),
    tailwindcss(),
    tanstackStart(),
    solidPlugin({ ssr: true }),
  ],
  optimizeDeps: {
    exclude: ["bun", "dghs-imgutils-rs", "@lancedb/lancedb"],
  },
  customLogger: {
    warn(msg, options) {
      if (typeof msg === "string" && msg.includes("externalized for browser compatibility")) return;
      console.warn(msg, options);
    },
    warnOnce(msg, options) {
      this.warn(msg, options);
    },
    info: console.info,
    error: console.error,
    clearScreen: () => {},
    hasWarned: false,
  },
  build: {
    rollupOptions: {
      external: [
        "bun",
        "dghs-imgutils-rs",
        "ffmpeg-static",
        "fluent-ffmpeg",
        "@electric-sql/pglite",
        "archiver",
        "@lancedb/lancedb",
        "apache-arrow",
        "sharp",
      ],
    },
  },
  ssr: {
    noExternal: [
      "@tanstack/solid-router",
      "@tanstack/solid-query",
      "@tanstack/solid-start",
      "@kobalte/core",
      "solid-sonner",
      "corvu",
      "@solid-primitives/.*",
    ],
    external: [
      "bun",
      "@electric-sql/pglite",
      "ffmpeg-static",
      "ffmpeg-static-static",
      "fluent-ffmpeg",
      "archiver",
      "@lancedb/lancedb",
      "apache-arrow",
      "dghs-imgutils-rs",
      "sharp",
    ],
  },
});
