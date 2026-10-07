import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	TaggingServiceImpl,
	type TaggingServiceDeps,
} from "@solid-imager/application/services/tagging-service";
import { getTaggingTaskRevision } from "@solid-imager/application/services/tagging-task-service";
import type { IAiClient } from "@solid-imager/core/domain/interfaces/ai-client";
import {
	MediaProcessingSupersededError,
	type TaggingProcessingSettings,
} from "@solid-imager/core/domain/processing/schemas";
import type { TaggingResponse } from "@solid-imager/core/domain/tagging/schemas";
import { createCharacterRepository } from "@solid-imager/db/repositories/character-repository";
import { createIpRepository } from "@solid-imager/db/repositories/ip-repository";
import { createJobRepository } from "@solid-imager/db/repositories/job-repository";
import { createMediaProcessingStateRepository } from "@solid-imager/db/repositories/media-processing-state-repository";
import { createMediaRepository } from "@solid-imager/db/repositories/media-repository";
import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import { createTagRepository } from "@solid-imager/db/repositories/tag-repository";
import * as schema from "@solid-imager/db/schema";
import { createTransactionManager } from "@solid-imager/db/transaction-manager";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createPglite } from "~/infrastructure/db/pglite";
import { scanTaggingTargetPage } from "~/infrastructure/jobs/tagging-targets";

const empty: TaggingResponse = {
	general: {},
	character: {},
	attributes: {},
	ips: [],
	ips_mapping: {},
};
const first: TaggingResponse = {
	general: { old: 0.9, shared: 0.8 },
	character: { Hero: 0.7 },
	attributes: { old: "general" },
	ips: ["Series"],
	ips_mapping: { Hero: ["Series"] },
};

describe("revision-aware tagging", () => {
	let directory: string;
	let client: ReturnType<typeof createPglite> | undefined;
	let postgres: Pool | undefined;
	let database: DrizzleExecutor;
	const executor = (tx?: unknown) => (tx ?? database) as DrizzleExecutor;
	const transactionManager = createTransactionManager(executor);
	const mediaRepo = createMediaRepository(executor);
	const sourceRepo = createSourceRepository(executor);
	const tagRepo = createTagRepository(executor);
	const characterRepo = createCharacterRepository(executor);
	const ipRepo = createIpRepository(executor);
	const jobRepo = createJobRepository(executor);
	const processingStateRepo = createMediaProcessingStateRepository(executor);
	const infer = vi.fn<IAiClient["tagImageByPath"]>();
	const publish = vi.fn<TaggingServiceDeps["publishSourceEvent"]>();
	let sourceId: string;
	let mediaId: string;
	let settings: TaggingProcessingSettings;
	let service: TaggingServiceImpl;
	function createService() {
		const aiClient: IAiClient = {
			getTaggingSettings: () => settings,
			getCcipSettings: () => ({
				...settings,
				model: "ccip-caformer-24-randaug-pruned",
				embeddingVersion: 1,
				dimensions: 768,
			}),
			healthCheck: vi.fn().mockResolvedValue(true),
			tagImage: () => infer("remote-buffer"),
			tagImageByPath: infer,
			tagImageOppaiOracleByPath: vi.fn(),
			extractCcipFeature: vi.fn(),
			extractCcipFeatureByPath: vi.fn(),
			calculateCcipDifference: vi.fn(),
			calculateCcipDistances: vi.fn(),
			getBaseUrl: () => settings.endpoint,
		};
		return new TaggingServiceImpl({
			aiClient,
			mediaRepo,
			sourceRepo,
			tagRepo,
			characterRepo,
			ipRepo,
			jobRepo,
			transactionManager,
			processingStateRepo,
			readFileBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
			publishSourceEvent: publish,
		});
	}
	const run = (
		options?: Parameters<TaggingServiceImpl["getTagsForMedia"]>[2],
	) => service.getTagsForMedia(sourceId, mediaId, options);
	const states = () => processingStateRepo.findByMediaIds([mediaId]);
	function delayedInference() {
		const started = Promise.withResolvers<void>();
		const response = Promise.withResolvers<TaggingResponse>();
		infer.mockImplementationOnce(() => {
			started.resolve();
			return response.promise;
		});
		const pending = run().then(
			(value) => ({ value }),
			(error: unknown) => ({ error }),
		);
		return {
			pending,
			started: started.promise,
			resolve: response.resolve,
			reject: response.reject,
		};
	}
	beforeAll(async () => {
		// Only an explicitly allocated local test container may opt into this path.
		const port = process.env.TAGGING_TEST_POSTGRES_PORT;
		if (port) {
			if (!/^\d+$/.test(port) || Number(port) <= 1024 || Number(port) > 65535)
				throw new Error("Invalid isolated PostgreSQL port");
			postgres = new Pool({
				host: "127.0.0.1",
				port: Number(port),
				user: "tagging_test",
				password: "ephemeral_tagging_test",
				database: "tagging_processing_test",
				max: 12,
			});
			const pgDatabase = drizzlePostgres(postgres, { schema });
			await migratePostgres(pgDatabase, {
				migrationsFolder: path.resolve("drizzle"),
			});
			database = pgDatabase;
			return;
		}
		directory = await mkdtemp(path.join(tmpdir(), "tagging-processing-"));
		client = createPglite(directory);
		database = drizzle(client, { schema });
		await migrate(database, { migrationsFolder: path.resolve("drizzle") });
	}, 30_000);
	afterAll(async () => {
		await client?.close();
		await postgres?.end();
		if (directory) await rm(directory, { recursive: true, force: true });
	});
	beforeEach(async () => {
		vi.restoreAllMocks();
		await database.delete(schema.jobs);
		await database.delete(schema.mediaSources);
		await database.delete(schema.characters);
		await database.delete(schema.ips);
		await database.delete(schema.tags);
		settings = {
			model: "pixai",
			modelVersion: "v0.9",
			runtimeVersion: "test-v1",
			provider: "cpu",
			device: null,
			endpoint: "",
		};
		infer.mockReset().mockResolvedValue(first);
		publish.mockReset();
		sourceId = (
			await sourceRepo.create({
				name: "Tagging fixture",
				description: null,
				type: "local",
				connectionInfo: { path: "/fixture" },
			})
		).id;
		mediaId = (
			await mediaRepo.create({
				mediaSourceId: sourceId,
				fileName: "image.png",
				filePath: "image.png",
				fileSize: 123,
				mediaType: "image",
				width: 100,
				height: 100,
				description: null,
				modifiedAt: new Date("2026-01-01T00:00:00Z"),
				createdAt: new Date("2026-01-01T00:00:00Z"),
			})
		).id;
		service = createService();
	});
	it("persists exact successful responses and reuses them after service recreation", async () => {
		expect(await run()).toEqual(first);
		service = createService();
		expect(await run()).toEqual(first);
		expect(infer).toHaveBeenCalledTimes(1);
		expect(publish).toHaveBeenCalledTimes(1);
		expect(await states()).toEqual([
			expect.objectContaining({
				taskKind: "tagging",
				status: "completed",
				attemptCount: 1,
			}),
		]);
	});
	it("reuses empty inference results, without relying on existing AI tags", async () => {
		infer.mockResolvedValue(empty);
		await run();
		await run();
		expect(infer).toHaveBeenCalledTimes(1);
	});

	it("uses revision-aware batch targets for legacy, empty, forced and changed-model results", async () => {
		const scan = (force = false) =>
			scanTaggingTargetPage(
				{ mediaSourceId: sourceId, force, limit: 10 },
				database,
				settings,
			);
		await tagRepo.addTagsToMedia(
			mediaId,
			[{ name: "legacy", type: "positive" }],
			"AI",
		);
		expect((await scan()).targets).toHaveLength(1);
		infer.mockResolvedValue(empty);
		await run();
		expect((await scan()).targets).toEqual([]);
		expect((await scan(true)).targets).toHaveLength(1);
		settings = { ...settings, modelVersion: "v-next" };
		expect((await scan()).targets).toHaveLength(1);
	});

	it("continues a batch past cached-only pages and excludes already dispatched children", async () => {
		await run();
		const second = await mediaRepo.create({
			mediaSourceId: sourceId,
			fileName: "second.png",
			filePath: "second.png",
			fileSize: 123,
			mediaType: "image",
			width: 100,
			height: 100,
			description: null,
		});
		const firstPage = await scanTaggingTargetPage(
			{ force: false, limit: 1 },
			database,
			settings,
		);
		expect(firstPage.targets).toEqual([]);
		expect(firstPage.nextCursor).toBe(mediaId);
		const nextPage = await scanTaggingTargetPage(
			{ force: false, limit: 1, afterId: firstPage.nextCursor },
			database,
			settings,
		);
		expect(nextPage.targets.map((target) => target.id)).toEqual([second.id]);
		const parent = await jobRepo.create({
			type: "bulk_tagging_parent",
			status: "in_progress",
			mediaSourceId: sourceId,
			payload: {},
		});
		await jobRepo.create({
			type: "auto_tagging",
			parentId: parent.id,
			mediaSourceId: sourceId,
			payload: { mediaId: second.id },
		});
		expect(
			(
				await scanTaggingTargetPage(
					{ force: false, limit: 10, parentId: parent.id },
					database,
					settings,
				)
			).targets,
		).toEqual([]);
	});
	it("replaces old AI relations and retains manual associations and confidence", async () => {
		await tagRepo.addTagsToMedia(
			mediaId,
			[{ name: "shared", type: "positive", confidence: 1 }],
			"manual",
		);
		const series = await ipRepo.create({ name: "Series" });
		const hero = await characterRepo.create({
			name: "Hero",
			ipIds: [series.id],
		});
		await ipRepo.addMedia(mediaId, series.id, 1, "manual");
		await characterRepo.addToMedia(mediaId, hero.id, 1, "manual");
		await run();
		infer.mockResolvedValue(empty);
		await run({ skipCache: true });
		expect(await tagRepo.findByMediaId(mediaId)).toEqual([
			expect.objectContaining({
				name: "shared",
				source: "manual",
				confidence: 1,
			}),
		]);
		expect(await characterRepo.getMediaCharacters(mediaId)).toEqual([
			expect.objectContaining({
				id: hero.id,
				associationSource: "manual",
				confidence: 1,
			}),
		]);
		expect(await ipRepo.getMediaIps(mediaId)).toEqual([
			expect.objectContaining({
				id: series.id,
				associationSource: "manual",
				confidence: 1,
			}),
		]);
		expect((await characterRepo.findById(hero.id))?.ips).toEqual([
			expect.objectContaining({ id: series.id }),
		]);
	});
	it("joins concurrent requests into one inference and forces a later new request", async () => {
		const waiting = Promise.withResolvers<void>();
		const claim = processingStateRepo.claim.bind(processingStateRepo);
		vi.spyOn(processingStateRepo, "claim").mockImplementation(
			async (...args) => {
				const result = await claim(...args);
				if (result.status === "busy") waiting.resolve();
				return result;
			},
		);
		const delayed = delayedInference();
		await delayed.started;
		const other = run({ skipCache: true });
		await waiting.promise;
		delayed.resolve(first);
		await delayed.pending;
		expect(await other).toEqual(first);
		expect(infer).toHaveBeenCalledTimes(1);
		await run({ skipCache: true });
		expect(infer).toHaveBeenCalledTimes(2);
	});
	it.each(["modelVersion", "runtimeVersion", "provider", "device"] as const)(
		"rejects stale results and failures after %s changes",
		async (field) => {
			const delayed = delayedInference();
			await delayed.started;
			settings = { ...settings, [field]: "changed" };
			infer.mockResolvedValue({ ...empty, general: { newer: 0.99 } });
			await run();
			delayed.resolve(first);
			expect(await delayed.pending).toEqual({
				error: expect.any(MediaProcessingSupersededError),
			});
			expect(await tagRepo.findByMediaId(mediaId)).toEqual([
				expect.objectContaining({ name: "newer" }),
			]);
			expect(await states()).toEqual([
				expect.objectContaining({ status: "completed", lastError: null }),
			]);
		},
	);
	it("rejects an old result after the media input changes", async () => {
		const delayed = delayedInference();
		await delayed.started;
		await database
			.update(schema.medias)
			.set({ modifiedAt: new Date("2026-01-02T00:00:00Z"), fileSize: 456 })
			.where(eq(schema.medias.id, mediaId));
		infer.mockResolvedValue(empty);
		await run();
		delayed.resolve(first);
		expect(await delayed.pending).toEqual({
			error: expect.any(MediaProcessingSupersededError),
		});
		expect(await tagRepo.findByMediaId(mediaId)).toEqual([]);
	});
	it("rejects an expired claim's result after another request takes the lease", async () => {
		const delayed = delayedInference();
		await delayed.started;
		await database
			.update(schema.mediaProcessingStates)
			.set({ heartbeatAt: new Date(Date.now() - 121_000) })
			.where(eq(schema.mediaProcessingStates.mediaId, mediaId));
		infer.mockResolvedValue(empty);
		await run();
		delayed.resolve(first);
		expect(await delayed.pending).toEqual({
			error: expect.any(MediaProcessingSupersededError),
		});
		expect(await states()).toEqual([
			expect.objectContaining({
				status: "completed",
				attemptCount: 2,
				lastError: null,
			}),
		]);
		expect(await tagRepo.findByMediaId(mediaId)).toEqual([]);
	});
	it("keeps a newer completed result when an old inference fails late", async () => {
		const delayed = delayedInference();
		await delayed.started;
		settings = { ...settings, modelVersion: "v-next" };
		infer.mockResolvedValue(empty);
		await run();
		delayed.reject(new Error("old inference failed"));
		expect(await delayed.pending).toEqual({
			error: expect.objectContaining({ message: "old inference failed" }),
		});
		expect(await states()).toEqual([
			expect.objectContaining({ status: "completed", lastError: null }),
		]);
	});
	it("rolls back all output when a relation write fails and retries tagging only", async () => {
		const before = await states();
		vi.spyOn(characterRepo, "addToMediaBulk").mockRejectedValueOnce(
			new Error("relation write failed"),
		);
		await expect(run()).rejects.toThrow("relation write failed");
		expect(await tagRepo.findByMediaId(mediaId)).toEqual([]);
		expect(await database.select().from(schema.ips)).toEqual([]);
		expect(await states()).toEqual([
			expect.objectContaining({
				taskKind: "tagging",
				status: "failed",
				lastError: "relation write failed",
			}),
		]);
		await run();
		expect(before).toEqual([]);
		expect(await states()).toEqual([
			expect.objectContaining({
				taskKind: "tagging",
				status: "completed",
				attemptCount: 2,
			}),
		]);
	});
	it("records inference failure and can retry without touching metadata or thumbnails", async () => {
		infer.mockRejectedValueOnce(new Error("AI unavailable"));
		await expect(run()).rejects.toThrow("AI unavailable");
		expect(await states()).toEqual([
			expect.objectContaining({
				taskKind: "tagging",
				status: "failed",
				attemptCount: 1,
			}),
		]);
		await run();
		expect(infer).toHaveBeenCalledTimes(2);
		expect((await states()).map((state) => state.taskKind)).toEqual([
			"tagging",
		]);
	});
	it("repairs missing cached output and does not trust legacy AI associations", async () => {
		await tagRepo.addTagsToMedia(
			mediaId,
			[{ name: "legacy", type: "positive" }],
			"AI",
		);
		await run();
		await database
			.update(schema.mediaProcessingStates)
			.set({ taggingResult: null })
			.where(eq(schema.mediaProcessingStates.mediaId, mediaId));
		await run();
		expect(infer).toHaveBeenCalledTimes(2);
		expect(
			(await tagRepo.findByMediaId(mediaId)).map((tag) => tag.name),
		).not.toContain("legacy");
	});
	it("does not reuse a remote provider's unknown model between separate requests", async () => {
		settings = {
			...settings,
			endpoint: "https://ai.example",
			modelVersion: "unknown",
			runtimeVersion: "unknown",
		};
		await run();
		await run();
		expect(infer).toHaveBeenCalledTimes(2);
	});
	it("does not reuse results without a known runtime identity and retains inference failures", async () => {
		settings = { ...settings, runtimeVersion: "unknown" };
		infer.mockRejectedValueOnce(new Error("native runtime unavailable"));
		await expect(run()).rejects.toThrow("native runtime unavailable");
		expect(await states()).toEqual([
			expect.objectContaining({ status: "failed" }),
		]);
		await run();
		await run();
		expect(infer).toHaveBeenCalledTimes(3);
	});
	it("rejects a cancelled job's late output", async () => {
		const job = await jobRepo.create({
			type: "auto_tagging",
			mediaSourceId: sourceId,
			payload: { mediaId },
		});
		const [claimed] = await jobRepo.claimPending(1, {
			includeTypes: ["auto_tagging"],
		});
		const started = Promise.withResolvers<void>();
		const response = Promise.withResolvers<TaggingResponse>();
		infer.mockImplementationOnce(() => {
			started.resolve();
			return response.promise;
		});
		const pending = run({
			owner: { jobId: job.id, attemptCount: claimed.attemptCount ?? 0 },
		}).catch((error: unknown) => error);
		await started.promise;
		await jobRepo.requestCancellation(job.id);
		response.resolve(first);
		expect(await pending).toBeInstanceOf(Error);
		expect(await tagRepo.findByMediaId(mediaId)).toEqual([]);
		expect(await states()).toEqual([
			expect.objectContaining({ status: "failed" }),
		]);
	});
	it("cascades domain state and rejects late output after target deletion", async () => {
		const delayed = delayedInference();
		await delayed.started;
		await database.delete(schema.medias).where(eq(schema.medias.id, mediaId));
		delayed.resolve(first);
		expect(await delayed.pending).toEqual({
			error: expect.any(MediaProcessingSupersededError),
		});
		expect(await states()).toEqual([]);
		expect(await database.select().from(schema.tags)).toEqual([]);
	});
	it("generates deterministic revisions and ignores object property insertion order", async () => {
		const media = await mediaRepo.findById(mediaId);
		if (!media) throw new Error("missing fixture");
		const input = {
			mediaId,
			mediaSourceId: sourceId,
			sourcePath: "/fixture",
			filePath: media.filePath,
			fileSize: media.fileSize,
			modifiedAt: media.modifiedAt,
			mediaType: media.mediaType,
		};
		expect(getTaggingTaskRevision(input, { ...settings })).toEqual(
			getTaggingTaskRevision(input, {
				endpoint: settings.endpoint,
				device: settings.device,
				provider: settings.provider,
				runtimeVersion: settings.runtimeVersion,
				modelVersion: settings.modelVersion,
				model: settings.model,
			}),
		);
	});
});
