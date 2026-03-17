import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    "apps/server/src/**/*.{ts,tsx,js,jsx,json}": [
      "bun --filter @solid-imager/server check",
      "bun --filter @solid-imager/server test:unit",
      "bash -c 'bun --filter @solid-imager/server typecheck'"
    ],
    "packages/core/src/**/*.{ts,tsx,js,jsx,json}": [
      "bun --filter @solid-imager/core check",
      "bun --filter @solid-imager/core test:unit",
      "bash -c 'bun --filter @solid-imager/core typecheck'"
    ],
    "packages/ui/src/**/*.{ts,tsx,js,jsx,json}": [
      "bun --filter @solid-imager/ui check",
      "bun --filter @solid-imager/ui test:unit",
      "bash -c 'bun --filter @solid-imager/ui typecheck'"
    ],
    "xtracter/src/**/*.{ts,tsx,js,jsx,json}": [
      "bun --filter xtracter check",
      "bash -c 'bun --filter xtracter typecheck'"
    ]
  },

});
