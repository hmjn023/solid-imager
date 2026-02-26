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
        "@server": path.resolve(__dirname, "../../apps/server/src"),
        "~": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/api": "http://localhost:3000",
      },
    },
    ssr: {
      noExternal: ["drizzle-orm", "effect", "@solid-imager/server"],
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
  },
});
