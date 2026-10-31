import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CharacterClusteringReviewService } from "@solid-imager/application/services/character-clustering-review-service";
import {
	clusteringGroupsRequestSchema,
	clusteringMediaRequestSchema,
} from "@solid-imager/core/domain/characters/schemas";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileCharacterClusteringResultsStore } from "~/infrastructure/services/character-clustering-results-store";
import {
	clusteringRecord,
	seedClusteringResults,
} from "../../fixtures/character-clustering-results";

const roots: string[] = [];
vi.mock("~/infrastructure/logger", () => ({ logger: { warn: vi.fn() } }));
async function setup() {
	const root = await mkdtemp(path.join(tmpdir(), "clustering-review-"));
	roots.push(root);
	const records = Array.from({ length: 200 }, (_, i) =>
		clusteringRecord(undefined, `image-${String(i).padStart(3, "0")}.png`),
	);
	const first = records[0];
	const second = records[1];
	if (!first || !second) throw new Error("Missing fixture records");
	first.characters = [
		{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Alice" },
	];
	second.characters = [
		{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Bob" },
	];
	const fixture = await seedClusteringResults(root, records);
	const store = new FileCharacterClusteringResultsStore(root);
	return {
		root,
		records,
		store,
		service: new CharacterClusteringReviewService(store),
		...fixture,
	};
}
afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("saved character clustering review", () => {
	it("lists projected runs, pages groups, and includes both strong and boundary examples", async () => {
		const { store, service, runId } = await setup();
		const runs = await store.listRuns();
		expect(runs.map((run) => run.id)).toEqual([
			"fixture/ts-review-a",
			"fixture/ts-review-b",
		]);
		expect(runs[0]).toMatchObject({
			points: 200,
			clusters: 16,
			noise: 50,
			soloOnly: true,
		});
		expect(runs[0]).not.toHaveProperty("graphSnapshot");
		const result = await service.listGroups(
			clusteringGroupsRequestSchema.parse({ runId, limit: 2 }),
		);
		expect(result.total).toBe(16);
		expect(result.groups).toHaveLength(2);
		const group = result.groups[0];
		if (!group) throw new Error("Missing group");
		expect(group).toMatchObject({
			id: 0,
			size: 60,
			labelKinds: 2,
			minimumStrength: 0.1,
		});
		expect(group.previews.map((image) => image.membershipStrength)).toEqual([
			1, 1, 1, 0.1, 0.1, 0.1,
		]);
		expect(new Set(group.previews.map((image) => image.id)).size).toBe(6);
		const page = await service.listGroups(
			clusteringGroupsRequestSchema.parse({ runId, offset: 2, limit: 2 }),
		);
		expect(page.groups.map((item) => item.id)).toEqual([2, 3]);
	});
	it("searches labels and filenames, pages noise, compares by stable image identity", async () => {
		const { service, runId, comparisonRunId, records } = await setup();
		const filtered = await service.listGroups(
			clusteringGroupsRequestSchema.parse({ runId, query: "alice" }),
		);
		expect(filtered.groups.map((group) => group.id)).toEqual([0]);
		const detail = await service.listMedia(
			clusteringMediaRequestSchema.parse({
				runId,
				comparisonRunId,
				clusterId: 0,
				limit: 48,
			}),
		);
		expect(detail.total).toBe(60);
		expect(detail.media).toHaveLength(48);
		expect(detail.media[0]?.membershipStrength).toBe(0.1);
		expect(
			detail.media.find((image) => image.id === records[1]?.media_id)
				?.comparisonClusterId,
		).toBe(-1);
		expect(detail.media[0]).not.toHaveProperty("embeddingId");
		const noise = await service.listMedia(
			clusteringMediaRequestSchema.parse({
				runId,
				comparisonRunId,
				clusterId: -1,
				offset: 48,
				limit: 48,
				order: "name",
			}),
		);
		expect(noise.total).toBe(50);
		expect(noise.media).toHaveLength(2);
		expect(noise.media[0]?.comparisonClusterId).toBe(2);
		const image = await service.listMedia(
			clusteringMediaRequestSchema.parse({
				runId,
				clusterId: -1,
				query: "image-199",
			}),
		);
		expect(image.total).toBe(1);
	});
	it("rejects traversal and symlink escapes without exposing server paths", async () => {
		const { root, store } = await setup();
		await expect(store.loadRun("../../outside")).rejects.toThrow(
			"形式または内容",
		);
		await symlink(
			path.join(root, "fixture/ts-review-a"),
			path.join(root, "linked"),
		);
		expect((await store.listRuns()).some((run) => run.id === "linked")).toBe(
			false,
		);
		await rm(path.join(root, "fixture/ts-review-a/assignments.jsonl"));
		await symlink(
			"/etc/passwd",
			path.join(root, "fixture/ts-review-a/assignments.jsonl"),
		);
		await expect(store.loadRun("fixture/ts-review-a")).rejects.toThrow(
			"参照が不正",
		);
		await expect(store.loadRun("missing")).rejects.toThrow(
			"解析結果 was not found",
		);
	});
	it("invalidates cached runs and rejects changed snapshots or incomplete results", async () => {
		const { root, graph, store, runId } = await setup();
		await store.loadRun(runId);
		const assignments = path.join(root, runId, "assignments.jsonl");
		const original = await readFile(assignments, "utf8");
		await writeFile(
			assignments,
			`${original.split("\n").slice(1).join("\n")}\n`,
		);
		await expect(store.loadRun(runId)).rejects.toThrow("件数が一致");
		await writeFile(assignments, original);
		await writeFile(path.join(graph, "media.jsonl"), "changed\n");
		await expect(store.loadRun(runId)).rejects.toThrow("内容が変わっています");
	});
	it("rejects comparisons across cohorts", async () => {
		const { store, runId, comparisonRunId } = await setup();
		const run = await store.loadRun(runId);
		const comparison = await store.loadRun(comparisonRunId);
		const service = new CharacterClusteringReviewService({
			listRuns: async () => [],
			loadRun: async (id) =>
				id === runId
					? run
					: {
							...comparison,
							summary: { ...comparison.summary, cohortId: "b".repeat(64) },
						},
		});
		await expect(
			service.listGroups(
				clusteringGroupsRequestSchema.parse({ runId, comparisonRunId }),
			),
		).rejects.toThrow("同じ対象画像");
	});
});
