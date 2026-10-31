import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { requireNewOutput } from "./fit";
import { assignmentSchema } from "./schemas";
import { writeJson } from "./snapshot";

const savedSummarySchema = z.object({
	points: z.number().int().positive(),
	clusters: z.number().int().nonnegative(),
	clustered: z.number().int().nonnegative(),
	noise: z.number().int().nonnegative(),
	fitSeconds: z.number().nonnegative(),
	peakRssMiB: z.number().nonnegative(),
	implementation: z.string().optional(),
	parameters: z.object({
		neighbors: z.number().int(),
		minClusterSize: z.number().int(),
		minSamples: z.number().int(),
		selectionMethod: z.enum(["eom", "leaf"]),
	}),
	graphSnapshot: z.object({
		checksums: z.object({
			"media.jsonl": z.string(),
			"indices.npy": z.string(),
			"distances.npy": z.string(),
		}),
	}),
	existingLabelAudit: z.object({
		pairPrecision: z.number().nullable(),
		pairRecall: z.number().nullable(),
	}),
});

/** Label-permutation invariant ARI, including the degenerate identical partitions. */
export function adjustedRand(
	a: ArrayLike<number>,
	b: ArrayLike<number>,
): number {
	if (a.length !== b.length) throw new Error("Partition lengths do not match");
	if (a.length < 2) return 1;
	const rows = new Map<number, number>();
	const columns = new Map<number, number>();
	const cells = new Map<number, Map<number, number>>();
	const pairs = (n: number) => (n * (n - 1)) / 2;
	for (let i = 0; i < a.length; i++) {
		rows.set(a[i], (rows.get(a[i]) ?? 0) + 1);
		columns.set(b[i], (columns.get(b[i]) ?? 0) + 1);
		const row = cells.get(a[i]) ?? new Map<number, number>();
		row.set(b[i], (row.get(b[i]) ?? 0) + 1);
		cells.set(a[i], row);
	}
	let rowPairs = 0;
	let columnPairs = 0;
	let commonPairs = 0;
	for (const size of rows.values()) rowPairs += pairs(size);
	for (const size of columns.values()) columnPairs += pairs(size);
	for (const row of cells.values())
		for (const size of row.values()) commonPairs += pairs(size);
	const expected = (rowPairs * columnPairs) / pairs(a.length);
	const maximum = (rowPairs + columnPairs) / 2;
	return maximum === expected
		? 1
		: (commonPairs - expected) / (maximum - expected);
}

export async function compareRuns(directories: string[], output: string) {
	if (directories.length < 2) throw new Error("At least two runs required");
	await requireNewOutput(output);
	const runs = await Promise.all(
		directories.map(async (directory) => {
			const summary = savedSummarySchema.parse(
				JSON.parse(
					await readFile(path.join(directory, "summary.json"), "utf8"),
				),
			);
			const assignments = (
				await readFile(path.join(directory, "assignments.jsonl"), "utf8")
			)
				.trim()
				.split("\n")
				.map((line) => assignmentSchema.parse(JSON.parse(line)));
			if (
				assignments.length !== summary.points ||
				new Set(assignments.map((row) => row.embeddingId)).size !==
					summary.points
			)
				throw new Error("Invalid saved assignment count or duplicate IDs");
			return { directory, summary, assignments };
		}),
	);
	for (const run of runs.slice(1)) {
		const checksums = run.summary.graphSnapshot.checksums;
		for (const name of [
			"media.jsonl",
			"indices.npy",
			"distances.npy",
		] as const) {
			if (checksums[name] !== runs[0].summary.graphSnapshot.checksums[name])
				throw new Error("Runs do not share the same graph snapshot");
		}
		if (
			run.assignments.length !== runs[0].assignments.length ||
			run.assignments.some(
				(row, i) =>
					row.embeddingId !== runs[0].assignments[i].embeddingId ||
					row.mediaId !== runs[0].assignments[i].mediaId ||
					row.extractedAt !== runs[0].assignments[i].extractedAt,
			)
		)
			throw new Error("Runs do not share the same ordered embedding snapshot");
	}
	const comparisons = [];
	for (let left = 0; left < runs.length; left++)
		for (let right = left + 1; right < runs.length; right++) {
			const a = runs[left].assignments.map((row) => row.clusterId);
			const b = runs[right].assignments.map((row) => row.clusterId);
			const commonA: number[] = [];
			const commonB: number[] = [];
			let noiseMatches = 0;
			for (let i = 0; i < a.length; i++) {
				if (a[i] < 0 === b[i] < 0) noiseMatches++;
				if (a[i] >= 0 && b[i] >= 0) {
					commonA.push(a[i]);
					commonB.push(b[i]);
				}
			}
			comparisons.push({
				left: directories[left],
				right: directories[right],
				adjustedRandAll: adjustedRand(a, b),
				adjustedRandCommonClustered:
					commonA.length > 1 ? adjustedRand(commonA, commonB) : null,
				commonClusteredPoints: commonA.length,
				noiseStatusAgreement: noiseMatches / a.length,
			});
		}
	const result = {
		runs: runs.map(({ directory, summary }) => ({ directory, summary })),
		comparisons,
	};
	await mkdir(path.dirname(output), { recursive: true });
	await mkdir(output);
	await writeJson(path.join(output, "comparison.json"), result);
	const lines = [
		"# HDBSCAN run comparison",
		"",
		"Existing labels are an audit reference, not identification accuracy.",
		"",
		"| Run | k | Selection | Cluster / samples | Clusters | Clustered | Noise | Pair precision | Pair recall | Seconds | Peak MiB |",
		"| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
	];
	for (const run of runs) {
		const s = run.summary;
		const p = s.parameters;
		lines.push(
			`| ${path.basename(run.directory)} | ${p.neighbors} | ${p.selectionMethod} | ${p.minClusterSize}/${p.minSamples} | ${s.clusters} | ${s.clustered} | ${s.noise} | ${s.existingLabelAudit.pairPrecision?.toFixed(4) ?? "n/a"} | ${s.existingLabelAudit.pairRecall?.toFixed(4) ?? "n/a"} | ${s.fitSeconds.toFixed(3)} | ${s.peakRssMiB.toFixed(1)} |`,
		);
	}
	lines.push("", "## Partition comparisons", "");
	for (const comparison of comparisons)
		lines.push(
			`- ${path.basename(comparison.left)} vs ${path.basename(comparison.right)}: ARI=${comparison.adjustedRandAll}, ARI(common clustered)=${comparison.adjustedRandCommonClustered}, noise agreement=${comparison.noiseStatusAgreement}`,
		);
	await writeFile(path.join(output, "report.md"), lines.join("\n") + "\n");
	return result;
}
