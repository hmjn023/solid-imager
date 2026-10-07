import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	MediaProcessingScheduler,
	type ScheduledMediaTaskHandler,
} from "@solid-imager/application/services/media-processing-scheduler";
import {
	MediaProcessingScheduledError,
	MediaProcessingSupersededError,
	type MediaProcessingInput,
	type MediaTaskKind,
} from "@solid-imager/core/domain/processing/schemas";
import { createMediaProcessingStateRepository } from "@solid-imager/db/repositories/media-processing-state-repository";
import { createMediaRepository } from "@solid-imager/db/repositories/media-repository";
import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import { createTransactionManager } from "@solid-imager/db/transaction-manager";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import * as schema from "@solid-imager/db/schema";
import { and, eq, sql } from "drizzle-orm";
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

describe("dedicated media processing scheduler", () => {
	let directory: string | undefined;
	let client: ReturnType<typeof createPglite> | undefined;
	let postgres: Pool | undefined;
	let database: DrizzleExecutor;
	const executor = (tx?: unknown) => (tx ?? database) as DrizzleExecutor;
	const transactions = createTransactionManager(executor);
	const repo = createMediaProcessingStateRepository(executor);
	const mediaRepo = createMediaRepository(executor);
	const sources = createSourceRepository(executor);
	let input: MediaProcessingInput;
	const where = (kind: MediaTaskKind = "metadata") =>
		and(
			eq(schema.mediaProcessingStates.mediaId, input.mediaId),
			eq(schema.mediaProcessingStates.taskKind, kind),
		);
	const state = async (kind: MediaTaskKind = "metadata") =>
		(await repo.findByMediaIds([input.mediaId])).find(
			(row) => row.taskKind === kind,
		);
	const request = (
		revision = "v1",
		options: {
			kind?: MediaTaskKind;
			force?: boolean;
			maxAttempts?: number;
		} = {},
	) =>
		transactions.transaction((tx) =>
			repo.request(
				{
					input,
					revision,
					taskKind: options.kind ?? "metadata",
					maxAttempts: options.maxAttempts ?? 3,
					force: options.force ?? false,
				},
				tx,
			),
		);
	const claim = (kinds: MediaTaskKind[] = ["metadata"]) =>
		transactions.transaction((tx) => repo.claimDue(kinds, tx));
	async function claimed(kinds?: MediaTaskKind[]) {
		const work = await claim(kinds);
		if (!work) throw new Error("Fixture did not claim work");
		return work;
	}
	const due = () =>
		database
			.update(schema.mediaProcessingStates)
			.set({ availableAt: new Date(0) })
			.where(where());
	const expire = () =>
		database
			.update(schema.mediaProcessingStates)
			.set({ heartbeatAt: new Date(0) })
			.where(where());
	const recover = (limit = 25) =>
		transactions.transaction((tx) =>
			repo.recoverExpired(["metadata"], limit, tx),
		);
	const fail = (work: Awaited<ReturnType<typeof claimed>>, retryable = true) =>
		transactions.transaction((tx) =>
			repo.settleFailure(work.claim, "AI unavailable", retryable, tx),
		);
	const complete = (
		work: Awaited<ReturnType<typeof claimed>>,
		description = "published",
	) =>
		transactions.transaction((tx) =>
			repo.commit(
				work.input,
				work.claim,
				async (outputTx) => {
					await executor(outputTx)
						.update(schema.medias)
						.set({ description })
						.where(eq(schema.medias.id, work.input.mediaId));
				},
				tx,
			),
		);
	const handler = (
		overrides: Partial<ScheduledMediaTaskHandler> = {},
	): ScheduledMediaTaskHandler => ({
		currentRevision: () => "v1",
		isRetryable: (error) =>
			error instanceof Error && error.message === "transient",
		prepare: async (work) => ({
			commit: async (tx) => {
				await executor(tx)
					.update(schema.medias)
					.set({ description: "scheduled output" })
					.where(eq(schema.medias.id, work.input.mediaId));
			},
		}),
		...overrides,
	});
	const scheduler = (metadata: ScheduledMediaTaskHandler = handler()) =>
		new MediaProcessingScheduler({
			processingStateRepo: repo,
			transactionManager: transactions,
			handlers: { metadata },
		});
	async function fixtureInput(
		filePath = "image.png",
	): Promise<MediaProcessingInput> {
		const media = await mediaRepo.create({
			mediaSourceId: input.mediaSourceId,
			filePath,
			fileName: filePath,
			mediaType: "image",
			fileSize: 100,
			width: 16,
			height: 16,
			description: null,
			createdAt: new Date("2026-01-01"),
			modifiedAt: new Date("2026-01-01"),
		});
		return { ...input, mediaId: media.id, filePath };
	}
	beforeAll(async () => {
		const port = process.env.PROCESSING_TEST_POSTGRES_PORT;
		if (port) {
			if (!/^\d+$/.test(port) || Number(port) <= 1024 || Number(port) > 65535)
				throw new Error("Invalid isolated PostgreSQL port");
			postgres = new Pool({
				host: "127.0.0.1",
				port: Number(port),
				user: "processing_test",
				password: "ephemeral_processing_test",
				database: "processing_scheduler_test",
				max: 8,
			});
			const pgDatabase = drizzlePostgres(postgres, { schema });
			await migratePostgres(pgDatabase, {
				migrationsFolder: path.resolve("drizzle"),
			});
			database = pgDatabase;
		} else {
			directory = await mkdtemp(path.join(tmpdir(), "processing-scheduler-"));
			client = createPglite(directory);
			const pgliteDatabase = drizzle(client, { schema });
			await migrate(pgliteDatabase, {
				migrationsFolder: path.resolve("drizzle"),
			});
			database = pgliteDatabase;
		}
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
		const source = await sources.create({
			name: "Scheduler fixture",
			description: null,
			type: "local",
			connectionInfo: { path: "/fixture" },
		});
		input = {
			mediaId: "00000000-0000-4000-8000-000000000001",
			mediaSourceId: source.id,
			sourcePath: "/fixture",
			filePath: "image.png",
			modifiedAt: new Date("2026-01-01"),
			fileSize: 100,
			mediaType: "image",
		};
		input = await fixtureInput();
	});
	it("persists separate requests for all four tasks without creating generic jobs", async () => {
		for (const kind of ["metadata", "thumbnail", "tagging", "ccip"] as const)
			await request("v1", { kind });
		expect(await repo.findByMediaIds([input.mediaId])).toHaveLength(4);
		expect(await database.select().from(schema.jobs)).toHaveLength(0);
		expect(await state()).toMatchObject({
			status: "pending",
			executionMode: "scheduled",
			attemptCount: 0,
			maxAttempts: 3,
			availableAt: expect.any(Date),
		});
	});
	it("coalesces simultaneous requests and claims one token", async () => {
		await Promise.all(Array.from({ length: 6 }, () => request()));
		const works = await Promise.all(Array.from({ length: 6 }, () => claim()));
		expect(works.filter(Boolean)).toHaveLength(1);
		expect((await state())?.attemptCount).toBe(1);
	});
	it("claims only registered tasks and ignores inline work", async () => {
		await transactions.transaction((tx) =>
			repo.claim(input, "metadata", "v1", null, false, tx),
		);
		await request("v1", { kind: "ccip" });
		expect(await claim()).toBeNull();
		expect((await claimed(["ccip"])).claim.taskKind).toBe("ccip");
	});
	it("waits until persisted available_at and uses DB time despite a skewed application clock", async () => {
		await request();
		await database
			.update(schema.mediaProcessingStates)
			.set({ availableAt: new Date("2099-01-01") })
			.where(where());
		// PGlite's embedded clock uses Date.now too; only a separate PostgreSQL backend isolates it.
		if (postgres)
			vi.spyOn(Date, "now").mockReturnValue(new Date("2100-01-01").getTime());
		expect(await claim()).toBeNull();
		await due();
		expect((await claimed()).state.claimedAt?.getUTCFullYear()).toBeLessThan(
			2099,
		);
	});
	it("persists exponential backoff with jitter and keeps duplicate/force requests from bypassing it", async () => {
		await request();
		for (let attempt = 1; attempt <= 2; attempt++) {
			const work = await claimed();
			const failed = await fail(work);
			if (!failed) throw new Error("settlement");
			const delay = failed.availableAt.getTime() - failed.updatedAt.getTime();
			expect(delay).toBeGreaterThanOrEqual(750 * 2 ** (attempt - 1) - 10);
			expect(delay).toBeLessThanOrEqual(1250 * 2 ** (attempt - 1));
			expect(await claim()).toBeNull();
			expect(await request()).toEqual(failed);
			expect(await request("v1", { force: true, maxAttempts: 20 })).toEqual(
				failed,
			);
			await due();
		}
	});
	it("stops at the retry cap and requires explicit retry or a new revision", async () => {
		await request("v1", { maxAttempts: 2 });
		await fail(await claimed());
		await due();
		await fail(await claimed());
		await due();
		expect(await state()).toMatchObject({
			status: "failed",
			attemptCount: 2,
			claimToken: null,
		});
		expect(await claim()).toBeNull();
		await request();
		expect((await state())?.status).toBe("failed");
		await request("v1", { force: true });
		expect((await state())?.attemptCount).toBe(0);
		await fail(await claimed(), false);
		await request("v2");
		expect(await state()).toMatchObject({
			status: "pending",
			attemptCount: 0,
			lastError: null,
		});
	});
	it("keeps successful work cached and resets only an explicit later force request", async () => {
		await request();
		await complete(await claimed());
		await request();
		expect(await claim()).toBeNull();
		await request("v1", { force: true });
		expect((await claimed()).state.attemptCount).toBe(1);
	});
	it("does not retry a permanent failure", async () => {
		await request();
		await fail(await claimed(), false);
		await due();
		expect(await claim()).toBeNull();
		expect((await state())?.attemptCount).toBe(1);
	});
	it("fences old success, failure and heartbeat after a new revision request", async () => {
		await request();
		const old = await claimed();
		const next = await request("v2");
		await expect(complete(old, "old output")).rejects.toBeInstanceOf(
			MediaProcessingSupersededError,
		);
		expect(await fail(old)).toBeNull();
		expect(await repo.heartbeat(old.claim)).toBe(false);
		expect(await state()).toEqual(next);
		expect((await mediaRepo.findById(input.mediaId))?.description).toBeNull();
		await complete(await claimed(), "new output");
		expect((await state())?.completedRevision).toBe("v2");
	});
	it("transfers authority and prevents the old inline path from taking it back", async () => {
		const old = await transactions.transaction((tx) =>
			repo.claim(input, "metadata", "v1", null, false, tx),
		);
		if (old.status !== "claimed") throw new Error("claim");
		await request();
		expect(await repo.heartbeat(old.claim)).toBe(false);
		expect(
			await transactions.transaction((tx) =>
				repo.fail(old.claim, "old failure", tx),
			),
		).toBe(false);
		await expect(
			transactions.transaction((tx) =>
				repo.claim(input, "metadata", "v2", null, true, tx),
			),
		).rejects.toBeInstanceOf(MediaProcessingScheduledError);
		await complete(await claimed());
	});
	it("rejects expired heartbeat/commit/failure before recovery and retries after recovery", async () => {
		await request();
		const old = await claimed();
		await expire();
		expect(await repo.heartbeat(old.claim)).toBe(false);
		await expect(complete(old)).rejects.toBeInstanceOf(
			MediaProcessingSupersededError,
		);
		expect(await fail(old)).toBeNull();
		expect(await recover()).toBe(1);
		expect(await state()).toMatchObject({
			status: "pending",
			attemptCount: 1,
			claimToken: null,
			lastError: "Processing lease expired",
		});
		expect(await claim()).toBeNull();
		await due();
		const next = await claimed();
		expect(next.claim.token).not.toBe(old.claim.token);
		expect(next.state.attemptCount).toBe(2);
		await complete(next);
		expect(await fail(old)).toBeNull();
	});
	it("caps crash recovery and does not recover healthy leases", async () => {
		await request("v1", { maxAttempts: 1 });
		await claimed();
		expect(await recover()).toBe(0);
		await expire();
		expect(await recover()).toBe(1);
		await due();
		expect(await state()).toMatchObject({ status: "failed", attemptCount: 1 });
		expect(await claim()).toBeNull();
	});
	it("does not revive an old requested input after indexed media changes", async () => {
		await request();
		await database
			.update(schema.medias)
			.set({ fileSize: 200 })
			.where(eq(schema.medias.id, input.mediaId));
		expect(await claim()).toBeNull();
		expect(await state()).toMatchObject({
			status: "failed",
			lastError: "Requested media input has changed",
		});
		input = { ...input, fileSize: 200 };
		await request("v2");
		expect((await claimed()).input.fileSize).toBe(200);
	});
	it("marks a malformed persisted snapshot terminal instead of blocking future polling", async () => {
		await request();
		await database
			.update(schema.mediaProcessingStates)
			.set({ scheduledInput: sql`'{}'::jsonb` })
			.where(where());
		expect(await claim()).toBeNull();
		expect((await state())?.status).toBe("failed");
	});
	it("rolls back domain output and preserves the claim if completion fails", async () => {
		await request();
		const work = await claimed();
		await expect(
			transactions.transaction((tx) =>
				repo.commit(
					work.input,
					work.claim,
					async (outputTx) => {
						await executor(outputTx)
							.update(schema.medias)
							.set({ description: "must rollback" })
							.where(eq(schema.medias.id, input.mediaId));
						throw new Error("save failed");
					},
					tx,
				),
			),
		).rejects.toThrow("save failed");
		expect((await mediaRepo.findById(input.mediaId))?.description).toBeNull();
		expect((await state())?.claimToken).toBe(work.claim.token);
	});
	it("rejects a completion that loses its lease during the output transaction", async () => {
		await request();
		const work = await claimed();
		await expect(
			transactions.transaction((tx) =>
				repo.commit(
					work.input,
					work.claim,
					async (outputTx) => {
						await executor(outputTx)
							.update(schema.medias)
							.set({ description: "must rollback" })
							.where(eq(schema.medias.id, input.mediaId));
						await executor(outputTx)
							.update(schema.mediaProcessingStates)
							.set({ heartbeatAt: new Date(0) })
							.where(where());
					},
					tx,
				),
			),
		).rejects.toBeInstanceOf(MediaProcessingSupersededError);
		expect((await mediaRepo.findById(input.mediaId))?.description).toBeNull();
	});
	it("restores durable pending work into a new scheduler instance and commits without a job", async () => {
		await request();
		expect(await scheduler().runOnce()).toBe("completed");
		expect((await mediaRepo.findById(input.mediaId))?.description).toBe(
			"scheduled output",
		);
		expect(await scheduler().runOnce()).toBe("idle");
		expect(await database.select().from(schema.jobs)).toHaveLength(0);
	});
	it("retries classified transient errors but stops unknown errors", async () => {
		await request();
		expect(
			await scheduler(
				handler({
					prepare: async () => {
						throw new Error("transient");
					},
				}),
			).runOnce(),
		).toBe("retry");
		await due();
		expect(
			await scheduler(
				handler({
					prepare: async () => {
						throw new Error("invalid input");
					},
				}),
			).runOnce(),
		).toBe("failed");
		expect(await scheduler().runOnce()).toBe("idle");
	});
	it("cleans staged output after a superseding request and never publishes it", async () => {
		await request();
		const cleanup = vi.fn(async () => {});
		const commit = vi.fn(async () => {});
		const old = scheduler(
			handler({
				prepare: async () => {
					await request("v2");
					return { commit, cleanup };
				},
			}),
		);
		expect(await old.runOnce()).toBe("superseded");
		expect(cleanup).toHaveBeenCalledOnce();
		expect(commit).not.toHaveBeenCalled();
		expect(await state()).toMatchObject({
			status: "pending",
			requestedRevision: "v2",
			attemptCount: 0,
		});
	});
	it("rejects a changed runtime/config revision and keeps the old output unpublished", async () => {
		await request();
		let revision = "v1";
		const commit = vi.fn(async () => {});
		expect(
			await scheduler(
				handler({
					currentRevision: () => revision,
					prepare: async () => {
						revision = "v2";
						return { commit };
					},
				}),
			).runOnce(),
		).toBe("failed");
		expect(commit).not.toHaveBeenCalled();
	});
	it("does not retry committed output when its notification or cleanup fails", async () => {
		await request();
		expect(
			await scheduler(
				handler({
					prepare: async () => ({
						commit: async () => {},
						cleanup: async () => {
							throw new Error("cleanup");
						},
						afterCommit: async () => {
							throw new Error("event");
						},
					}),
				}),
			).runOnce(),
		).toBe("completed");
		expect((await state())?.status).toBe("completed");
	});
	it("cascades deleted media and rejects an in-flight output", async () => {
		await request();
		const old = await claimed();
		await mediaRepo.delete(input.mediaId);
		await expect(complete(old)).rejects.toBeInstanceOf(
			MediaProcessingSupersededError,
		);
		expect(await state()).toBeUndefined();
		expect(await recover()).toBe(0);
	});
	it("enforces retry bounds and scheduled claim ownership in the database", async () => {
		await request();
		await expect(
			database
				.update(schema.mediaProcessingStates)
				.set({ maxAttempts: 0 })
				.where(where()),
		).rejects.toThrow();
		await expect(
			database
				.update(schema.mediaProcessingStates)
				.set({ attemptCount: 4 })
				.where(where()),
		).rejects.toThrow();
		await expect(
			database
				.update(schema.mediaProcessingStates)
				.set({ scheduledInput: null })
				.where(where()),
		).rejects.toThrow();
	});
	it("does not let a concurrent old retry overwrite a newer request", async () => {
		await request();
		const old = await claimed();
		await Promise.all([request("v2"), fail(old)]);
		expect(await state()).toMatchObject({
			status: "pending",
			requestedRevision: "v2",
			attemptCount: 0,
			lastError: null,
		});
	});
	it("limits recovery to a bounded page", async () => {
		await request();
		await request("v1", { kind: "thumbnail" });
		await claimed();
		await claimed(["thumbnail"]);
		await database
			.update(schema.mediaProcessingStates)
			.set({ heartbeatAt: new Date(0) });
		expect(
			await transactions.transaction((tx) =>
				repo.recoverExpired(["metadata", "thumbnail"], 1, tx),
			),
		).toBe(1);
		expect(
			(await repo.findByMediaIds([input.mediaId])).filter(
				(row) => row.status === "in_progress",
			),
		).toHaveLength(1);
	});
	it("caps long exponential retry delays at five minutes", async () => {
		await request("v1", { maxAttempts: 20 });
		const work = await claimed();
		await database
			.update(schema.mediaProcessingStates)
			.set({ attemptCount: 19 })
			.where(where());
		const failed = await fail(work);
		if (!failed) throw new Error("settlement");
		expect(
			failed.availableAt.getTime() - failed.updatedAt.getTime(),
		).toBeLessThanOrEqual(300_000);
		expect(
			failed.availableAt.getTime() - failed.updatedAt.getTime(),
		).toBeGreaterThan(299_900);
	});
	it("rolls back handler output before persisting a retry and cleans its stage", async () => {
		await request();
		const cleanup = vi.fn(async () => {});
		const worker = scheduler(
			handler({
				prepare: async () => ({
					commit: async (tx) => {
						await executor(tx)
							.update(schema.medias)
							.set({ description: "rolled back" })
							.where(eq(schema.medias.id, input.mediaId));
						throw new Error("transient");
					},
					cleanup,
				}),
			}),
		);
		expect(await worker.runOnce()).toBe("retry");
		expect((await mediaRepo.findById(input.mediaId))?.description).toBeNull();
		expect(cleanup).toHaveBeenCalledOnce();
	});
	it("rejects a snapshot targeting a different media before invoking a handler", async () => {
		await request();
		const other = await fixtureInput("other.png");
		await database
			.update(schema.mediaProcessingStates)
			.set({
				scheduledInput: {
					...other,
					modifiedAt: other.modifiedAt.toISOString(),
				},
			})
			.where(where());
		expect(await claim()).toBeNull();
		expect((await state())?.lastError).toBe("Invalid scheduled media input");
	});
	it.runIf(Boolean(process.env.PROCESSING_TEST_POSTGRES_PORT))(
		"uses separate backends and SKIP LOCKED to claim another media while a transaction is held",
		async () => {
			if (!postgres) throw new Error("Postgres fixture");
			const connections = await Promise.all([
				postgres.connect(),
				postgres.connect(),
			]);
			try {
				const ids = await Promise.all(
					connections.map((connection) =>
						connection.query<{ pid: number }>("select pg_backend_pid() as pid"),
					),
				);
				expect(ids[0].rows[0]?.pid).not.toBe(ids[1].rows[0]?.pid);
			} finally {
				for (const connection of connections) connection.release();
			}
			await request();
			const nextInput = await fixtureInput("second.png");
			await transactions.transaction((tx) =>
				repo.request(
					{
						input: nextInput,
						taskKind: "metadata",
						revision: "v1",
						maxAttempts: 3,
						force: false,
					},
					tx,
				),
			);
			const held = Promise.withResolvers<void>();
			const release = Promise.withResolvers<void>();
			const first = transactions.transaction(async (tx) => {
				const work = await repo.claimDue(["metadata"], tx);
				held.resolve();
				await release.promise;
				return work;
			});
			await held.promise;
			let second: Awaited<ReturnType<typeof claim>>;
			const timeout = setTimeout(() => release.resolve(), 2000);
			try {
				second = await claim();
				expect((await state())?.status).toBe("pending");
			} finally {
				clearTimeout(timeout);
				release.resolve();
			}
			const firstWork = await first;
			expect(second?.input.mediaId).toBe(nextInput.mediaId);
			expect(firstWork?.input.mediaId).toBe(input.mediaId);
		},
	);
});
