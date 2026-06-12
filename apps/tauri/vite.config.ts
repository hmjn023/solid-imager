import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_TARGET = process.env.VITE_API_URL || "http://192.168.1.150:3000";

export default defineConfig({
	base: "./",
	resolve: {
		alias: {
			"@solid-imager/core": path.resolve(__dirname, "../../packages/core/src"),
			"@solid-imager/client": path.resolve(__dirname, "../../packages/client/src"),
			"@solid-imager/ui": path.resolve(__dirname, "../../packages/ui/src"),
			"@": path.resolve(__dirname, "../../packages/core/src"),
			"~": path.resolve(__dirname, "./src"),
		},
		dedupe: ["zod", "solid-js", "solid-js/web"],
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
			routeFileIgnorePattern: ".*/components/.*",
		}),
		tailwindcss(),
		tanstackStart({
			spa: {
				enabled: true,
				prerender: {
					outputPath: "/index.html",
				},
			},
		}),
		solidPlugin({ ssr: true }),
	],
	define: {
		"import.meta.env.VITE_API_URL": JSON.stringify(
			process.env.VITE_API_URL || "http://192.168.1.150:3000",
		),
	},
});
