import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, asc, eq, gt, isNotNull, sql } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	BatchRunService,
	toSafeBatchRun,
} from "@solid-imager/application/services/batch-run-service";
import {
	BatchAttemptLostError,
	batchInputSchema,
} from "@solid-imager/core/domain/batches/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import { type MediaTaskKind } from "@solid-imager/core/domain/processing/schemas";
import { createBatchRunRepository } from "@solid-imager/db/repositories/batch-run-repository";
import { createMediaProcessingStateRepository } from "@solid-imager/db/repositories/media-processing-state-repository";
import { createMediaRepository } from "@solid-imager/db/repositories/media-repository";
import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import { createTransactionManager } from "@solid-imager/db/transaction-manager";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import * as schema from "@solid-imager/db/schema";
import { createPglite } from "~/infrastructure/db/pglite";

describe("fixed batch runs and durable item outcomes", () => {
	let directory: string | undefined;
	let local: ReturnType<typeof createPglite> | undefined;
	let postgres: Pool | undefined;
	let database: DrizzleExecutor;
	const executor = (tx?: Transaction) => (tx ?? database) as DrizzleExecutor;
	const repo = createBatchRunRepository(executor);
	const processing = createMediaProcessingStateRepository(executor);
	const mediaRepo = createMediaRepository(executor);
	const sources = createSourceRepository(executor);
	const transactions = createTransactionManager(executor);
	const notify = vi.fn();
	let sourceId: string;
	const service = new BatchRunService({
		repo,
		transactions,
		notify,
		logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
		capture: (input) => async (cursor, tx) => {
			const rows = await executor(tx)
				.select()
				.from(schema.medias)
				.where(
					and(
						eq(schema.medias.mediaSourceId, sourceId),
						cursor ? gt(schema.medias.id, cursor) : undefined,
					),
				)
				.orderBy(asc(schema.medias.id))
				.limit(2);
			return {
				targets: rows.map((media) => ({
					mediaId: media.id,
					mediaSourceId: sourceId,
					kind:
						input.kind === "ccip" ? ("ccip" as const) : ("thumbnail" as const),
					input: {
						mediaId: media.id,
						mediaSourceId: sourceId,
						sourcePath: "/batch-fixture",
						filePath: media.filePath,
						modifiedAt: media.modifiedAt.toISOString(),
						fileSize: media.fileSize,
						mediaType: media.mediaType,
					},
					plannedRevision: "v1",
				})),
				nextCursor: rows.at(-1)?.id,
			};
		},
		reserve: async (item, input, tx) => {
			const media = await mediaRepo.findById(item.mediaId, tx, {
				forUpdate: true,
			});
			if (
				!item.input ||
				!media ||
				media.filePath !== item.input.filePath ||
				media.modifiedAt.toISOString() !== item.input.modifiedAt
			)
				return null;
			return processing.request(
				{
					input: { ...item.input, modifiedAt: new Date(item.input.modifiedAt) },
					taskKind: item.kind,
					revision: "v1",
					maxAttempts: 3,
					force: input.force || item.attemptCount > 0,
					batchId: item.runId,
				},
				tx,
			);
		},
	});
	const start = (kind: "thumbnail" | "ccip" = "thumbnail") =>
		service.start(batchInputSchema.parse({ kind, mediaSourceId: sourceId }));
	const allItems = async (id: string) =>
		(await repo.listItems(id, 100, 0)).items;
	async function media(filePath = randomUUID() + ".png") {
		return mediaRepo.create({
			mediaSourceId: sourceId,
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
	}
	async function dispatch() {
		const [claim] = await repo.claimPending(1);
		if (!claim) throw new Error("No batch claim");
		await service.dispatch(claim);
		await service.reconcile();
		return claim;
	}
	async function claimed(kind: MediaTaskKind = "thumbnail") {
		const work = await transactions.transaction((tx) =>
			processing.claimDue([kind], tx),
		);
		if (!work) throw new Error("No processing claim");
		return work;
	}
	async function complete(kind: MediaTaskKind = "thumbnail") {
		const work = await claimed(kind);
		await transactions.transaction((tx) =>
			processing.commit(work.input, work.claim, async () => {}, tx),
		);
		return work;
	}
	beforeAll(async () => {
		const port = process.env.BATCH_TEST_POSTGRES_PORT;
		if (port) {
			if (!/^\d+$/.test(port) || Number(port) <= 1024 || Number(port) > 65535)
				throw new Error("Invalid isolated PostgreSQL port");
			postgres = new Pool({
				host: "127.0.0.1",
				port: Number(port),
				user: "batch_test",
				password: "ephemeral_batch_test",
				database: "batch_run_test",
				max: 8,
			});
			const db = drizzlePostgres(postgres, { schema });
			await migratePostgres(db, { migrationsFolder: path.resolve("drizzle") });
			database = db;
		} else {
			directory = await mkdtemp(path.join(tmpdir(), "batch-runs-"));
			local = createPglite(directory);
			const db = drizzle(local, { schema });
			await migrate(db, { migrationsFolder: path.resolve("drizzle") });
			database = db;
		}
	}, 30000);
	beforeEach(async () => {
		notify.mockClear();
		await database
			.update(schema.jobRuntimeCutovers)
			.set({ authority: "legacy", generation: 0 });
		await database
			.update(schema.batchRunCutovers)
			.set({ authority: "legacy", generation: 0 });
		await database.delete(schema.batchRuns);
		// Delete owned fixture children first; the final fence rejects cross-family cascades.
		await database.delete(schema.jobs).where(isNotNull(schema.jobs.parentId));
		await database.delete(schema.jobs);
		await database.delete(schema.mediaSources);
		const source = await sources.create({
			name: "Batch fixture",
			description: null,
			type: "local",
			connectionInfo: { path: "/batch-fixture" },
		});
		sourceId = source.id;
	});
	afterAll(async () => {
		await postgres?.end();
		await local?.close();
		if (directory) await rm(directory, { recursive: true, force: true });
	});

	it("freezes targets and survives a new repository instance", async () => {
		await media("one.png");
		await media("two.png");
		const batch = await start();
		await media("later.png");
		const restarted = createBatchRunRepository(executor);
		expect((await restarted.listItems(batch.run.id, 100, 0)).total).toBe(2);
		await dispatch();
		expect(await database.select().from(schema.jobs)).toHaveLength(0);
		expect(
			(await allItems(batch.run.id)).every(
				(item) => item.status === "scheduled",
			),
		).toBe(true);
	});
	it("atomically records results and filters completed runs before reconciliation", async () => {
		await media();
		const batch = await start();
		await dispatch();
		await complete();
		const result = await repo.findById(batch.run.id);
		expect(result?.run.status).toBe("completed");
		expect(result?.progress).toEqual({
			total: 1,
			completed: 1,
			failed: 0,
			cancelled: 0,
			pending: 0,
		});
		expect(
			(await repo.list({ status: "completed", limit: 10, offset: 0 })).total,
		).toBe(1);
		await service.reconcile();
		expect(notify).toHaveBeenLastCalledWith(
			expect.objectContaining({
				run: expect.objectContaining({ status: "completed" }),
			}),
			undefined,
		);
		if (!result) throw new Error("Missing completed batch");
		expect(toSafeBatchRun(result)).not.toHaveProperty("input");
	});
	it("preserves completed siblings and attempt history on retry", async () => {
		await media();
		await media();
		const batch = await start();
		await dispatch();
		await complete();
		const work = await claimed();
		await transactions.transaction((tx) =>
			processing.settleFailure(work.claim, "private path failure", false, tx),
		);
		await service.reconcile();
		await service.retry(batch.run.id);
		await dispatch();
		await complete();
		const items = await allItems(batch.run.id);
		expect(items.every((item) => item.status === "completed")).toBe(true);
		expect(
			items.map((item) => item.attemptCount).sort((a, b) => a - b),
		).toEqual([1, 2]);
		const history = await database.select().from(schema.batchItemAttempts);
		expect(history).toHaveLength(3);
		expect(history.some((attempt) => attempt.status === "failed")).toBe(true);
	});

	it("publishes committed progress before dispatching the next page", async () => {
		for (let index = 0; index < 76; index++) await media();
		await start();
		await dispatch();
		for (let index = 0; index < 76; index++) await complete();
		await service.reconcile();

		// Reused outcomes complete immediately while a large batch is still dispatching.
		const batch = await start();
		const other = await start();
		notify.mockClear();
		let pages = 0;
		const clock = vi.spyOn(performance, "now").mockReturnValue(0);
		const dispatching = new BatchRunService({
			repo: {
				...repo,
				pendingItems: async (...args) => {
					if (++pages === 2) {
						expect(notify).toHaveBeenCalledWith(
							expect.objectContaining({
								run: expect.objectContaining({
									id: batch.run.id,
									dispatchComplete: false,
								}),
								progress: {
									total: 76,
									completed: 25,
									failed: 0,
									cancelled: 0,
									pending: 51,
								},
							}),
							"progress",
						);
						clock.mockReturnValue(500);
					}
					if (pages === 3) {
						// Fast pages do not rescan all outcomes and flood the stream.
						expect(notify).toHaveBeenCalledTimes(1);
						clock.mockReturnValue(1000);
					}
					if (pages === 4) {
						expect(notify).toHaveBeenCalledTimes(2);
						expect(notify.mock.lastCall?.[0].progress.completed).toBe(75);
					}
					return repo.pendingItems(...args);
				},
			},
			transactions,
			notify,
			logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
			capture: () => async () => ({ targets: [] }),
			reserve: async (item, _input, tx) =>
				(await processing.findByMediaIds([item.mediaId], tx))[0],
		});
		const [claim] = await repo.claimPending(1);
		expect(claim.id).toBe(batch.run.id);
		try {
			await dispatching.dispatch(claim);
		} finally {
			clock.mockRestore();
		}
		expect(notify).toHaveBeenLastCalledWith(
			expect.objectContaining({
				run: expect.objectContaining({ id: batch.run.id, status: "completed" }),
				progress: expect.objectContaining({ completed: 76, pending: 0 }),
			}),
			undefined,
		);
		// An individual dispatch reports only itself; the polling worker owns other runs.
		expect(
			notify.mock.calls.every(([summary]) => summary.run.id === batch.run.id),
		).toBe(true);
		expect(
			await database
				.select()
				.from(schema.batchRunDirty)
				.where(eq(schema.batchRunDirty.runId, other.run.id)),
		).toHaveLength(1);
	});
	it("resumes pending items after dispatch exhausts its leases without repeating completed siblings", async () => {
		await media();
		await media();
		await start("ccip");
		const [first] = await repo.claimPending(1);
		// Simulate one committed dispatch page, then a dispatcher that never finishes.
		await repo.withActiveClaim(first, async (tx) => {
			const [item] = await repo.pendingItems(first, 1, tx);
			if (!item.input) throw new Error("Missing input");
			const state = await processing.request(
				{
					input: { ...item.input, modifiedAt: new Date(item.input.modifiedAt) },
					taskKind: item.kind,
					revision: "v1",
					maxAttempts: 3,
					force: false,
					batchId: item.runId,
				},
				tx,
			);
			await repo.bindItem(first, item, state, tx);
		});
		await complete("ccip");
		for (let attempt = 1; attempt <= first.maxAttempts; attempt++) {
			await database
				.update(schema.batchRuns)
				.set({ leaseExpiresAt: new Date(0) })
				.where(eq(schema.batchRuns.id, first.id));
			await repo.claimPending(1);
		}
		expect((await repo.findById(first.id))?.run.status).toBe("failed");
		expect(
			(await allItems(first.id)).map((item) => item.status).sort(),
		).toEqual(["completed", "pending"]);
		expect(
			await transactions.transaction((tx) => processing.claimDue(["ccip"], tx)),
		).toBeNull();
		await service.retry(first.id);
		await dispatch();
		await complete("ccip");
		expect((await repo.findById(first.id))?.run.status).toBe("completed");
		expect(
			(await allItems(first.id)).every(
				(item) => item.status === "completed" && item.attemptCount === 1,
			),
		).toBe(true);
		expect(await database.select().from(schema.batchItemAttempts)).toHaveLength(
			2,
		);
	});
	it("cancels unclaimed batch-only demand and rejects an old scheduler claim", async () => {
		await media();
		const batch = await start();
		await dispatch();
		await service.cancel(batch.run.id);
		expect(
			await transactions.transaction((tx) =>
				processing.claimDue(["thumbnail"], tx),
			),
		).toBeNull();
		await expect(
			database
				.update(schema.mediaProcessingStates)
				.set({ status: "in_progress", claimToken: randomUUID() })
				.where(eq(schema.mediaProcessingStates.taskKind, "thumbnail")),
		).rejects.toThrow();
		await service.retry(batch.run.id);
		await dispatch();
		await complete();
		expect((await repo.findById(batch.run.id))?.run.status).toBe("completed");
	});
	it("keeps demand shared with another active batch", async () => {
		await media();
		const first = await start();
		const second = await start();
		await dispatch();
		await dispatch();
		await service.cancel(first.run.id);
		await complete();
		expect((await allItems(first.run.id))[0].status).toBe("cancelled");
		expect((await allItems(second.run.id))[0].status).toBe("completed");
	});
	it("keeps independent demand when its batch is cancelled", async () => {
		const m = await media();
		const batch = await start();
		await dispatch();
		const item = (await allItems(batch.run.id))[0];
		const snapshot = item.input;
		if (!snapshot) throw new Error("Missing item input");
		await transactions.transaction((tx) =>
			processing.request(
				{
					input: { ...snapshot, modifiedAt: m.modifiedAt },
					taskKind: "thumbnail",
					revision: "v1",
					force: false,
					maxAttempts: 3,
				},
				tx,
			),
		);
		await service.cancel(batch.run.id);
		await complete();
		expect((await allItems(batch.run.id))[0].status).toBe("cancelled");
	});
	it("does not overwrite cancelled history when an already active task completes", async () => {
		await media();
		const batch = await start();
		await dispatch();
		const work = await claimed();
		await service.cancel(batch.run.id);
		await transactions.transaction((tx) =>
			processing.commit(work.input, work.claim, async () => {}, tx),
		);
		expect((await allItems(batch.run.id))[0].status).toBe("cancelled");
		expect(
			(await database.select().from(schema.batchItemAttempts))[0].status,
		).toBe("cancelled");
	});
	it("supersedes old attempts without later results changing their history", async () => {
		await media();
		const batch = await start();
		await dispatch();
		const old = await claimed();
		await transactions.transaction((tx) =>
			processing.request(
				{
					input: old.input,
					taskKind: "thumbnail",
					revision: "v2",
					force: true,
					maxAttempts: 3,
				},
				tx,
			),
		);
		await expect(
			transactions.transaction((tx) =>
				processing.commit(old.input, old.claim, async () => {}, tx),
			),
		).rejects.toThrow();
		expect((await allItems(batch.run.id))[0].status).toBe("superseded");
	});
	it("fails changed input before scheduling instead of silently changing scope", async () => {
		const m = await media();
		const batch = await start();
		await mediaRepo.update(m.id, { filePath: "changed.png" });
		await dispatch();
		expect((await allItems(batch.run.id))[0]).toMatchObject({
			status: "failed",
			failureCode: "input_changed",
			attemptCount: 0,
		});
		expect(
			await database.select().from(schema.mediaProcessingStates),
		).toHaveLength(0);
	});
	it("fences expired dispatchers and cancellation before reservation", async () => {
		await media();
		const batch = await start();
		const [old] = await repo.claimPending(1);
		await database
			.update(schema.batchRuns)
			.set({ leaseExpiresAt: new Date(0) })
			.where(eq(schema.batchRuns.id, batch.run.id));
		const [fresh] = await repo.claimPending(1);
		await expect(
			repo.withActiveClaim(old, async () => {}),
		).rejects.toBeInstanceOf(BatchAttemptLostError);
		await service.cancel(batch.run.id);
		await expect(
			repo.withActiveClaim(fresh, async () => {}),
		).rejects.toBeInstanceOf(BatchAttemptLostError);
		expect(
			await database.select().from(schema.mediaProcessingStates),
		).toHaveLength(0);
	});
	it("backfills fixed legacy children, preserves old IDs, and rolls back without replaying successes", async () => {
		const m = await media();
		const parentId = randomUUID(),
			childId = randomUUID(),
			dispatcherId = randomUUID();
		await database.insert(schema.jobs).values({
			id: parentId,
			type: "bulk_tagging_parent",
			status: "in_progress",
			mediaSourceId: sourceId,
			payload: { total: 1, processed: 1, failed: 0 },
		});
		await database.insert(schema.jobs).values([
			{
				id: childId,
				parentId,
				type: "auto_tagging",
				status: "completed",
				mediaSourceId: sourceId,
				payload: { mediaId: m.id, privateField: "retained" },
			},
			{
				id: dispatcherId,
				parentId,
				type: "bulk_tagging_dispatch",
				status: "completed",
				mediaSourceId: sourceId,
				payload: {},
			},
		]);
		expect(await repo.initialize()).toEqual({ migrated: 3, blocked: 0 });
		expect(await repo.resolveId(childId)).toBe(parentId);
		expect(await repo.findItem(childId)).toMatchObject({
			id: childId,
			runId: parentId,
			status: "completed",
		});
		expect((await repo.findById(parentId))?.run.status).toBe("completed");
		expect(await repo.rollback()).toEqual({ restored: 3 });
		const [restored] = await database
			.select()
			.from(schema.jobs)
			.where(eq(schema.jobs.id, childId));
		expect(restored.status).toBe("completed");
		expect(restored.payload).toMatchObject({
			mediaId: m.id,
			privateField: "retained",
		});
		await expect(repo.initialize()).rejects.toThrow("initial legacy epoch");
	});
	it("blocks legacy dispatches with unfixed scope instead of rescanning current media", async () => {
		const id = randomUUID();
		await database.insert(schema.jobs).values({
			id,
			type: "batch_ccip_parent",
			status: "in_progress",
			mediaSourceId: sourceId,
			payload: { total: 0 },
		});
		await database.insert(schema.jobs).values({
			type: "batch_ccip_dispatch",
			parentId: id,
			mediaSourceId: sourceId,
			status: "pending",
			payload: { force: true },
		});
		await media();
		expect(await repo.initialize()).toEqual({ migrated: 2, blocked: 1 });
		expect((await repo.findById(id))?.run).toMatchObject({
			status: "blocked",
			blockedReason: "legacy_scope_unfixed",
		});
		expect(await allItems(id)).toHaveLength(0);
		expect(await repo.claimPending(10)).toHaveLength(0);
	});
	it("rolls back a changed reservation before recording its item failure", async () => {
		await media();
		const batch = await start();
		const race = new BatchRunService({
			repo,
			transactions,
			notify,
			logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
			capture: () => async () => ({ targets: [] }),
			reserve: async (item, _input, tx) => {
				if (!item.input) throw new Error("Missing snapshot");
				return processing.request(
					{
						input: {
							...item.input,
							modifiedAt: new Date(item.input.modifiedAt),
						},
						taskKind: item.kind,
						revision: "changed-settings",
						maxAttempts: 3,
						force: true,
						batchId: item.runId,
					},
					tx,
				);
			},
		});
		const [claim] = await repo.claimPending(1);
		await race.dispatch(claim);
		expect(
			await database.select().from(schema.mediaProcessingStates),
		).toHaveLength(0);
		expect((await allItems(batch.run.id))[0]).toMatchObject({
			status: "failed",
			failureCode: "input_changed",
			attemptCount: 0,
		});
	});
	it("retains successful legacy file steps while blocking unknown failed request identities", async () => {
		const m = await media();
		const id = randomUUID();
		const step = (status: "completed" | "failed" | "skipped") => ({
			status,
			attemptCount: 1,
			updatedAt: new Date().toISOString(),
		});
		await database.insert(schema.jobs).values({
			id,
			type: "processMedia",
			mediaSourceId: sourceId,
			status: "failed",
			payload: { mediaId: m.id },
			processingCheckpoint: {
				version: 1,
				inputRevision: "historical",
				steps: {
					metadata: step("completed"),
					thumbnail: step("failed"),
					ai_dispatch: step("skipped"),
				},
			},
		});
		expect(await repo.initialize()).toEqual({ migrated: 1, blocked: 1 });
		const records = await allItems(id);
		expect(records.find((item) => item.kind === "metadata")?.status).toBe(
			"completed",
		);
		expect(records.find((item) => item.kind === "thumbnail")?.status).toBe(
			"failed",
		);
		expect((await repo.findById(id))?.run.status).toBe("blocked");
		expect(await repo.claimPending(1)).toEqual([]);
	});
	it("refuses cascading deletion of an unclassified legacy child", async () => {
		const id = randomUUID();
		await database.insert(schema.jobs).values({
			id,
			type: "bulk_tagging_parent",
			status: "completed",
			payload: { total: 0 },
		});
		await database
			.insert(schema.jobs)
			.values({ type: "unknown_legacy_type", parentId: id, status: "pending" });
		await expect(repo.initialize()).rejects.toThrow("foreign legacy children");
		expect(await database.select().from(schema.jobs)).toHaveLength(2);
		expect(
			(await database.select().from(schema.batchRunCutovers))[0].authority,
		).toBe("legacy");
	});
	it("rejects legacy writes after authority changes", async () => {
		await repo.initialize();
		await expect(
			database.insert(schema.jobs).values({
				type: "auto_tagging",
				mediaSourceId: sourceId,
				payload: { mediaId: randomUUID() },
			}),
		).rejects.toThrow();
	});
	it("reconstructs native fixed work and refuses rollback with a live native lease", async () => {
		await media();
		const batch = await start();
		await dispatch();
		const work = await claimed();
		await expect(repo.rollback()).rejects.toThrow("drain");
		await transactions.transaction((tx) =>
			processing.settleFailure(work.claim, "failed", false, tx),
		);
		await service.reconcile();
		expect(await repo.rollback()).toEqual({ restored: 2 });
		const old = await database.select().from(schema.jobs);
		expect(
			old.some((job) => job.id === batch.run.id && job.status === "failed"),
		).toBe(true);
		expect(
			old.some(
				(job) => job.parentId === batch.run.id && job.status === "failed",
			),
		).toBe(true);
	});
	it.runIf(!!process.env.BATCH_TEST_POSTGRES_PORT)(
		"allows outcome foreign-key checks while dispatch holds the parent lease",
		async () => {
			await media();
			await media();
			const batch = await start();
			const [claim] = await repo.claimPending(1);
			await repo.withActiveClaim(claim, async (tx) => {
				const [item] = await repo.pendingItems(claim, 1, tx);
				if (!item.input) throw new Error("Missing input");
				const state = await processing.request(
					{
						input: {
							...item.input,
							modifiedAt: new Date(item.input.modifiedAt),
						},
						taskKind: item.kind,
						revision: "v1",
						maxAttempts: 3,
						force: false,
						batchId: claim.id,
					},
					tx,
				);
				await repo.bindItem(claim, item, state, tx);
			});
			const work = await claimed();
			// A newly inserted dirty marker checks its FK against the locked parent.
			await database
				.delete(schema.batchRunDirty)
				.where(eq(schema.batchRunDirty.runId, batch.run.id));
			const entered = Promise.withResolvers<void>();
			const release = Promise.withResolvers<void>();
			const holding = repo.withActiveClaim(claim, async () => {
				entered.resolve();
				await release.promise;
			});
			try {
				await entered.promise;
				await transactions.transaction(async (tx) => {
					await executor(tx).execute(
						sql`SET LOCAL statement_timeout = '750ms'`,
					);
					await processing.commit(work.input, work.claim, async () => {}, tx);
				});
			} finally {
				release.resolve();
				await holding;
			}
			expect(
				(await allItems(batch.run.id)).filter(
					(item) => item.status === "completed",
				),
			).toHaveLength(1);
		},
	);
	it.runIf(!!process.env.BATCH_TEST_POSTGRES_PORT)(
		"locks the whole dispatch page before taking the shared progress marker",
		async () => {
			if (!postgres) throw new Error("Missing PostgreSQL fixture");
			await media();
			await media();
			const batch = await start();
			const [claim] = await repo.claimPending(1);
			const page = (await allItems(batch.run.id)).sort((a, b) =>
				a.mediaId.localeCompare(b.mediaId),
			);
			const worker = await postgres.connect();
			const probe = await postgres.connect();
			let dispatching: Promise<void> | undefined;
			try {
				await worker.query("BEGIN");
				await worker.query("SELECT id FROM media WHERE id=$1 FOR UPDATE", [
					page[1].mediaId,
				]);
				const {
					rows: [{ pid }],
				} = await worker.query("SELECT pg_backend_pid() AS pid");
				dispatching = service.dispatch(claim);
				// Observe the real lock wait rather than relying on sleeps or fake time.
				await vi.waitFor(async () => {
					const blocked = await probe.query(
						"SELECT count(*)::int AS n FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))",
						[pid],
					);
					expect(blocked.rows[0].n).toBeGreaterThan(0);
				});
				await probe.query("BEGIN");
				await probe.query("SET LOCAL lock_timeout = '500ms'");
				// This marker must still be free while any media in the page is blocked.
				await probe.query(
					"SELECT run_id FROM batch_run_dirty WHERE run_id=$1 FOR UPDATE",
					[batch.run.id],
				);
			} finally {
				await probe.query("ROLLBACK");
				probe.release();
				await worker.query("ROLLBACK");
				worker.release();
				await dispatching;
			}
			expect(
				(await allItems(batch.run.id)).every(
					(item) => item.status === "scheduled",
				),
			).toBe(true);
		},
	);
	it.runIf(!!process.env.BATCH_TEST_POSTGRES_PORT)(
		"waits for an old table writer before taking the authority lock",
		async () => {
			if (!postgres) throw new Error("Missing PostgreSQL fixture");
			const client = await postgres.connect();
			let migration: ReturnType<typeof repo.initialize> | undefined;
			try {
				await client.query("BEGIN");
				await client.query("SET LOCAL statement_timeout = '2s'");
				await client.query("LOCK TABLE jobs IN ROW EXCLUSIVE MODE");
				migration = repo.initialize();
				await vi.waitFor(async () => {
					const locks = await client.query(
						"SELECT count(*)::int AS total FROM pg_locks WHERE relation = 'jobs'::regclass AND mode = 'ShareRowExclusiveLock' AND NOT granted",
					);
					expect(locks.rows[0].total).toBeGreaterThan(0);
				});
				await client.query(
					"INSERT INTO jobs(type,source_id,status,payload) VALUES('auto_tagging',$1,'completed',$2)",
					[sourceId, JSON.stringify({ mediaId: randomUUID() })],
				);
				await client.query("COMMIT");
				expect((await migration).migrated).toBe(1);
			} finally {
				await client.query("ROLLBACK");
				client.release();
				await migration?.catch(() => undefined);
			}
		},
	);
	it.runIf(!!process.env.BATCH_TEST_POSTGRES_PORT)(
		"one claimant wins across independent connections",
		async () => {
			await media();
			await start();
			const other = createBatchRunRepository(executor);
			const [one, two] = await Promise.all([
				repo.claimPending(1),
				other.claimPending(1),
			]);
			expect(one.length + two.length).toBe(1);
		},
	);
	it.runIf(!!process.env.BATCH_TEST_POSTGRES_PORT)(
		"fences a repeatable-read old writer after cutover",
		async () => {
			if (!postgres) throw new Error("Missing PostgreSQL fixture");
			const client = await postgres.connect();
			try {
				await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
				await client.query("SELECT authority FROM batch_run_cutovers");
				await repo.initialize();
				await expect(
					client.query(
						"INSERT INTO jobs(type,source_id,payload) VALUES('auto_tagging',$1,$2)",
						[sourceId, JSON.stringify({ mediaId: randomUUID() })],
					),
				).rejects.toThrow();
			} finally {
				await client.query("ROLLBACK");
				client.release();
			}
		},
	);
});
