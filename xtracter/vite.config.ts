import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" with { type: "json" };

import path from "node:path";

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      "@ext": path.resolve(__dirname, "./src"),
      "~": path.resolve(__dirname, "../apps/server/src"),
      "@": path.resolve(__dirname, "../packages/core/src"),
      "@solid-imager/core": path.resolve(__dirname, "../packages/core/src"),
      "@solid-imager/server": path.resolve(__dirname, "../apps/server/src"),
      "@core": path.resolve(__dirname, "../packages/core/src"),
      "@server": path.resolve(__dirname, "../apps/server/src"),
    },
  },
});
