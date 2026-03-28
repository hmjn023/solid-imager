import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import solidPlugin from "vite-plugin-solid";
import { nitro } from "nitro/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    devtools(),
    nitro(),
    tailwindcss(),
    tanstackStart(),
    solidPlugin({ ssr: true }),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@solid-imager/core": path.resolve(
        __dirname,
        "../../packages/core/src"
      ),
      "@": path.resolve(__dirname, "../../packages/core/src"),
      "~": path.resolve(__dirname, "./src"),
    },
  },
  ssr: {
    noExternal: [
      "drizzle-orm",
      "effect",
      "memoirist",
      "cookie",
      "exact-mirror",
      "fast-decode-uri-component",
      "solid-sonner",
      "solid-js",
    ],
    external: ["pg"],
  },
  optimizeDeps: {
    exclude: ["pg"],
  },
  build: {
    rollupOptions: {
      external: ["pg"],
    },
  },
  server: {
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.data/**",
        "**/.thumbnails/**",
        "**/data/**",
        "**/tmp/**",
      ],
    },
  },
});
