import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "@solid-imager/core": path.resolve(__dirname, "../../packages/core/src"),
        "@": path.resolve(__dirname, "../../packages/core/src"),
        "~": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ["drizzle-orm"],
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
