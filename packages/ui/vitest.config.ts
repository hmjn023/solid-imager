import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	ssr: {
		noExternal: ["solid-js", "@solidjs/web", "@solidjs/signals"],
		resolve: { conditions: ["browser", "development"] },
	},
	test: {
		environment: "node",
		exclude: [...configDefaults.exclude, "**/*.browser.test.tsx"],
		globals: true,
	},
});
