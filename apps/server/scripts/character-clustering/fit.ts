import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	buildNeighborGraph,
	fitSparseHdbscan,
} from "@solid-imager/application/utils/sparse-hdbscan";
import { optionsSchema, type MediaRecord } from "./schemas";
import { loadSnapshot, writeJson } from "./snapshot";

export function evaluateLabels(records: MediaRecord[], labels: Int32Array) {
	const truth = new Map<string, number>();
	const groups = new Map<number, Map<string, number>>();
	let labeledPoints = 0;
	let clusteredLabeledPoints = 0;
	for (let i = 0; i < records.length; i++) {
		if (records[i].characters.length !== 1) continue;
		const id = records[i].characters[0].id;
		labeledPoints++;
		truth.set(id, (truth.get(id) ?? 0) + 1);
		if (labels[i] >= 0) {
			clusteredLabeledPoints++;
			const group = groups.get(labels[i]) ?? new Map<string, number>();
			group.set(id, (group.get(id) ?? 0) + 1);
			groups.set(labels[i], group);
		}
	}
	const pairs = (n: number) => (n * (n - 1)) / 2;
	let truePositivePairs = 0;
	let predictedPairs = 0;
	let referencePairs = 0;
	let mixedLabelClusters = 0;
	for (const count of truth.values()) referencePairs += pairs(count);
	for (const group of groups.values()) {
		let size = 0;
		for (const count of group.values()) {
			size += count;
			truePositivePairs += pairs(count);
		}
		predictedPairs += pairs(size);
		if (group.size > 1) mixedLabelClusters++;
	}
	return {
		reference: "existing single-character labels, potentially noisy",
		labeledPoints,
		clusteredLabeledPoints,
		pairPrecision: predictedPairs ? truePositivePairs / predictedPairs : null,
		pairRecall: referencePairs ? truePositivePairs / referencePairs : null,
		truePositivePairs,
		predictedPairs,
		referencePairs,
		mixedLabelClusters,
	};
}

export async function requireNewOutput(output: string): Promise<void> {
	const exists = await stat(output).then(
		() => true,
		(error: NodeJS.ErrnoException) => {
			if (error.code === "ENOENT") return false;
			throw error;
		},
	);
	if (exists)
		throw new Error(`Refusing to overwrite existing output: ${output}`);
}

export async function fit(
	graphDirectory: string,
	output: string,
	request: object,
) {
	await requireNewOutput(output);
	const started = performance.now();
	const options = optionsSchema.parse(request);
	const { manifest, records, indices, distances } =
		await loadSnapshot(graphDirectory);
	const neighbors = options.neighbors ?? manifest.neighbors;
	if (neighbors < options.minSamples)
		throw new Error("neighbors must be at least minSamples");
	const graphStarted = performance.now();
	const graph = buildNeighborGraph(
		indices,
		distances,
		manifest.points,
		manifest.neighbors,
		neighbors,
	);
	const graphMs = performance.now() - graphStarted;
	const result = fitSparseHdbscan(graph, options);
	const counts = new Map<number, number>();
	const positions = new Map<number, number[]>();
	let noise = 0;
	for (let i = 0; i < result.labels.length; i++) {
		const label = result.labels[i];
		if (label < 0) {
			noise++;
			continue;
		}
		counts.set(label, (counts.get(label) ?? 0) + 1);
		const group = positions.get(label) ?? [];
		group.push(i);
		positions.set(label, group);
	}
	const clusters = [...positions]
		.map(([id, members]) => {
			const votes = new Map<
				string,
				{ id: string; name: string; count: number }
			>();
			for (const i of members)
				for (const character of records[i].characters) {
					const vote = votes.get(character.id) ?? { ...character, count: 0 };
					vote.count++;
					votes.set(character.id, vote);
				}
			const samples = members
				.toSorted(
					(a, b) =>
						result.membershipStrengths[b] - result.membershipStrengths[a] ||
						records[a].media_id.localeCompare(records[b].media_id),
				)
				.slice(0, 12)
				.map((i) => ({
					mediaId: records[i].media_id,
					fileName: records[i].file_name,
					membershipStrength: result.membershipStrengths[i],
				}));
			return {
				id,
				size: members.length,
				persistence: result.persistence[id],
				existingLabels: [...votes.values()].sort(
					(a, b) => b.count - a.count || a.id.localeCompare(b.id),
				),
				samples,
			};
		})
		.sort((a, b) => b.size - a.size || a.id - b.id);
	const summary = {
		formatVersion: 1,
		implementation: "typescript",
		algorithm: "HDBSCAN",
		metric: "cosine",
		approximateGraph: true,
		graphSnapshot: manifest,
		parameters: {
			neighbors,
			minClusterSize: options.minClusterSize,
			minSamples: options.minSamples,
			selectionMethod: options.selectionMethod,
			allowSingleCluster: false,
		},
		runtime: { bun: process.versions.bun, node: process.versions.node },
		points: manifest.points,
		clusters: counts.size,
		clustered: manifest.points - noise,
		noise,
		graphEdges: result.graphEdges,
		components: result.componentSizes.length,
		componentSizes: result.componentSizes,
		existingLabelAudit: evaluateLabels(records, result.labels),
		timings: { ...result.timings, graphMs },
		fitSeconds: (performance.now() - started) / 1000,
		peakRssMiB: process.resourceUsage().maxRSS / 1024,
	};
	await mkdir(path.dirname(output), { recursive: true });
	await mkdir(output);
	await writeJson(path.join(output, "clusters.json"), clusters);
	const assignments =
		records
			.map((record, i) =>
				JSON.stringify({
					mediaId: record.media_id,
					embeddingId: record.embedding_id,
					extractedAt: record.extracted_at,
					clusterId: result.labels[i],
					membershipStrength: result.membershipStrengths[i],
				}),
			)
			.join("\n") + "\n";
	await writeFile(path.join(output, "assignments.jsonl"), assignments, {
		flag: "wx",
	});
	await writeFile(
		path.join(output, "report.md"),
		`# TypeScript HDBSCAN experiment\n\nPoints: ${summary.points}\n\nClusters: ${summary.clusters}\n\nClustered: ${summary.clustered}; noise: ${summary.noise}\n\nFit: ${summary.fitSeconds.toFixed(3)} seconds; peak RSS: ${summary.peakRssMiB.toFixed(1)} MiB\n\nExisting-label audit (not verified ground truth):\n\n\x60\x60\x60json\n${JSON.stringify(summary.existingLabelAudit, null, 2)}\n\x60\x60\x60\n`,
	);
	await writeJson(path.join(output, "summary.json"), summary);
	return summary;
}
