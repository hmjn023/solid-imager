import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

import { tanstackStart } from '@tanstack/solid-start/plugin/vite'

import solidPlugin from 'vite-plugin-solid'
import { nitro } from 'nitro/vite'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@solid-imager/core": path.resolve(__dirname, "../../packages/core/src"),
      "@": path.resolve(__dirname, "../../packages/core/src"),
      "~": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    devtools(),
    nitro(),
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    solidPlugin({ ssr: true }),
  ],
  ssr: {
    noExternal: [
      "drizzle-orm",
      "effect",
      "solid-sonner"
    ],
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
})
