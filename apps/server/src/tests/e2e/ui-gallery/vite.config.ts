import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import solidPlugin from "vite-plugin-solid";
import { defineConfig } from "vite-plus";

const galleryRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(galleryRoot, "../../../../../..");

export default defineConfig({
	root: galleryRoot,
	resolve: {
		alias: {
			"@solid-imager/ui": path.join(workspaceRoot, "packages/ui/src"),
		},
		dedupe: ["solid-js", "solid-js/web"],
	},
	server: {
		fs: {
			allow: [workspaceRoot],
		},
	},
	plugins: [solidPlugin(), tailwindcss()],
});
