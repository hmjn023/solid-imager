import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ["drizzle-orm", "effect"],
      external: ["ssh2"],
    },
    optimizeDeps: {
      exclude: ["ssh2", "cpu-features", "pg"],
    },
  },
});
