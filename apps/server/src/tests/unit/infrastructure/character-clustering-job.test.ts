import {
	mkdtemp,
	mkdir,
	readdir,
	rm,
	writeFile,
	readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
import {
	enqueueCharacterClustering,
	processCharacterClusteringJob,
} from "~/infrastructure/services/character-clustering-job-service";

describe("manager character clustering jobs", () => {
	let root: string;
	const job: Job = {
		id: "11111111-1111-4111-8111-111111111111",
		type: "character_clustering",
		mediaSourceId: null,
		status: "in_progress",
		payload: {},
		result: null,
		error: null,
		parentId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	beforeEach(async () => {
		root = await mkdtemp(path.join(tmpdir(), "manager-clustering-"));
	});
	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});
	const repo = () => ({
		isCancellationRequested: vi.fn().mockResolvedValue(false),
	});
	const dependencies = () => ({
		root: () => root,
		extract: vi.fn(async (output: string) => {
			await mkdir(output);
			await writeFile(path.join(output, "graph.json"), "graph");
		}),
		fit: vi.fn(async (_graph: string, output: string) => {
			await mkdir(output);
			await writeFile(path.join(output, "summary.json"), "result");
		}),
	});
	it("queues validated defaults without a source and rejects invalid density before queuing", async () => {
		const create = vi.fn().mockResolvedValue(job);
		await expect(enqueueCharacterClustering({ create }, {})).resolves.toEqual({
			jobId: job.id,
		});
		expect(create).toHaveBeenCalledWith({
			type: "character_clustering",
			payload: {
				neighbors: 64,
				minClusterSize: 5,
				minSamples: 3,
				selectionMethod: "leaf",
			},
		});
		await expect(
			enqueueCharacterClustering({ create }, { neighbors: 2, minSamples: 3 }),
		).rejects.toThrow();
		expect(create).toHaveBeenCalledOnce();
	});
	it("publishes complete graph and results together and preserves previous runs on retries", async () => {
		const deps = dependencies();
		await processCharacterClusteringJob(job, repo(), deps);
		await processCharacterClusteringJob(job, repo(), deps);
		const published = (await readdir(root)).filter((name) =>
			name.startsWith("manager-"),
		);
		expect(published).toHaveLength(2);
		for (const name of published) {
			expect(
				await readFile(path.join(root, name, "graph/graph.json"), "utf8"),
			).toBe("graph");
			expect(
				await readFile(path.join(root, name, "run/summary.json"), "utf8"),
			).toBe("result");
		}
		expect(await readdir(path.join(root, ".pending"))).toEqual([]);
		expect(deps.extract).toHaveBeenCalledWith(expect.any(String), {
			neighbors: 64,
			efSearch: 256,
			soloOnly: true,
		});
	});
	it("removes partial extraction on failure and propagates failure to the worker", async () => {
		const deps = dependencies();
		deps.fit.mockRejectedValueOnce(new Error("fit failed"));
		await expect(
			processCharacterClusteringJob(job, repo(), deps),
		).rejects.toThrow("fit failed");
		expect(await readdir(root)).toEqual([".pending"]);
		expect(await readdir(path.join(root, ".pending"))).toEqual([]);
	});
	it("does not fit or publish if cancelled after extraction", async () => {
		const repository = repo();
		repository.isCancellationRequested
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);
		const deps = dependencies();
		await processCharacterClusteringJob(job, repository, deps);
		expect(deps.extract).toHaveBeenCalledOnce();
		expect(deps.fit).not.toHaveBeenCalled();
		expect(await readdir(root)).toEqual([".pending"]);
		expect(await readdir(path.join(root, ".pending"))).toEqual([]);
	});
	it("rejects invalid persisted payloads before creating files", async () => {
		await expect(
			processCharacterClusteringJob(
				{ ...job, payload: { selectionMethod: "invalid" } },
				repo(),
				dependencies(),
			),
		).rejects.toThrow();
		expect(await readdir(root)).toEqual([]);
	});
});
