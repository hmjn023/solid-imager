import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ["drizzle-orm"],
    },
    optimizeDeps: {
      exclude: ["ssh2", "cpu-features", "pg"],
    },
  },
});
