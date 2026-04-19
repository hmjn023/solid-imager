import { defineConfig } from "vite-plus";

export default defineConfig({
	staged: {
		"apps/server/src/**/*.{ts,tsx,js,jsx,json}": [
			"vp run @solid-imager/server#check",
			"vp run @solid-imager/server#test:unit",
			"vp run @solid-imager/server#typecheck",
		],
		"packages/core/src/**/*.{ts,tsx,js,jsx,json}": [
			"vp run @solid-imager/core#check",
			"vp run @solid-imager/core#test:unit",
			"vp run @solid-imager/core#typecheck",
		],
		"packages/ui/src/**/*.{ts,tsx,js,jsx,json}": [
			"vp run @solid-imager/ui#check",
			"vp run @solid-imager/ui#test:unit",
			"vp run @solid-imager/ui#typecheck",
		],
		"xtracter/src/**/*.{ts,tsx,js,jsx,json}": [
			"vp run xtracter#check",
			"vp run xtracter#typecheck",
		],
	},
});
