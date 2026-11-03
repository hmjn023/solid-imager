import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@ext": path.resolve(import.meta.dirname, "./src"),



		},
	},
	test: {
		environment: "node",
		globals: true,
	},
});
