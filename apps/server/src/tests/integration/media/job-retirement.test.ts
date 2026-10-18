import { randomUUID } from "node:crypto";
import path from "node:path";
import { Pool } from "pg";
import { drizzle as pg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createJobRetirementRepository } from "@solid-imager/db/repositories/job-retirement-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import * as schema from "@solid-imager/db/schema";
import { createPglite } from "~/infrastructure/db/pglite";

describe("generic jobs final write fence and audit", () => {
	let database: DrizzleExecutor,
		local: ReturnType<typeof createPglite> | undefined,
		pool: Pool | undefined;
	const executor = (tx?: Transaction) => (tx ?? database) as DrizzleExecutor;
	const repo = createJobRetirementRepository(executor);
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
	}, 30000);
	beforeEach(async () => {
		await database
			.update(schema.jobRuntimeCutovers)
			.set({ authority: "legacy", generation: 0 });
		for (const table of [
			schema.importRequestCutovers,
			schema.downloadRunCutovers,
			schema.batchRunCutovers,
			schema.sourceRunCutovers,
		])
			await database.update(table).set({ authority: "legacy", generation: 0 });
		await database.delete(schema.jobs);
		await database.delete(schema.sourceRunLeases);
		await database.delete(schema.sourceSyncRuns);
		await database.delete(schema.sourceTransferRuns);
		await database.delete(schema.sourceRunLegacySnapshots);
		await database.delete(schema.sourceSyncWatermarks);
		await database.delete(schema.batchRuns);
		await database.delete(schema.downloadRuns);
		await database.delete(schema.importRequests);
		await database.delete(schema.mediaSources);
		for (const table of [
			schema.importRequestCutovers,
			schema.downloadRunCutovers,
			schema.batchRunCutovers,
			schema.sourceRunCutovers,
		])
			await database
				.update(table)
				.set({ authority: "dedicated", generation: 1 });
	});
	afterAll(async () => {
		await pool?.end();
		await local?.close();
	});
	it("classifies unknown legacy without reading payloads or silently discarding it", async () => {
		await database
			.insert(schema.jobs)
			.values({ type: "future_type", payload: { secret: "private" } });
		const audit = await repo.inspect();
		expect(audit.types).toEqual([
			{ type: "future_type", status: "pending", count: 1, known: false },
		]);
		expect(JSON.stringify(audit)).not.toContain("private");
		await expect(repo.initialize()).rejects.toThrow("classify legacy types");
		expect(await database.select().from(schema.jobs)).toHaveLength(1);
	});
	it("refuses cross-family cascade deletion before any flow cutover", async () => {
		await database
			.update(schema.importRequestCutovers)
			.set({ authority: "legacy" });
		await database
			.update(schema.downloadRunCutovers)
			.set({ authority: "legacy" });
		const parent = randomUUID(),
			child = randomUUID();
		await database
			.insert(schema.jobs)
			.values({ id: parent, type: "import_request" });
		await database
			.insert(schema.jobs)
			.values({ id: child, type: "downloadImage", parentId: parent });
		try {
			expect((await repo.inspect()).crossFamilyChildren).toBe(1);
			await expect(repo.preflight()).rejects.toThrow("before any flow cutover");
			await expect(
				database.delete(schema.jobs).where(eq(schema.jobs.id, parent)),
			).rejects.toThrow();
			expect(await database.select().from(schema.jobs)).toHaveLength(2);
		} finally {
			await database.delete(schema.jobs).where(eq(schema.jobs.id, child));
			await database.delete(schema.jobs).where(eq(schema.jobs.id, parent));
		}
	});
	it("requires every dedicated authority before activation", async () => {
		await database
			.update(schema.sourceRunCutovers)
			.set({ authority: "legacy" });
		await expect(repo.initialize()).rejects.toThrow("every dedicated flow");
	});
	it("fences all legacy writes including previously unknown types", async () => {
		await repo.initialize();
		await expect(
			database.insert(schema.jobs).values({ type: "unknown_writer" }),
		).rejects.toThrow();
		expect((await repo.inspect()).authority).toBe("retired");
	});
	it("does not read jobs during normal reinitialization", async () => {
		await repo.initialize();
		// A fresh statement cannot resolve the old table name. Runtime activation must only read its control row.
		await database.execute(
			sql`ALTER TABLE jobs RENAME TO jobs_hidden_for_runtime_test`,
		);
		try {
			await expect(repo.initialize()).resolves.toBeUndefined();
			await expect(repo.assertRetired()).resolves.toBeUndefined();
		} finally {
			await database.execute(
				sql`ALTER TABLE jobs_hidden_for_runtime_test RENAME TO jobs`,
			);
		}
	});
	it("requires owner drain before rollback and refuses implicit reactivation afterwards", async () => {
		await repo.initialize();
		const sourceId = randomUUID();
		await database.insert(schema.sourceRunLeases).values({
			sourceId,
			runId: randomUUID(),
			kind: "restore",
			token: randomUUID(),
			expiresAt: new Date(Date.now() + 120000),
		});
		await expect(repo.rollback()).rejects.toThrow(
			"Drain every dedicated lease",
		);
		await database.delete(schema.sourceRunLeases);
		await repo.rollback();
		await database
			.insert(schema.jobs)
			.values({ type: "operator_classified_history", status: "completed" });
		await expect(repo.initialize()).rejects.toThrow("initial legacy epoch");
	});
	it("detects an archived source row whose dedicated history is missing", async () => {
		await database
			.insert(schema.sourceRunLegacySnapshots)
			.values({ id: randomUUID(), kind: "export", snapshot: {} });
		expect((await repo.inspect()).missingArchives).toBe(1);
		await expect(repo.initialize()).rejects.toThrow("reconcile archives");
	});
	it.runIf(!!process.env.BATCH_TEST_POSTGRES_PORT)(
		"fences repeatable-read writers started before final retirement",
		async () => {
			if (!pool) throw new Error("Missing PostgreSQL fixture");
			const client = await pool.connect();
			try {
				await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
				await client.query("SELECT * FROM job_runtime_cutovers");
				await repo.initialize();
				await expect(
					client.query(
						"INSERT INTO jobs(id,type) VALUES($1,'unknown_writer')",
						[randomUUID()],
					),
				).rejects.toThrow();
			} finally {
				await client.query("ROLLBACK");
				client.release();
			}
		},
	);
	it.runIf(!!process.env.BATCH_TEST_POSTGRES_PORT)(
		"samples catalog statistics without scanning jobs",
		async () => {
			await repo.initialize();
			const sample = await repo.sampleActivity();
			expect(sample).toMatchObject({
				database: "batch_run_test",
				trackCounts: true,
			});
			expect(sample.tableOid).toMatch(/^\d+$/);
		},
	);
});
