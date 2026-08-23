import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@ext": path.resolve(__dirname, "./src"),
			"@": path.resolve(__dirname, "../../packages/core/src"),
			"@solid-imager/core": path.resolve(__dirname, "../../packages/core/src"),
			"@core": path.resolve(__dirname, "../../packages/core/src"),
		},
	},
	test: {
		environment: "node",
		globals: true,
	},
});
