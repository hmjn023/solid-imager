import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import {
	beforeAll,
	beforeEach,
	afterAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { ProcessingManagementService } from "@solid-imager/application/services/processing-management-service";
import { ResourceConflictError } from "@solid-imager/core/domain/errors";
import {
	processingListRequestSchema,
	safeMediaProcessingSchema,
	serializeMediaProcessingInput,
	type MediaTaskKind,
	type MediaProcessingInput,
} from "@solid-imager/core/domain/processing/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import { createProcessingManagementRepository } from "@solid-imager/db/repositories/processing-management-repository";
import { createMediaProcessingStateRepository } from "@solid-imager/db/repositories/media-processing-state-repository";
import { createMediaRepository } from "@solid-imager/db/repositories/media-repository";
import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import { createTransactionManager } from "@solid-imager/db/transaction-manager";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import * as schema from "@solid-imager/db/schema";
import { createPglite } from "~/infrastructure/db/pglite";

describe("processing management", () => {
	let directory: string;
	let local: ReturnType<typeof createPglite> | undefined;
	let postgres: Pool | undefined;
	let database: DrizzleExecutor;
	const executor = (tx?: Transaction) => (tx ?? database) as DrizzleExecutor;
	const mediaRepo = createMediaRepository(executor);
	const sources = createSourceRepository(executor);
	const states = createMediaProcessingStateRepository(executor);
	const targets = createProcessingManagementRepository(executor);
	const transactions = createTransactionManager(executor);
	const notify = vi.fn();
	let service: ProcessingManagementService;
	let sourceId: string;
	let version: string;
	const revision = (input: MediaProcessingInput, kind: MediaTaskKind) =>
		`${kind}:${version}:${serializeMediaProcessingInput(input)}`;
	const request =
		vi.fn<
			(
				sourceId: string,
				mediaId: string,
				kind: MediaTaskKind,
				tx: Transaction,
			) => Promise<void>
		>();
	beforeAll(async () => {
		const port = process.env.PROCESSING_MANAGEMENT_TEST_POSTGRES_PORT;
		if (port) {
			if (!/^\d+$/.test(port) || Number(port) <= 1024 || Number(port) > 65535)
				throw new Error("Invalid isolated PostgreSQL port");
			postgres = new Pool({
				host: "127.0.0.1",
				port: Number(port),
				user: "processing_test",
				password: "ephemeral_processing_test",
				database: "processing_management_test",
				max: 8,
			});
			const pg = drizzlePostgres(postgres, { schema });
			await migratePostgres(pg, { migrationsFolder: path.resolve("drizzle") });
			database = pg;
		} else {
			directory = await mkdtemp(path.join(tmpdir(), "processing-management-"));
			local = createPglite(directory);
			const pglite = drizzle(local, { schema });
			await migrate(pglite, { migrationsFolder: path.resolve("drizzle") });
			database = pglite;
		}
	}, 30_000);
	afterAll(async () => {
		await local?.close();
		await postgres?.end();
		if (directory) await rm(directory, { recursive: true, force: true });
	});
	beforeEach(async () => {
		vi.restoreAllMocks();
		notify.mockReset();
		version = "v1";
		await database.delete(schema.mediaSources);
		sourceId = (
			await sources.create({
				name: "Local",
				description: null,
				type: "local",
				connectionInfo: { path: "/private-source" },
			})
		).id;
		request
			.mockReset()
			.mockImplementation(
				async (
					_sourceId: string,
					mediaId: string,
					kind: MediaTaskKind,
					tx: Transaction,
				) => {
					const target = await targets.findByMediaId(mediaId, tx);
					if (!target) throw new Error("Missing target");
					await states.request(
						{
							input: target.input,
							taskKind: kind,
							revision: revision(target.input, kind),
							maxAttempts: 5,
							force: true,
						},
						tx,
					);
				},
			);
		service = new ProcessingManagementService({
			targets,
			states,
			mediaRepo,
			transactions,
			revision,
			request,
			notify,
		});
	});
	async function media(
		name = "image.png",
		type: "image" | "audio" | "video" = "image",
		sid = sourceId,
	) {
		return mediaRepo.create({
			mediaSourceId: sid,
			filePath: name,
			fileName: name,
			mediaType: type,
			width: 10,
			height: 10,
			fileSize: 128,
			description: null,
			createdAt: new Date("2026-01-01T00:00:00Z"),
			modifiedAt: new Date("2026-01-01T00:00:00Z"),
		});
	}
	async function reserve(mediaId: string, kind: MediaTaskKind) {
		const target = await targets.findByMediaId(mediaId);
		if (!target) throw new Error("Missing target");
		return transactions.transaction((tx) =>
			states.request(
				{
					input: target.input,
					taskKind: kind,
					revision: revision(target.input, kind),
					maxAttempts: 5,
					force: false,
				},
				tx,
			),
		);
	}
	async function finish(
		kind: MediaTaskKind,
		error?: string,
		retryable = false,
	) {
		const work = await transactions.transaction((tx) =>
			states.claimDue([kind], tx),
		);
		if (!work) throw new Error("Missing queued task");
		if (error)
			await transactions.transaction((tx) =>
				states.settleFailure(work.claim, error, retryable, tx),
			);
		else
			await transactions.transaction((tx) =>
				states.commit(work.input, work.claim, async () => {}, tx),
			);
	}
	const list = (extra = {}) =>
		service.list(processingListRequestSchema.parse(extra));
	it("lists unrequested media independently of generic jobs and skips inapplicable tasks", async () => {
		const image = await media();
		const audio = await media("audio.mp3", "audio");
		const result = await list();
		expect(result.total).toBe(2);
		expect(
			result.items
				.find((row) => row.mediaId === image.id)
				?.steps.every((step) => step.status === "not_requested"),
		).toBe(true);
		expect(
			(await service.get(audio.id)).steps
				.filter((step) => step.status === "skipped")
				.map((step) => step.kind),
		).toEqual(["metadata", "thumbnail", "tagging", "ccip"]);
		expect(await database.select().from(schema.jobs)).toHaveLength(0);
	});
	it.each(["audio", "video"] as const)(
		"hides legacy %s metadata failures and rejects their Retry",
		async (type) => {
			const target = await media("legacy.flac", type);
			const queued = await reserve(target.id, "metadata");
			await finish("metadata", "unsupported format");
			expect(
				(await service.get(target.id)).steps.find(
					(step) => step.kind === "metadata",
				),
			).toMatchObject({
				status: "skipped",
				canRetry: false,
				failureCode: null,
			});
			expect((await list({ status: "failed" })).total).toBe(0);
			await expect(
				service.retry({
					mediaId: target.id,
					kind: "metadata",
					requestId: queued.requestId,
				}),
			).rejects.toThrow(ResourceConflictError);
			expect(request).not.toHaveBeenCalled();
		},
	);
	it("filters and paginates on the server without treating filename wildcards as patterns", async () => {
		const first = await media("sample_a.png");
		await media("sampleXb.png");
		await media("third.png");
		await reserve(first.id, "thumbnail");
		await finish("thumbnail", "failed");
		expect(
			(await list({ query: "sample_" })).items.map((row) => row.mediaId),
		).toEqual([first.id]);
		expect((await list({ status: "failed" })).total).toBe(1);
		const page = await list({ limit: 1 });
		const next = await list({ limit: 1, offset: 1 });
		expect(page.total).toBe(3);
		expect(next.items[0].mediaId).not.toBe(page.items[0].mediaId);
	});
	it("excludes remote and inactive media", async () => {
		const remote = await sources.create({
			name: "Remote",
			description: null,
			type: "local",
			connectionInfo: { path: "/other" },
		});
		const deleted = await media("inactive.png");
		await database
			.update(schema.medias)
			.set({ status: "deleted" })
			.where(eq(schema.medias.id, deleted.id));
		await media("remote.png", "image", remote.id);
		await database
			.update(schema.mediaSources)
			.set({ type: "s3" })
			.where(eq(schema.mediaSources.id, remote.id));
		expect((await list()).total).toBe(0);
		await expect(service.get(deleted.id)).rejects.toThrow("not found");
	});
	it("exposes safe failure classification and backoff without internal data", async () => {
		const image = await media();
		await reserve(image.id, "thumbnail");
		await finish("thumbnail", "ENOENT: /private-source/password=secret.png");
		await reserve(image.id, "tagging");
		await finish(
			"tagging",
			"ECONNREFUSED https://private.example/?token=secret",
			true,
		);
		const result = safeMediaProcessingSchema.parse(await service.get(image.id));
		expect(
			result.steps.find((step) => step.kind === "thumbnail"),
		).toMatchObject({
			status: "failed",
			failureCode: "file_missing",
			canRetry: true,
			attemptCount: 1,
			maxAttempts: 5,
			availableAt: null,
		});
		expect(result.steps.find((step) => step.kind === "tagging")).toMatchObject({
			status: "pending",
			failureCode: "service_unavailable",
			canRetry: false,
			availableAt: expect.any(Date),
		});
		expect(JSON.stringify(result)).not.toMatch(
			/private-source|secret|requestedRevision|claimToken|lastError|scheduledInput/,
		);
	});
	it("marks previous results as outdated after input or settings changes", async () => {
		const image = await media();
		await reserve(image.id, "metadata");
		await finish("metadata");
		expect((await service.get(image.id)).steps[0]).toMatchObject({
			status: "completed",
			isCurrent: true,
		});
		version = "v2";
		expect((await service.get(image.id)).steps[0]).toMatchObject({
			status: "completed",
			isCurrent: false,
			canRetry: false,
		});
	});
	it("requests an unrequested step with a null identity and fences a repeated click", async () => {
		const image = await media();
		expect((await service.get(image.id)).steps[0]).toMatchObject({
			status: "not_requested",
			canRequest: true,
		});
		const input = {
			mediaId: image.id,
			kind: "metadata" as const,
			requestId: null,
		};
		expect((await service.request(input)).steps[0]).toMatchObject({
			status: "pending",
			canRequest: false,
		});
		const queued = await states.findByMediaIds([image.id]);
		await expect(service.request(input)).rejects.toBeInstanceOf(
			ResourceConflictError,
		);
		expect(await states.findByMediaIds([image.id])).toEqual(queued);
		expect(request).toHaveBeenCalledOnce();
	});
	it("requeues outdated completed metadata without redoing another completed step", async () => {
		const image = await media();
		const original = await reserve(image.id, "metadata");
		await finish("metadata");
		await reserve(image.id, "thumbnail");
		await finish("thumbnail");
		const before = (await states.findByMediaIds([image.id])).find(
			(row) => row.taskKind === "thumbnail",
		);
		version = "v2";
		expect(
			(
				await service.request({
					mediaId: image.id,
					kind: "metadata",
					requestId: original.requestId,
				})
			).steps[0],
		).toMatchObject({ status: "pending", isCurrent: true });
		expect(
			(await states.findByMediaIds([image.id])).find(
				(row) => row.taskKind === "thumbnail",
			),
		).toEqual(before);
		const video = await media("movie.mp4", "video");
		await expect(
			service.request({ mediaId: video.id, kind: "metadata", requestId: null }),
		).rejects.toBeInstanceOf(ResourceConflictError);
	});
	it("retries one failed task while preserving success and backoff in other tasks", async () => {
		const image = await media();
		for (const kind of ["metadata", "thumbnail", "tagging", "ccip"] as const)
			await reserve(image.id, kind);
		await finish("metadata");
		await finish("thumbnail", "failed");
		await finish("tagging", "ECONNREFUSED", true);
		await finish("ccip");
		const before = await states.findByMediaIds([image.id]);
		const failed = before.find((row) => row.taskKind === "thumbnail");
		if (!failed) throw new Error("Missing failed task");
		const result = await service.retry({
			mediaId: image.id,
			kind: "thumbnail",
			requestId: failed.requestId,
		});
		expect(
			result.steps.find((step) => step.kind === "thumbnail"),
		).toMatchObject({ status: "pending", attemptCount: 0, canRetry: false });
		const after = await states.findByMediaIds([image.id]);
		for (const old of before.filter((row) => row.taskKind !== "thumbnail"))
			expect(after.find((row) => row.taskKind === old.taskKind)).toEqual(old);
		expect(
			after.find((row) => row.taskKind === "thumbnail")?.requestId,
		).not.toBe(failed.requestId);
		expect(notify).toHaveBeenCalledOnce();
		expect(await database.select().from(schema.jobs)).toHaveLength(0);
	});
	it("allows only one concurrent retry of the same failed request", async () => {
		const image = await media();
		const queued = await reserve(image.id, "thumbnail");
		await finish("thumbnail", "failed");
		const input = {
			mediaId: image.id,
			kind: "thumbnail" as const,
			requestId: queued.requestId,
		};
		const results = await Promise.allSettled([
			service.retry(input),
			service.retry(input),
		]);
		expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
		const rejected = results.find((row) => row.status === "rejected");
		expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(
			ResourceConflictError,
		);
		expect(request).toHaveBeenCalledOnce();
	});
	it("rejects stale request IDs and never resets a newer running request", async () => {
		const image = await media();
		const old = await reserve(image.id, "thumbnail");
		await finish("thumbnail", "failed");
		await service.retry({
			mediaId: image.id,
			kind: "thumbnail",
			requestId: old.requestId,
		});
		await transactions.transaction((tx) => states.claimDue(["thumbnail"], tx));
		const running = await states.findByMediaIds([image.id]);
		await expect(
			service.retry({
				mediaId: image.id,
				kind: "thumbnail",
				requestId: old.requestId,
			}),
		).rejects.toBeInstanceOf(ResourceConflictError);
		expect(await states.findByMediaIds([image.id])).toEqual(running);
	});
	it("uses current input when explicitly retrying an outdated failed task", async () => {
		const image = await media();
		const old = await reserve(image.id, "metadata");
		await finish("metadata", "failed");
		await mediaRepo.update(image.id, {
			filePath: "changed.png",
			modifiedAt: new Date("2026-02-01T00:00:00Z"),
		});
		expect((await service.get(image.id)).steps[0].isCurrent).toBe(false);
		const updated = await service.retry({
			mediaId: image.id,
			kind: "metadata",
			requestId: old.requestId,
		});
		expect(updated.steps[0]).toMatchObject({
			status: "pending",
			isCurrent: true,
		});
	});
	it("rolls back a failed reservation and emits no success notification", async () => {
		const image = await media();
		const old = await reserve(image.id, "metadata");
		await finish("metadata", "failed");
		request.mockRejectedValueOnce(new Error("request storage unavailable"));
		await expect(
			service.retry({
				mediaId: image.id,
				kind: "metadata",
				requestId: old.requestId,
			}),
		).rejects.toThrow("request storage unavailable");
		expect((await states.findByMediaIds([image.id]))[0]).toMatchObject({
			status: "failed",
			requestId: old.requestId,
		});
		expect(notify).not.toHaveBeenCalled();
	});
	it("does not fail a committed retry when event notification fails", async () => {
		const image = await media();
		const old = await reserve(image.id, "metadata");
		await finish("metadata", "failed");
		notify.mockImplementationOnce(() => {
			throw new Error("disconnected listener");
		});
		expect(
			(
				await service.retry({
					mediaId: image.id,
					kind: "metadata",
					requestId: old.requestId,
				})
			).steps[0].status,
		).toBe("pending");
	});
});
