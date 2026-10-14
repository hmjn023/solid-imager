import { randomUUID } from "node:crypto";
import path from "node:path";
import { Pool } from "pg";
import { drizzle as pg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, isNotNull } from "drizzle-orm";
import {
	beforeAll,
	beforeEach,
	afterAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createSourceRunRepository } from "@solid-imager/db/repositories/source-run-repository";
import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	SourceRunAttemptLostError,
	type SourceRunClaim,
} from "@solid-imager/core/domain/source-runs/schemas";
import * as schema from "@solid-imager/db/schema";
import { createPglite } from "~/infrastructure/db/pglite";

describe("durable source operations", () => {
	let database: DrizzleExecutor,
		local: ReturnType<typeof createPglite> | undefined,
		pool: Pool | undefined,
		sourceId: string;
	const executor = (tx?: Transaction) => (tx ?? database) as DrizzleExecutor;
	const repo = createSourceRunRepository(executor),
		sources = createSourceRepository(executor);
	const exportInput = {
		kind: "export" as const,
		mode: "ndjson" as const,
		includeImages: false,
		sourceRevision: "fixture",
	};
	const restoreInput = {
		kind: "restore" as const,
		mode: "ndjson" as const,
		inputPath: "/owned/input",
		inputDigest: "fixture",
		inputSize: 1,
		sourceRevision: "fixture",
	};
	const transfer = () => repo.createTransfer(sourceId, exportInput);
	const claim = async (
		kinds: Array<"sync" | "export" | "restore"> = ["sync", "export", "restore"],
	): Promise<SourceRunClaim> => {
		const [run] = await repo.claimPending(kinds, 1);
		if (!run) throw new Error("No source claim");
		return run;
	};
	const expire = async (run: SourceRunClaim) => {
		const table =
			run.kind === "sync" ? schema.sourceSyncRuns : schema.sourceTransferRuns;
		await database
			.update(table)
			.set({ leaseExpiresAt: new Date(0) })
			.where(eq(table.id, run.id));
		await database
			.update(schema.sourceRunLeases)
			.set({ expiresAt: new Date(0) })
			.where(eq(schema.sourceRunLeases.sourceId, run.sourceId));
	};
	beforeAll(async () => {
		const port = process.env.BATCH_TEST_POSTGRES_PORT;
		if (port) {
			if (!/^\d+$/.test(port) || Number(port) < 1025 || Number(port) > 65535)
				throw new Error("Invalid isolated PostgreSQL port");
			pool = new Pool({
				host: "127.0.0.1",
				port: Number(port),
				user: "batch_test",
				password: "ephemeral_batch_test",
				database: "batch_run_test",
				max: 8,
			});
			const db = pg(pool, { schema });
			await migratePg(db, { migrationsFolder: path.resolve("drizzle") });
			database = db;
		} else {
			local = createPglite();
			const db = drizzle(local, { schema });
			await migrate(db, { migrationsFolder: path.resolve("drizzle") });
			database = db;
		}
	}, 30_000);
	beforeEach(async () => {
		await database
			.update(schema.jobRuntimeCutovers)
			.set({ authority: "legacy", generation: 0 });
		await database
			.update(schema.sourceRunCutovers)
			.set({ authority: "legacy", generation: 0 });
		await database
			.update(schema.batchRunCutovers)
			.set({ authority: "legacy", generation: 0 });
		await database.delete(schema.sourceRunLeases);
		await database.delete(schema.sourceSyncRuns);
		await database.delete(schema.sourceTransferRuns);
		await database.delete(schema.sourceRunLegacySnapshots);
		await database.delete(schema.sourceSyncWatermarks);
		await database.delete(schema.jobs).where(isNotNull(schema.jobs.parentId));
		await database.delete(schema.jobs);
		await database.delete(schema.mediaSources);
		const source = await sources.create({
			name: "Source fixture",
			description: null,
			type: "local",
			connectionInfo: { path: "/source-fixture" },
		});
		sourceId = source.id;
	});
	afterAll(async () => {
		await pool?.end();
		await local?.close();
	});

	it("coalesces pending requests and preserves a request committed during an active scan", async () => {
		await repo.initialize();
		const first = await repo.requestSync(sourceId, "/source-fixture");
		const second = await repo.requestSync(sourceId, "/source-fixture");
		expect(second.run.id).toBe(first.run.id);
		const active = await claim(["sync"]);
		const later = await repo.requestSync(sourceId, "/source-fixture");
		expect(later.run.id).not.toBe(active.id);
		await repo.complete(active);
		expect((await repo.watermark(sourceId))?.appliedGeneration).toBe(
			second.generation,
		);
		expect((await repo.watermark(sourceId))?.requestedGeneration).toBe(
			later.generation,
		);
		expect((await claim(["sync"])).input).toMatchObject({
			generation: later.generation,
		});
	});

	it("shares one DB lease across sync, export and restore", async () => {
		await repo.initialize();
		await repo.requestSync(sourceId, "/source-fixture");
		await transfer();
		await repo.createTransfer(sourceId, restoreInput);
		const active = await claim();
		expect(
			await createSourceRunRepository(executor).claimPending(
				["sync", "export", "restore"],
				3,
			),
		).toEqual([]);
		await repo.complete(active);
		expect(
			await repo.claimPending(["sync", "export", "restore"], 3),
		).toHaveLength(1);
	});

	it("records media upsert/delete/recreate changes in the output transaction", async () => {
		await repo.initialize();
		await repo.requestSync(sourceId, "/source-fixture");
		const active = await claim(["sync"]);
		const generation =
			active.input.kind === "sync" ? active.input.generation : -1;
		const id = randomUUID();
		const insert = () =>
			database.insert(schema.medias).values({
				id,
				mediaSourceId: sourceId,
				filePath: "one.png",
				fileName: "one.png",
				mediaType: "image",
				width: 1,
				height: 1,
				fileSize: 1,
			});
		await insert();
		await database
			.update(schema.medias)
			.set({ fileSize: 12 })
			.where(eq(schema.medias.id, id));
		await database.delete(schema.medias).where(eq(schema.medias.id, id));
		await insert();
		await repo.complete(active);
		await repo.ensureSyncRuns();
		const mark = await repo.watermark(sourceId);
		expect(mark?.appliedGeneration).toBe(generation);
		expect(mark?.requestedGeneration).toBe(generation + 4);
		expect((await claim(["sync"])).input).toMatchObject({
			generation: generation + 4,
		});
	});

	it("rolls back output and cursor together on a failed commit", async () => {
		await repo.initialize();
		await repo.createTransfer(sourceId, restoreInput);
		const active = await claim();
		await expect(
			repo.withActiveClaim(active, async (tx) => {
				await executor(tx).insert(schema.medias).values({
					mediaSourceId: sourceId,
					filePath: "partial.png",
					fileName: "partial.png",
					mediaType: "image",
					width: 1,
					height: 1,
					fileSize: 1,
				});
				await repo.checkpoint(
					active,
					{ ...active.checkpoint, offset: 10, processed: 1 },
					tx,
				);
				throw new Error("transaction interrupted");
			}),
		).rejects.toThrow("transaction interrupted");
		expect(await database.select().from(schema.medias)).toHaveLength(0);
		expect((await repo.findById(active.id))?.checkpoint.offset).toBe(0);
	});

	it("resumes the cursor with a new token and refuses stale publication", async () => {
		await repo.initialize();
		await repo.createTransfer(sourceId, restoreInput);
		const old = await claim();
		await repo.withActiveClaim(old, (tx) =>
			repo.checkpoint(old, { ...old.checkpoint, offset: 64, processed: 1 }, tx),
		);
		await expire(old);
		const current = await claim();
		expect(current.leaseToken).not.toBe(old.leaseToken);
		expect(current.checkpoint.offset).toBe(64);
		const publish = vi.fn();
		expect(await repo.complete(old, undefined, publish)).toBeNull();
		expect(publish).not.toHaveBeenCalled();
		await expect(
			repo.withActiveClaim(old, async () => {}),
		).rejects.toBeInstanceOf(SourceRunAttemptLostError);
		expect((await repo.complete(current))?.status).toBe("completed");
	});

	it("retains successful checkpoints across cancel/retry and blocks the old owner", async () => {
		await repo.initialize();
		await repo.createTransfer(sourceId, restoreInput);
		const active = await claim();
		await repo.withActiveClaim(active, (tx) =>
			repo.checkpoint(
				active,
				{ ...active.checkpoint, offset: 20, processed: 1 },
				tx,
			),
		);
		await repo.cancel(active.id);
		expect(await repo.heartbeat(active)).toBe(false);
		expect((await repo.retry(active.id)).checkpoint.offset).toBe(20);
		expect((await claim()).attemptCount).toBe(2);
	});

	it("does not expire an active owner and removes retained input only after the lease drains", async () => {
		await repo.initialize();
		const run = await repo.createTransfer(sourceId, restoreInput);
		const active = await claim();
		await database
			.update(schema.sourceTransferRuns)
			.set({ retentionExpiresAt: new Date(0) })
			.where(eq(schema.sourceTransferRuns.id, run.id));
		const remove = vi.fn();
		expect(await repo.cleanupExpired(25, remove)).toBe(0);
		expect(remove).not.toHaveBeenCalled();
		await expire(active);
		expect(await repo.cleanupExpired(25, remove)).toBe(1);
		expect(await repo.findById(run.id)).toMatchObject({
			status: "blocked",
			failureCode: "input_expired",
			input: null,
		});
		await expect(repo.retry(run.id)).rejects.toThrow();
	});

	it("never claims an expired restore input even before cleanup runs", async () => {
		await repo.initialize();
		const run = await repo.createTransfer(sourceId, restoreInput);
		await database
			.update(schema.sourceTransferRuns)
			.set({ retentionExpiresAt: new Date(0) })
			.where(eq(schema.sourceTransferRuns.id, run.id));
		expect(await repo.claimPending(["restore"], 1)).toEqual([]);
		expect(await repo.findById(run.id)).toMatchObject({
			status: "blocked",
			failureCode: "input_expired",
		});
	});
	it("keeps failed scans terminal until an explicit retry or newer request", async () => {
		await repo.initialize();
		await repo.requestSync(sourceId, "/source-fixture");
		const active = await claim(["sync"]);
		await repo.fail(active, "source_failed");
		await repo.ensureSyncRuns();
		expect(await repo.claimPending(["sync"], 1)).toEqual([]);
		await repo.requestSync(sourceId, "/source-fixture");
		expect((await claim(["sync"])).id).not.toBe(active.id);
	});

	it("archives legacy transfers, blocks uncheckpointed restore and preserves unknown fields on rollback", async () => {
		const restoredId = randomUUID(),
			completeId = randomUUID();
		await database.insert(schema.jobs).values([
			{
				id: restoredId,
				type: "source_restore",
				mediaSourceId: sourceId,
				payload: {
					mode: "ndjson",
					inputPath: "/legacy/input",
					future: { kept: true },
				},
			},
			{
				id: completeId,
				type: "source_export",
				mediaSourceId: sourceId,
				status: "completed",
				payload: { mode: "ndjson", includeImages: false, unknown: "preserve" },
			},
		]);
		expect(await repo.initialize()).toEqual({ migrated: 2, blocked: 1 });
		expect(await repo.findById(restoredId)).toMatchObject({
			status: "blocked",
			failureCode: "legacy_restore_uncheckpointed",
		});
		await expect(repo.retry(restoredId)).rejects.toThrow();
		expect(await database.select().from(schema.jobs)).toEqual([]);
		expect(await repo.rollback()).toEqual({ restored: 2 });
		const [old] = await database
			.select()
			.from(schema.jobs)
			.where(eq(schema.jobs.id, restoredId));
		expect(old.payload).toMatchObject({ future: { kept: true } });
		expect(old.status).toBe("failed");
		const [success] = await database
			.select()
			.from(schema.jobs)
			.where(eq(schema.jobs.id, completeId));
		expect(success.status).toBe("completed");
		await expect(repo.initialize()).rejects.toThrow("initial legacy epoch");
	});

	it("restores legacy parent links independently of UUID sort order", async () => {
		const parent = "f0000000-0000-4000-8000-000000000001",
			child = "10000000-0000-4000-8000-000000000001";
		await database.insert(schema.jobs).values({
			id: parent,
			type: "source_export",
			mediaSourceId: sourceId,
			payload: { mode: "ndjson", includeImages: false },
		});
		await database.insert(schema.jobs).values({
			id: child,
			parentId: parent,
			type: "source_restore",
			mediaSourceId: sourceId,
			payload: { mode: "ndjson", inputPath: "/old/input" },
		});
		await repo.initialize();
		await repo.rollback();
		expect(
			(
				await database
					.select()
					.from(schema.jobs)
					.where(eq(schema.jobs.id, child))
			)[0].parentId,
		).toBe(parent);
	});
	it("fences legacy writers after activation", async () => {
		await repo.initialize();
		await expect(
			database.insert(schema.jobs).values({
				type: "source_export",
				mediaSourceId: sourceId,
				payload: { mode: "ndjson" },
			}),
		).rejects.toThrow();
	});

	it("refuses cutover when a foreign child would be cascade-deleted", async () => {
		const parent = randomUUID();
		await database.insert(schema.jobs).values([
			{ id: parent, type: "source_export", mediaSourceId: sourceId },
			{ type: "future_source_child", parentId: parent },
		]);
		await expect(repo.initialize()).rejects.toThrow(
			"foreign legacy source children",
		);
		expect(await database.select().from(schema.jobs)).toHaveLength(2);
	});

	it("refuses rollback while an owner is live or a native restore is partially applied", async () => {
		await repo.initialize();
		await repo.createTransfer(sourceId, restoreInput);
		const active = await claim();
		await expect(repo.rollback()).rejects.toThrow("drain");
		await repo.withActiveClaim(active, (tx) =>
			repo.checkpoint(active, { ...active.checkpoint, offset: 10 }, tx),
		);
		await repo.fail(active, "fixture");
		await expect(repo.rollback()).rejects.toThrow("partially restored");
		await repo.cancel(active.id);
		expect(await repo.rollback()).toEqual({ restored: 1 });
	});

	it.runIf(!!process.env.BATCH_TEST_POSTGRES_PORT)(
		"serializes competing PostgreSQL connections on the same source",
		async () => {
			await repo.initialize();
			await transfer();
			await transfer();
			const results = await Promise.all([
				repo.claimPending(["export"], 1),
				createSourceRunRepository(executor).claimPending(["export"], 1),
			]);
			expect(results.flat()).toHaveLength(1);
		},
	);

	it.runIf(!!process.env.BATCH_TEST_POSTGRES_PORT)(
		"fences a repeatable-read legacy writer started before activation",
		async () => {
			if (!pool) throw new Error("PostgreSQL fixture missing");
			const client = await pool.connect();
			try {
				await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
				await client.query("SELECT * FROM source_run_cutovers");
				await repo.initialize();
				await expect(
					client.query(
						"INSERT INTO jobs(id,type,status) VALUES($1,'source_export','pending')",
						[randomUUID()],
					),
				).rejects.toThrow();
			} finally {
				await client.query("ROLLBACK");
				client.release();
			}
		},
	);
});
