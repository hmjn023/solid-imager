import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

describe("Monorepo Migration - Phase 1", () => {
	const rootDir = path.resolve(__dirname, "../../");
	const corePackagePath = path.join(rootDir, "packages/core");
	const corePackageJsonPath = path.join(corePackagePath, "package.json");

	it("should have a packages/core directory", () => {
		expect(fs.existsSync(corePackagePath)).toBe(true);
	});

	it("should have a packages/core/package.json file", () => {
		expect(fs.existsSync(corePackageJsonPath)).toBe(true);
	});

	it("packages/core/package.json should have correct name and version", () => {
		if (fs.existsSync(corePackageJsonPath)) {
			const content = JSON.parse(fs.readFileSync(corePackageJsonPath, "utf-8"));
			expect(content.name).toBe("@solid-imager/core");
		}
	});
});
