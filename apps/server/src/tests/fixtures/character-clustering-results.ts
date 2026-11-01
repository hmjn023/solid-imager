import { createHash, randomUUID } from "node:crypto";
import { mkdir, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ClusteringSnapshotMedia } from "@solid-imager/core/domain/characters/schemas";

/** Saved review data only; clustering algorithm tests use independent fixtures. */
export async function seedClusteringResults(
	root: string,
	records: ClusteringSnapshotMedia[],
	options: { groupsEnd?: number } = {},
) {
	const bytes = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
	const checksum = createHash("sha256").update(bytes).digest("hex");
	const graph = path.join(root, "fixture/graph");
	await mkdir(graph, { recursive: true });
	await writeFile(path.join(graph, "media.jsonl"), bytes);
	await writeFile(
		path.join(graph, "graph.json"),
		JSON.stringify({
			status: "complete",
			checksums: { "media.jsonl": checksum },
		}),
	);
	for (const [index, name] of ["ts-review-a", "ts-review-b"].entries()) {
		const assignments = records.map((record, i) => ({
			mediaId: record.media_id,
			embeddingId: record.embedding_id,
			extractedAt: record.extracted_at,
			clusterId:
				index === 0
					? i < 60
						? 0
						: i < (options.groupsEnd ?? 150)
							? 1 + Math.floor((i - 60) / 6)
							: -1
					: i === 1
						? -1
						: 2,
			membershipStrength: index === 0 ? ((i % 10) + 1) / 10 : 0.8,
		}));
		const clustered = assignments.filter((item) => item.clusterId >= 0);
		const dir = path.join(root, "fixture", name);
		await mkdir(dir, { recursive: true });
		await writeFile(
			path.join(dir, "assignments.jsonl"),
			`${assignments.map((item) => JSON.stringify(item)).join("\n")}\n`,
		);
		const summaryPath = path.join(dir, "summary.json");
		await writeFile(
			summaryPath,
			JSON.stringify({
				formatVersion: 1,
				implementation: "typescript",
				points: records.length,
				clusters: new Set(clustered.map((item) => item.clusterId)).size,
				clustered: clustered.length,
				noise: records.length - clustered.length,
				parameters: {
					neighbors: 32,
					minClusterSize: 5,
					minSamples: index + 1,
					selectionMethod: "eom",
				},
				graphSnapshot: {
					soloOnly: true,
					checksums: { "media.jsonl": checksum },
				},
			}),
		);
		const completedAt = new Date(Date.UTC(2026, 9, 29, 12 - index));
		await utimes(summaryPath, completedAt, completedAt);
	}
	return {
		checksum,
		graph,
		runId: "fixture/ts-review-a",
		comparisonRunId: "fixture/ts-review-b",
	};
}

export function clusteringRecord(
	mediaId = randomUUID(),
	fileName = "fixture.png",
): ClusteringSnapshotMedia {
	return {
		embedding_id: randomUUID(),
		media_id: mediaId,
		source_id: "11111111-1111-4111-8111-111111111111",
		file_name: fileName,
		extracted_at: "2026-10-29T00:00:00.000Z",
		modified_at: "2026-10-29T00:00:00.000Z",
		characters: [],
	};
}
