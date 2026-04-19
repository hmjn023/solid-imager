import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@solid-imager/core": path.resolve(__dirname, "../../packages/core/src"),
			"@solid-imager/ui": path.resolve(__dirname, "../../packages/ui/src"),
			"@": path.resolve(__dirname, "../../packages/core/src"),
			"~": path.resolve(__dirname, "./src"),
		},
		dedupe: ["zod"],
	},
	plugins: [
		tanstackRouter({
			target: "solid",
			autoCodeSplitting: true,
		}),
		solidPlugin(),
		tailwindcss(),
	],
});
