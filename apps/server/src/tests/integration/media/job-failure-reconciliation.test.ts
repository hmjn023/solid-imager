import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createJobRepository } from "@solid-imager/db/repositories/job-repository";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import { batchParentJobTypes } from "@solid-imager/core/domain/jobs/schemas";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import * as schema from "@solid-imager/db/schema";
import { createPglite } from "~/infrastructure/db/pglite";

describe("job failure and batch parent reconciliation", () => {
	let directory: string;
	let local: ReturnType<typeof createPglite> | undefined;
	let postgres: Pool | undefined;
	let database: DrizzleExecutor;
	const executor = (tx?: Transaction) => (tx ?? database) as DrizzleExecutor;
	const repo = createJobRepository(executor);
	beforeAll(async () => {
		const port = process.env.JOB_FAILURE_TEST_POSTGRES_PORT;
		if (port) {
			if (!/^\d+$/.test(port) || Number(port) <= 1024 || Number(port) > 65535)
				throw new Error("Invalid isolated PostgreSQL port");
			postgres = new Pool({
				host: "127.0.0.1",
				port: Number(port),
				user: "job_test",
				password: "ephemeral_job_test",
				database: "job_failure_test",
				max: 8,
			});
			const pg = drizzlePostgres(postgres, { schema });
			await migratePostgres(pg, { migrationsFolder: path.resolve("drizzle") });
			database = pg;
		} else {
			directory = await mkdtemp(path.join(tmpdir(), "job-failure-"));
			local = createPglite(directory);
			const pg = drizzle(local, { schema });
			await migrate(pg, { migrationsFolder: path.resolve("drizzle") });
			database = pg;
		}
	}, 30_000);
	beforeEach(async () => {
		await database.delete(schema.jobs);
	});
	afterAll(async () => {
		await local?.close();
		await postgres?.end();
		if (directory) await rm(directory, { recursive: true, force: true });
	});
	async function fixture(type: string = "bulk_tagging_parent") {
		const parent = await repo.create({
			type,
			status: "in_progress",
			payload: { total: 2, processed: 0, failed: 0 },
		});
		const child = await repo.create({
			type: "unknown_child",
			parentId: parent.id,
			status: "in_progress",
			attemptCount: 1,
		});
		return { parent, child };
	}
	it.each(batchParentJobTypes)(
		"atomically fails the current child and its %s parent",
		async (type) => {
			const { parent, child } = await fixture(type);
			expect(await repo.markAsFailed(child.id, "Invalid job payload", 1)).toBe(
				true,
			);
			expect(await repo.findById(child.id)).toMatchObject({
				status: "failed",
				error: "Invalid job payload",
				finishedAt: expect.any(Date),
			});
			expect(await repo.findById(parent.id)).toMatchObject({
				status: "failed",
				error: "Batch job failed",
				finishedAt: expect.any(Date),
				payload: parent.payload,
			});
		},
	);
	it("does not let an old attempt or a duplicate failure affect the parent", async () => {
		const { parent, child } = await fixture();
		expect(await repo.markAsFailed(child.id, "stale", 0)).toBe(false);
		expect(await repo.findById(parent.id)).toEqual(parent);
		expect(await repo.markAsFailed(child.id, "first", 1)).toBe(true);
		const failed = await repo.findById(parent.id);
		expect(await repo.markAsFailed(child.id, "duplicate", 1)).toBe(false);
		expect(await repo.findById(parent.id)).toEqual(failed);
	});
	it("preserves a pending child cancellation", async () => {
		const { parent, child } = await fixture();
		await repo.requestCancellation(child.id);
		expect(await repo.markAsFailed(child.id, "failure", 1)).toBe(false);
		expect(await repo.findById(parent.id)).toEqual(parent);
	});
	it("preserves parent cancellation across failure and late finalizers", async () => {
		const { parent, child } = await fixture();
		await repo.update(parent.id, {
			status: "cancelled",
			cancelRequestedAt: new Date(),
		});
		expect(await repo.markAsFailed(child.id, "failure", 1)).toBe(true);
		await repo.update(parent.id, { status: "completed" });
		await repo.update(parent.id, { status: "failed" });
		expect((await repo.findById(parent.id))?.status).toBe("cancelled");
	});
	it("corrects premature parent completion and keeps failure terminal", async () => {
		const { parent, child } = await fixture();
		await repo.update(parent.id, { status: "completed" });
		expect(await repo.markAsFailed(child.id, "dispatch failed", 1)).toBe(true);
		await repo.update(parent.id, { status: "completed" });
		expect((await repo.findById(parent.id))?.status).toBe("failed");
	});
	it("does not change unrelated parent types", async () => {
		const { parent, child } = await fixture("downloadImage");
		expect(await repo.markAsFailed(child.id, "failure", 1)).toBe(true);
		expect(await repo.findById(parent.id)).toEqual(parent);
	});
	it("only allows parent completion again after an explicit reset", async () => {
		const { parent, child } = await fixture();
		await repo.markAsFailed(child.id, "failure", 1);
		await repo.update(parent.id, {
			status: "in_progress",
			error: null,
			finishedAt: null,
		});
		await repo.update(parent.id, { status: "completed" });
		expect((await repo.findById(parent.id))?.status).toBe("completed");
	});
	it("allows legacy pending batch parents to finish normally", async () => {
		const { parent } = await fixture();
		await repo.update(parent.id, { status: "pending" });
		await repo.update(parent.id, { status: "completed" });
		expect((await repo.findById(parent.id))?.status).toBe("completed");
	});
	it("does not claim pending batch parents or approval requests as executable jobs", async () => {
		const { parent, child } = await fixture();
		await repo.update(parent.id, { status: "pending" });
		await repo.update(child.id, { status: "pending" });
		await repo.create({ type: "import_request", status: "pending" });
		expect((await repo.findPending(10)).map((job) => job.id)).toEqual([
			child.id,
		]);
		expect((await repo.claimPending(10)).map((job) => job.id)).toEqual([
			child.id,
		]);
		expect((await repo.findById(parent.id))?.status).toBe("pending");
	});
	it("rolls child failure back if the parent update fails", async () => {
		const { parent, child } = await fixture();
		await database.execute(
			sql`CREATE FUNCTION reject_parent_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'bulk_tagging_parent' AND NEW.status = 'failed' THEN RAISE EXCEPTION 'injected parent update failure'; END IF; RETURN NEW; END $$`,
		);
		await database.execute(
			sql`CREATE TRIGGER reject_parent_failure BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION reject_parent_failure()`,
		);
		try {
			await expect(repo.markAsFailed(child.id, "failure", 1)).rejects.toThrow();
			expect(await repo.findById(child.id)).toEqual(child);
			expect(await repo.findById(parent.id)).toEqual(parent);
		} finally {
			await database.execute(
				sql`DROP FUNCTION reject_parent_failure() CASCADE`,
			);
		}
	});
	it("keeps parent failed when independent connections race with another child's completion", async () => {
		const { parent, child } = await fixture();
		const sibling = await repo.create({
			type: "known_child",
			parentId: parent.id,
			status: "in_progress",
			attemptCount: 1,
		});
		const connections = postgres
			? await Promise.all([postgres.connect(), postgres.connect()])
			: [];
		try {
			const executors = connections.map((connection) =>
				drizzlePostgres(connection, { schema }),
			);
			const failureRepo = executors[0]
				? createJobRepository(() => executors[0])
				: repo;
			const completionRepo = executors[1]
				? createJobRepository(() => executors[1])
				: repo;
			const [failed] = await Promise.all([
				failureRepo.markAsFailed(child.id, "failure", 1),
				(async () => {
					await completionRepo.markAsCompleted(sibling.id, {}, 1);
					await completionRepo.update(parent.id, { status: "completed" });
				})(),
			]);
			expect(failed).toBe(true);
			expect((await repo.findById(parent.id))?.status).toBe("failed");
		} finally {
			for (const connection of connections) connection.release();
		}
	});
});
