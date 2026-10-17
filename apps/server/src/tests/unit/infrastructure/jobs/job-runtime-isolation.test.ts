import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
async function files(directory: string): Promise<string[]> {
	const result: string[] = [];
	for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
		if (entry.name === "tests") continue;
		const file = path.join(directory, entry.name);
		if (entry.isDirectory()) result.push(...(await files(file)));
		else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
			result.push(file);
	}
	return result;
}
describe("generic jobs runtime isolation", () => {
	it("keeps normal server/application code independent of generic jobs storage", async () => {
		const violations: string[] = [];
		for (const root of [
			path.resolve("src/infrastructure"),
			path.resolve("../../packages/application/src"),
		])
			for (const file of await files(root)) {
				const source = (await fs.readFile(file, "utf8"))
					.replace(/\/\*[\s\S]*?\*\//g, "")
					.replace(/^\s*\/\/.*$/gm, "");
				if (
					/\b(?:createJobRepository|IJobRepository|getJobRepository|registerJobRepository|processJob|executeProcessMediaJob)\b|(?<![./\w])jobs\s*\.(?!\.)|\b(?:FROM|JOIN|INTO|UPDATE|TRUNCATE)\s+["']?(?:public\.)?jobs\b/i.test(
						source,
					)
				)
					violations.push(path.relative(process.cwd(), file));
			}
		expect(violations).toEqual([]);
	});
	it("keeps matrix and known legacy classification synchronized", async () => {
		const { retiredGenericJobTypes } =
			await import("@solid-imager/core/domain/jobs/schemas");
		const matrix = await fs.readFile(
			path.resolve("../../docs/operations/jobs-migration-matrix.md"),
			"utf8",
		);
		const documented = [...matrix.matchAll(/^\| `([^`]+)` \|/gm)].map(
			(match) => match[1],
		);
		expect(documented.sort()).toEqual([...retiredGenericJobTypes].sort());
	});
});
