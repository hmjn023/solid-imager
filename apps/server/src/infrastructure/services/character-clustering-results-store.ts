import { createHash } from "node:crypto";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type {
	ICharacterClusteringResultsStore,
	StoredClusteringRun,
} from "@solid-imager/application/ports/character-clustering-results-store";
import { CharacterClusteringReviewService } from "@solid-imager/application/services/character-clustering-review-service";
import {
	clusteringAssignmentSchema,
	clusteringRunIdSchema,
	clusteringSnapshotMediaSchema,
	type ClusteringRunSummary,
	type ClusteringSnapshotMedia,
} from "@solid-imager/core/domain/characters/schemas";
import {
	DomainError,
	ResourceNotFoundError,
	ValidationError,
} from "@solid-imager/core/domain/errors";
import { z } from "zod";
import { logger } from "~/infrastructure/logger";

const summaryFileSchema = z
	.object({
		formatVersion: z.literal(1),
		implementation: z.string().default("python"),
		points: z.number().int().positive(),
		clusters: z.number().int().nonnegative(),
		clustered: z.number().int().nonnegative(),
		noise: z.number().int().nonnegative(),
		parameters: z.object({
			neighbors: z.number().int().positive(),
			minClusterSize: z.number().int().min(2),
			minSamples: z.number().int().positive(),
			selectionMethod: z.enum(["eom", "leaf"]),
		}),
		graphSnapshot: z.object({
			soloOnly: z.boolean().default(false),
			checksums: z.object({
				"media.jsonl": z.string().regex(/^[a-f0-9]{64}$/),
			}),
		}),
	})
	.refine(
		(value) => value.clustered + value.noise === value.points,
		"解析件数が一致しません。",
	);

function defaultRoot(): string {
	if (process.env.CHARACTER_CLUSTERING_DIR)
		return path.resolve(process.env.CHARACTER_CLUSTERING_DIR);
	const cwd = process.cwd();
	const root =
		path.basename(cwd) === "server" &&
		path.basename(path.dirname(cwd)) === "apps"
			? path.resolve(cwd, "../..")
			: cwd;
	return path.join(root, ".cache/character-clustering");
}

function isMissing(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Reads only allowlisted saved runs and explicitly projects public review DTOs. */
export class FileCharacterClusteringResultsStore implements ICharacterClusteringResultsStore {
	private readonly cache = new Map<
		string,
		{ stamp: string; promise: Promise<StoredClusteringRun> }
	>();
	private readonly metadata = new Map<
		string,
		{
			stamp: string;
			cohortId: string;
			records: Map<string, ClusteringSnapshotMedia>;
		}
	>();
	constructor(private readonly root = defaultRoot()) {}

	private async safeFile(relative: string): Promise<string> {
		const root = await realpath(this.root);
		const target = await realpath(path.resolve(root, relative));
		const inside = path.relative(root, target);
		if (
			!inside ||
			inside === ".." ||
			inside.startsWith(`..${path.sep}`) ||
			path.isAbsolute(inside)
		)
			throw new ValidationError("解析結果への参照が不正です。");
		return target;
	}

	private async directories(): Promise<string[]> {
		try {
			const entries = await readdir(this.root, { withFileTypes: true });
			const result: string[] = [];
			for (const entry of entries) {
				if (
					!entry.isDirectory() ||
					!clusteringRunIdSchema.safeParse(entry.name).success
				)
					continue;
				result.push(entry.name);
				for (const child of await readdir(path.join(this.root, entry.name), {
					withFileTypes: true,
				})) {
					const id = `${entry.name}/${child.name}`;
					if (
						child.isDirectory() &&
						clusteringRunIdSchema.safeParse(id).success
					)
						result.push(id);
				}
			}
			return result;
		} catch (error) {
			if (isMissing(error)) return [];
			logger.warn({ err: error }, "Unable to list clustering results");
			throw new ValidationError("解析結果の一覧を読み込めません。");
		}
	}

	private async readSummary(id: string) {
		clusteringRunIdSchema.parse(id);
		const filename = await this.safeFile(`${id}/summary.json`);
		const data = summaryFileSchema.parse(
			JSON.parse(await readFile(filename, "utf8")),
		);
		const info = await stat(filename);
		const summary: ClusteringRunSummary = {
			id,
			name: id,
			completedAt: info.mtime.toISOString(),
			implementation: data.implementation,
			points: data.points,
			clusters: data.clusters,
			clustered: data.clustered,
			noise: data.noise,
			cohortId: data.graphSnapshot.checksums["media.jsonl"],
			soloOnly: data.graphSnapshot.soloOnly,
			parameters: data.parameters,
		};
		return { summary, stamp: `${info.mtimeMs}:${info.size}` };
	}

	async listRuns(): Promise<ClusteringRunSummary[]> {
		const runs: ClusteringRunSummary[] = [];
		for (const id of await this.directories()) {
			try {
				const { summary } = await this.readSummary(id);
				await this.safeFile(`${id}/assignments.jsonl`);
				runs.push(summary);
			} catch (error) {
				if (!isMissing(error))
					logger.warn(
						{ err: error, runId: id },
						"Skipping unreadable clustering result",
					);
			}
		}
		return runs.sort(
			(a, b) =>
				b.completedAt.localeCompare(a.completedAt) || a.id.localeCompare(b.id),
		);
	}

	private async findMetadata(cohortId: string): Promise<string> {
		for (const id of await this.directories()) {
			try {
				const filename = await this.safeFile(`${id}/graph.json`);
				const graph = z
					.object({
						status: z.literal("complete"),
						checksums: z.object({ "media.jsonl": z.string() }),
					})
					.safeParse(JSON.parse(await readFile(filename, "utf8")));
				if (graph.success && graph.data.checksums["media.jsonl"] === cohortId)
					return await this.safeFile(`${id}/media.jsonl`);
			} catch (error) {
				if (!isMissing(error))
					logger.warn(
						{ err: error, snapshot: id },
						"Skipping unreadable clustering snapshot",
					);
			}
		}
		throw new ResourceNotFoundError("解析に使った画像一覧");
	}

	async loadRun(id: string): Promise<StoredClusteringRun> {
		try {
			return await this.loadCheckedRun(id);
		} catch (error) {
			if (error instanceof DomainError) throw error;
			logger.warn(
				{ err: error, runId: id },
				"Unable to load clustering result",
			);
			if (isMissing(error)) throw new ResourceNotFoundError("解析結果");
			throw new ValidationError("解析結果の形式または内容を確認してください。");
		}
	}

	private async loadCheckedRun(id: string): Promise<StoredClusteringRun> {
		const { summary, stamp: summaryStamp } = await this.readSummary(id);
		const assignmentsPath = await this.safeFile(`${id}/assignments.jsonl`);
		const metadataPath = await this.findMetadata(summary.cohortId);
		const [assignmentsInfo, metadataInfo] = await Promise.all([
			stat(assignmentsPath),
			stat(metadataPath),
		]);
		const stamp = `${summaryStamp}:${assignmentsInfo.mtimeMs}:${assignmentsInfo.size}:${metadataInfo.mtimeMs}:${metadataInfo.size}`;
		const cached = this.cache.get(id);
		if (cached?.stamp === stamp) {
			this.cache.delete(id);
			this.cache.set(id, cached);
			return cached.promise;
		}
		const loading = this.readRun(
			summary,
			assignmentsPath,
			metadataPath,
			`${metadataInfo.mtimeMs}:${metadataInfo.size}`,
		);
		this.cache.set(id, { stamp, promise: loading });
		while (this.cache.size > 3) {
			const oldest = this.cache.keys().next().value;
			if (oldest !== undefined) this.cache.delete(oldest);
		}
		try {
			return await loading;
		} catch (error) {
			if (this.cache.get(id)?.promise === loading) this.cache.delete(id);
			throw error;
		}
	}

	private async readRun(
		summary: ClusteringRunSummary,
		assignmentsPath: string,
		metadataPath: string,
		stamp: string,
	): Promise<StoredClusteringRun> {
		let cached = this.metadata.get(metadataPath);
		if (
			!cached ||
			cached.stamp !== stamp ||
			cached.cohortId !== summary.cohortId
		) {
			const bytes = await readFile(metadataPath);
			if (createHash("sha256").update(bytes).digest("hex") !== summary.cohortId)
				throw new ValidationError(
					"解析に使った画像一覧の内容が変わっています。",
				);
			const records = new Map<string, ClusteringSnapshotMedia>();
			for (const line of bytes.toString("utf8").trim().split("\n")) {
				const record = clusteringSnapshotMediaSchema.parse(JSON.parse(line));
				if (records.has(record.embedding_id))
					throw new ValidationError("画像一覧に重複があります。");
				records.set(record.embedding_id, record);
			}
			cached = { stamp, cohortId: summary.cohortId, records };
			this.metadata.set(metadataPath, cached);
			while (this.metadata.size > 2) {
				const oldest = this.metadata.keys().next().value;
				if (oldest !== undefined) this.metadata.delete(oldest);
			}
		}
		const media = [];
		const seen = new Set<string>();
		const groups = new Set<number>();
		let noise = 0;
		for (const line of (await readFile(assignmentsPath, "utf8"))
			.trim()
			.split("\n")) {
			const assignment = clusteringAssignmentSchema.parse(JSON.parse(line));
			const record = cached.records.get(assignment.embeddingId);
			if (
				!record ||
				record.media_id !== assignment.mediaId ||
				record.extracted_at !== assignment.extractedAt ||
				seen.has(assignment.mediaId)
			)
				throw new ValidationError("画像一覧とクラスタの結果が一致しません。");
			seen.add(assignment.mediaId);
			if (assignment.clusterId < 0) noise++;
			else groups.add(assignment.clusterId);
			media.push({ record, assignment });
		}
		if (
			media.length !== summary.points ||
			noise !== summary.noise ||
			groups.size !== summary.clusters
		)
			throw new ValidationError("解析結果がまだ保存中か、件数が一致しません。");
		return { summary, media };
	}
}

export const characterClusteringReviewService =
	new CharacterClusteringReviewService(
		new FileCharacterClusteringResultsStore(),
	);
