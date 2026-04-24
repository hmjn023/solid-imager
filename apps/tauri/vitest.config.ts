import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vite-plus";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		alias: {
			"~": path.resolve(__dirname, "./src"),
		},
		environment: "node",
		globals: true,
		include: ["src/**/*.test.ts"],
		pool: "forks",
	},
});
