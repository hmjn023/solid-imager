import { describe, expect, it } from "vitest";
import { readPlaywrightSelection } from "../../../scripts/e2e-arguments";

describe("E2E test selection", () => {
	it("keeps the default dev smoke selection when listing or changing execution options", () => {
		const selection = readPlaywrightSelection([
			"--list",
			"--headed",
			"-x",
			"--workers",
			"2",
			"--trace",
			"on",
			"--reporter",
			"list",
		]);
		expect(selection).toEqual({
			files: [],
			projects: [],
			listOnly: true,
			hasSelection: false,
		});
	});

	it("keeps file and project filters distinct, including a line and multiple projects", () => {
		const selection = readPlaywrightSelection([
			"pixiv.responsive.spec.ts:51",
			"--project",
			"tauri",
			"responsive-*",
			"--project=desktop",
			"-g",
			"viewer",
		]);
		expect(selection).toEqual({
			files: ["pixiv.responsive.spec.ts:51"],
			projects: ["tauri", "responsive-*", "desktop"],
			listOnly: false,
			hasSelection: true,
		});
	});

	it("respects an explicit filter even when no file is provided", () => {
		for (const args of [
			["-g", "focus"],
			["--last-failed"],
			["--test-list=cases.txt"],
		]) {
			expect(readPlaywrightSelection(args).hasSelection).toBe(true);
		}
	});
});
