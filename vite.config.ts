import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    "apps/server/src/**/*.{ts,tsx,js,jsx,json}": [
			"biome check --write --unsafe",
      "vp run @solid-imager/server#test:unit",
      "vp run @solid-imager/server#typecheck"
    ],
    "packages/core/src/**/*.{ts,tsx,js,jsx,json}": [
			"biome check --write --unsafe",
      "vp run @solid-imager/core#test:unit",
      "vp run @solid-imager/core#typecheck"
    ],
    "packages/ui/src/**/*.{ts,tsx,js,jsx,json}": [
			"biome check --write --unsafe",
      "vp run @solid-imager/ui#test:unit",
      "vp run @solid-imager/ui#typecheck"
    ],
    "xtracter/src/**/*.{ts,tsx,js,jsx,json}": [
			"biome check --write --unsafe",
      "vp run xtracter#typecheck"
    ]
  }
});
