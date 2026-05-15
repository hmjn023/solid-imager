import { defineConfig } from "vite-plus";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		include: ["src/**/*.test.ts"],
	},
});
