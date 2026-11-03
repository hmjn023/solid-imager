import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_TARGET = process.env.VITE_API_URL || "http://192.168.1.150:3000";

export default defineConfig({
  base: "./",
  resolve: {
    alias: {




      "~": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "@tanstack/query-core",
      "@tanstack/solid-query",
      "@tanstack/solid-router",
      "solid-js",
      "solid-js/web",
      "zod",
    ],
  },
  server: {
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    tanstackRouter({
      target: "solid",
      autoCodeSplitting: true,
    }),
    solidPlugin(),
    tailwindcss(),
  ],
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(
      process.env.VITE_API_URL || "http://192.168.1.150:3000",
    ),
  },
});
