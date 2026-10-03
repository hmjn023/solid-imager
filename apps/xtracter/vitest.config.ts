import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@ext": path.resolve(import.meta.dirname, "./src"),
			"@": path.resolve(import.meta.dirname, "../../packages/core/src"),
			"@solid-imager/core": path.resolve(import.meta.dirname, "../../packages/core/src"),
			"@core": path.resolve(import.meta.dirname, "../../packages/core/src"),
		},
	},
	test: {
		environment: "node",
		globals: true,
	},
});
