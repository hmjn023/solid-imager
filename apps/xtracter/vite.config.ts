import path from "node:path";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, "src/popup/index.html"),
        background: path.resolve(__dirname, "src/background/index.ts"),
        content: path.resolve(__dirname, "src/content/index.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
  resolve: {
    alias: {
      "@ext": path.resolve(__dirname, "./src"),
      "~": path.resolve(__dirname, "../../apps/server/src"),
      "@": path.resolve(__dirname, "../../packages/core/src"),
      "@solid-imager/core": path.resolve(__dirname, "../../packages/core/src"),
      "@solid-imager/server": path.resolve(__dirname, "../../apps/server/src"),
      "@core": path.resolve(__dirname, "../../packages/core/src"),
      "@server": path.resolve(__dirname, "../../apps/server/src"),
    },
  },
});
