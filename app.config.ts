import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: {
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
