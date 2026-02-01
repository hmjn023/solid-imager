import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "@solid-imager/core": path.resolve(process.cwd(), "packages/core/src"),
        "@": path.resolve(process.cwd(), "packages/core/src"),
      },
    },
    // @ts-ignore: Vite version mismatch in Vinxi/SolidStart
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ["drizzle-orm", "effect"],
      external: ["ssh2", "pg"],
    },
    optimizeDeps: {
      exclude: ["ssh2", "cpu-features", "pg"],
    },
    build: {
      rollupOptions: {
        external: ["pg"],
      },
    },
  },
});
