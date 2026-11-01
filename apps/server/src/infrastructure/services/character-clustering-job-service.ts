import { randomUUID } from "node:crypto";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { startCharacterClusteringSchema } from "@solid-imager/core/domain/characters/schemas";
import type {
	IJobRepository,
	Job,
} from "@solid-imager/core/domain/repositories/job-repository";
import { extract } from "../../../scripts/character-clustering/extract";
import { fit } from "../../../scripts/character-clustering/fit";
import { characterClusteringRoot } from "./character-clustering-results-store";

type ClusteringDependencies = {
	extract: (...args: Parameters<typeof extract>) => Promise<unknown>;
	fit: (...args: Parameters<typeof fit>) => Promise<unknown>;
	root: () => string;
};

export async function enqueueCharacterClustering(
	repo: Pick<IJobRepository, "create">,
	request: object,
) {
	const payload = startCharacterClusteringSchema.parse(request);
	const job = await repo.create({ type: "character_clustering", payload });
	return { jobId: job.id };
}

/** Publish graph and results together, so review never observes a partial run. */
export async function processCharacterClusteringJob(
	job: Job,
	repo: Pick<IJobRepository, "isCancellationRequested">,
	dependencies: ClusteringDependencies = {
		extract,
		fit,
		root: characterClusteringRoot,
	},
) {
	const options = startCharacterClusteringSchema.parse(job.payload);
	const root = dependencies.root();
	const name = `manager-${randomUUID()}`;
	// Staging is deeper than the review store's discovery limit.
	const staging = path.join(root, ".pending", name);
	await mkdir(staging, { recursive: true });
	try {
		if (await repo.isCancellationRequested(job.id)) return;
		await dependencies.extract(path.join(staging, "graph"), {
			neighbors: options.neighbors,
			efSearch: Math.max(256, options.neighbors),
			soloOnly: true,
		});
		if (await repo.isCancellationRequested(job.id)) return;
		await dependencies.fit(
			path.join(staging, "graph"),
			path.join(staging, "run"),
			options,
		);
		if (await repo.isCancellationRequested(job.id)) return;
		await rename(staging, path.join(root, name));
		return { success: true };
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}
