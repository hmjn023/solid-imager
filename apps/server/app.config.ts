import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  vite: {
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
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ["drizzle-orm", "effect"],
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
  },
});
