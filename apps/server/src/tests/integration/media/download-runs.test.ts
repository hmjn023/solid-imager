import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import {
	beforeAll,
	beforeEach,
	afterAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { DownloadRunService } from "@solid-imager/application/services/download-run-service";
import { createDownloadRunRepository } from "@solid-imager/db/repositories/download-run-repository";
import { createJobRepository } from "@solid-imager/db/repositories/job-repository";
import { createMediaRepository } from "@solid-imager/db/repositories/media-repository";
import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import { createTransactionManager } from "@solid-imager/db/transaction-manager";
import {
	DownloadAttemptLostError,
	DownloadCancelledError,
	type DownloadClaim,
	type DownloadRegistrationEntry,
} from "@solid-imager/core/domain/downloads/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import * as schema from "@solid-imager/db/schema";
import { createPglite } from "~/infrastructure/db/pglite";
import { DownloadRegistration } from "~/infrastructure/jobs/download-registration";

describe("dedicated download runs", () => {
	let directory: string;
	let base: string;
	let local: ReturnType<typeof createPglite> | undefined;
	let postgres: Pool | undefined;
	let database: DrizzleExecutor;
	// This fixture owns every DB connection and transaction passed through the opaque core port.
	const executor = (tx?: Transaction) => (tx ?? database) as DrizzleExecutor;
	const repo = createDownloadRunRepository(executor);
	const jobs = createJobRepository(executor);
	const sources = createSourceRepository(executor);
	const media = createMediaRepository(executor);
	const transactions = createTransactionManager(executor);
	const notify = vi.fn();
	const service = new DownloadRunService({
		repo,
		transactions,
		alreadyStored: async () => false,
		notify,
	});
	const item = {
		targetUrl: "https://example.invalid/image.png",
		sourceUrls: ["https://example.invalid/recovery/1"],
	};
	let sourceId: string;
	const postgresOptions = () => ({
		host: "127.0.0.1",
		port: Number(process.env.DOWNLOAD_TEST_POSTGRES_PORT),
		user: "download_test",
		password: "ephemeral_download_test",
		database: "download_run_test",
		max: 8,
	});
	beforeAll(async () => {
		base = await mkdtemp(path.join(tmpdir(), "download-files-"));
		const port = process.env.DOWNLOAD_TEST_POSTGRES_PORT;
		if (port) {
			if (!/^\d+$/.test(port) || Number(port) <= 1024 || Number(port) > 65535)
				throw new Error("Invalid isolated PostgreSQL port");
			postgres = new Pool(postgresOptions());
			const db = drizzlePostgres(postgres, { schema });
			await migratePostgres(db, { migrationsFolder: path.resolve("drizzle") });
			database = db;
		} else {
			directory = await mkdtemp(path.join(tmpdir(), "download-runs-"));
			local = createPglite(directory);
			const db = drizzle(local, { schema });
			await migrate(db, { migrationsFolder: path.resolve("drizzle") });
			database = db;
		}
	}, 30_000);
	beforeEach(async () => {
		vi.restoreAllMocks();
		notify.mockReset();
		await database
			.update(schema.downloadRunCutovers)
			.set({ authority: "legacy", generation: 0 });
		await database
			.delete(schema.downloadRuns)
			.where(eq(schema.downloadRuns.status, "superseded"));
		await database.delete(schema.downloadRuns);
		await database.delete(schema.jobs);
		await database.delete(schema.mediaSources);
		sourceId = (
			await sources.create({
				name: "Download target",
				description: null,
				type: "local",
				connectionInfo: { path: base },
			})
		).id;
	});
	afterAll(async () => {
		await local?.close();
		await postgres?.end();
		if (directory) await rm(directory, { recursive: true, force: true });
		await rm(base, { recursive: true, force: true });
	});
	async function add(input = item) {
		return (await service.enqueue(sourceId, [input])).runIds[0];
	}
	async function claim() {
		const [run] = await repo.claimPending(1);
		if (!run) throw new Error("No due download claim");
		return run;
	}
	async function expire(id: string) {
		await database
			.update(schema.downloadRuns)
			.set({
				leaseExpiresAt: sql`timezone('UTC', clock_timestamp()) - interval '1 second'`,
			})
			.where(eq(schema.downloadRuns.id, id));
	}
	async function register(entry: DownloadRegistrationEntry, tx: Transaction) {
		const registered = await media.create(
			{
				mediaSourceId: sourceId,
				filePath: entry.filePath,
				fileName: path.basename(entry.filePath),
				fileSize: entry.fileSize,
				mediaType: "image",
				description: null,
				width: 1,
				height: 1,
				createdAt: entry.modifiedAt,
				modifiedAt: entry.modifiedAt,
			},
			tx,
		);
		await media.addUrls(registered.id, entry.context.sourceUrls, tx);
		return registered;
	}
	async function prepare(run: DownloadClaim) {
		const handoff = new DownloadRegistration(
			run,
			sourceId,
			base,
			repo,
			register,
		);
		await handoff.prepare();
		const filePath = `${randomUUID()}.png`;
		const stagedPath = path.join(handoff.stagingDirectory, filePath);
		await writeFile(stagedPath, "completed image bytes");
		const file = await stat(stagedPath);
		const entry: DownloadRegistrationEntry = {
			stagedPath,
			filePath,
			fileSize: file.size,
			modifiedAt: file.mtime,
			published: false,
			context: { sourceUrls: [...item.sourceUrls, item.targetUrl] },
		};
		return { handoff, entry };
	}
	it("reserves outside jobs and returns only a safe public state", async () => {
		const id = (
			await service.enqueue(sourceId, [
				{
					...item,
					cookies: [{ name: "auth", value: "server-private" }],
					userAgent: "private-agent",
				},
			])
		).runIds[0];
		expect(await database.select().from(schema.jobs)).toHaveLength(0);
		expect((await repo.findById(id))?.input).toMatchObject({
			cookies: [{ value: "server-private" }],
			userAgent: "private-agent",
		});
		expect(JSON.stringify(await service.get(id))).not.toMatch(
			/server-private|private-agent|cookies|userAgent|leaseToken|sourcePath|checkpoint/,
		);
		expect((await repo.findById(id))?.nextRunAt.getTime()).toBeLessThanOrEqual(
			Date.now() + 1000,
		);
	});
	it("deduplicates active input atomically while retaining separate receipts", async () => {
		const results = await Promise.all([
			service.enqueue(sourceId, [item]),
			service.enqueue(sourceId, [item]),
		]);
		expect(results.reduce((sum, row) => sum + row.jobCount, 0)).toBe(1);
		const rows = await database.select().from(schema.downloadRuns);
		expect(rows.map((row) => row.status).sort()).toEqual([
			"pending",
			"superseded",
		]);
		expect(new Set(results.flatMap((row) => row.runIds)).size).toBe(2);
	});
	it("merges legacy empty descriptions with equivalent newly omitted descriptions", async () => {
		await jobs.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: { ...item, description: "" },
		});
		expect(await service.enqueue(sourceId, [item])).toMatchObject({
			jobCount: 0,
			skippedCount: 1,
		});
		expect(await repo.claimPending(10)).toHaveLength(1);
	});
	it.skipIf(!process.env.DOWNLOAD_TEST_POSTGRES_PORT)(
		"fences a legacy producer using a transaction snapshot taken before cutover",
		async () => {
			const old = await postgres?.connect();
			if (!old) throw new Error("Missing isolated PostgreSQL connection");
			try {
				await old.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
				await old.query("SELECT authority FROM download_run_cutovers");
				await repo.ensureCutover();
				await expect(
					old.query(
						"INSERT INTO jobs (type, source_id, payload) VALUES ($1, $2, $3)",
						["downloadImage", sourceId, JSON.stringify(item)],
					),
				).rejects.toMatchObject({ code: "40001" });
			} finally {
				await old.query("ROLLBACK");
				old.release();
			}
			expect(await database.select().from(schema.jobs)).toHaveLength(0);
		},
	);
	it("claims once through concurrent independent PostgreSQL connections", async () => {
		const id = await add();
		const first = await postgres?.connect();
		const second = await postgres?.connect();
		try {
			if (first && second)
				expect(
					(await first.query<{ pid: number }>("SELECT pg_backend_pid() AS pid"))
						.rows[0].pid,
				).not.toBe(
					(
						await second.query<{ pid: number }>(
							"SELECT pg_backend_pid() AS pid",
						)
					).rows[0].pid,
				);
			const dbA = first ? drizzlePostgres(first, { schema }) : database;
			const dbB = second ? drizzlePostgres(second, { schema }) : database;
			const a = createDownloadRunRepository(
				(tx) => (tx ?? dbA) as DrizzleExecutor,
			);
			const b = createDownloadRunRepository(
				(tx) => (tx ?? dbB) as DrizzleExecutor,
			);
			const claims = (
				await Promise.all([a.claimPending(1), b.claimPending(1)])
			).flat();
			expect(claims).toHaveLength(1);
			expect(claims[0]).toMatchObject({
				id,
				attemptCount: 1,
				status: "in_progress",
			});
		} finally {
			first?.release();
			second?.release();
		}
	});
	it("reclaims expired leases and rejects every stale mutation", async () => {
		const id = await add();
		const first = await claim();
		await expire(id);
		const second = await claim();
		expect(second.attemptCount).toBe(2);
		expect(second.leaseToken).not.toBe(first.leaseToken);
		expect(await repo.heartbeat(first)).toBe(false);
		expect(await repo.settle(first, "failed", "late failure")).toBeNull();
		await expect(
			repo.withActiveClaim(first, async () => undefined),
		).rejects.toThrow(DownloadAttemptLostError);
		expect(await repo.findById(id)).toMatchObject({
			leaseToken: second.leaseToken,
			status: "in_progress",
			error: null,
		});
	});
	it("stops automatic crash retries at the attempt budget and supports explicit retry", async () => {
		const id = await add();
		for (let attempt = 0; attempt < 3; attempt++) {
			await claim();
			await expire(id);
		}
		expect(await repo.claimPending(1)).toHaveLength(0);
		expect(await repo.findById(id)).toMatchObject({
			status: "failed",
			attemptCount: 3,
		});
		await service.retry(id);
		expect((await claim()).attemptCount).toBe(4);
	});
	it("does not claim a run before its scheduled retry time", async () => {
		const id = await add();
		await database
			.update(schema.downloadRuns)
			.set({
				nextRunAt: sql`timezone('UTC', clock_timestamp()) + interval '1 hour'`,
			})
			.where(eq(schema.downloadRuns.id, id));
		expect(await repo.claimPending(1)).toHaveLength(0);
	});
	it("cancels pending runs without execution and fences a running cancellation", async () => {
		const id = await add();
		await service.cancel(id);
		expect(await repo.claimPending(1)).toHaveLength(0);
		const runningId = await add();
		const running = await claim();
		await service.cancel(runningId);
		await expect(
			repo.withActiveClaim(running, async () => undefined),
		).rejects.toThrow(DownloadCancelledError);
		expect(await repo.heartbeat(running)).toBe(false);
		expect(await repo.settle(running, "failed", "interrupted")).toMatchObject({
			status: "cancelled",
			error: null,
		});
	});
	it("serializes cancellation against terminal completion", async () => {
		const id = await add();
		const run = await claim();
		const { handoff, entry } = await prepare(run);
		await handoff.complete([entry]);
		const outcomes = await Promise.allSettled([
			repo.cancel(id),
			repo.settle(run, "completed"),
		]);
		expect(outcomes.some((outcome) => outcome.status === "fulfilled")).toBe(
			true,
		);
		expect(["cancelled", "completed"]).toContain(
			(await repo.findById(id))?.status,
		);
		expect(await database.select().from(schema.medias)).toHaveLength(1);
	});
	it("rejects retry when an equivalent run already owns the active key", async () => {
		const id = await add();
		const failed = await claim();
		await repo.settle(failed, "failed", "network unavailable");
		await add();
		await expect(service.retry(id)).rejects.toThrow("already active");
		expect((await repo.findById(id))?.status).toBe("failed");
	});
	it("keeps committed cancellation even if notification delivery fails", async () => {
		const id = await add();
		notify.mockImplementation(() => {
			throw new Error("listener");
		});
		await expect(service.cancel(id)).resolves.toMatchObject({
			status: "cancelled",
		});
	});
	it("recovers pending requests after reopening the database without events", async () => {
		const id = await add();
		if (postgres) {
			await postgres.end();
			postgres = new Pool(postgresOptions());
			database = drizzlePostgres(postgres, { schema });
		} else {
			await local?.close();
			local = createPglite(directory);
			database = drizzle(local, { schema });
		}
		expect(await service.get(id)).toMatchObject({ id, status: "pending" });
	});
	it("preserves old IDs and snapshots, resolving duplicates and invalid input", async () => {
		const first = await jobs.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: item,
		});
		const duplicate = await jobs.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: JSON.stringify(item),
		});
		const invalid = await jobs.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: "invalid",
		});
		expect(await repo.ensureCutover()).toEqual({
			migrated: 3,
			aliases: 1,
			blocked: 1,
		});
		expect(await repo.ensureCutover()).toEqual({
			migrated: 0,
			aliases: 0,
			blocked: 0,
		});
		expect((await repo.findById(invalid.id))?.status).toBe("blocked");
		expect(
			new Set(
				(await database.select().from(schema.downloadRuns)).map(
					(row) => row.id,
				),
			),
		).toEqual(new Set([first.id, duplicate.id, invalid.id]));
		expect(
			await database.select().from(schema.downloadRunLegacySnapshots),
		).toHaveLength(3);
		expect(await database.select().from(schema.jobs)).toHaveLength(0);
		expect(await repo.claimPending(10)).toHaveLength(1);
	});
	it("backfills more than one keyset page without losing rows", async () => {
		const original = await database
			.insert(schema.jobs)
			.values(
				Array.from({ length: 251 }, (_, index) => ({
					type: "downloadImage",
					mediaSourceId: sourceId,
					payload: { targetUrl: `https://example.invalid/${index}.png` },
				})),
			)
			.returning();
		expect(await repo.ensureCutover()).toEqual({
			migrated: 251,
			aliases: 0,
			blocked: 0,
		});
		expect(
			new Set(
				(await database.select().from(schema.downloadRuns)).map(
					(row) => row.id,
				),
			),
		).toEqual(new Set(original.map((row) => row.id)));
		expect(
			await database.select().from(schema.downloadRunLegacySnapshots),
		).toHaveLength(251);
	}, 20_000);
	it("quarantines an invalid checkpoint instead of redownloading an equivalent empty request", async () => {
		const empty = await jobs.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: item,
		});
		const invalid = await jobs.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: { ...item, downloadRegistration: {} },
		});
		expect((await repo.ensureCutover()).blocked).toBe(2);
		expect((await repo.findById(empty.id))?.status).toBe("blocked");
		expect((await repo.findById(invalid.id))?.status).toBe("blocked");
		expect(await repo.claimPending(10)).toHaveLength(0);
	});
	it("fails cutover if the private snapshot shadow comparison differs", async () => {
		const old = await jobs.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: item,
		});
		await database.execute(
			sql`CREATE FUNCTION corrupt_download_shadow() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.snapshot = jsonb_set(NEW.snapshot, '{type}', '"tampered"'::jsonb); RETURN NEW; END $$`,
		);
		await database.execute(
			sql`CREATE TRIGGER corrupt_download_shadow BEFORE INSERT ON download_run_legacy_snapshots FOR EACH ROW EXECUTE FUNCTION corrupt_download_shadow()`,
		);
		try {
			await expect(repo.ensureCutover()).rejects.toThrow("shadow mismatch");
			expect(await jobs.findById(old.id)).toEqual(old);
			expect(await database.select().from(schema.downloadRuns)).toHaveLength(0);
		} finally {
			await database.execute(
				sql`DROP TRIGGER corrupt_download_shadow ON download_run_legacy_snapshots`,
			);
			await database.execute(sql`DROP FUNCTION corrupt_download_shadow()`);
		}
	});
	it("rolls interrupted final authority updates back after legacy deletion", async () => {
		const old = await jobs.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: item,
		});
		await database.execute(
			sql`CREATE FUNCTION fail_download_epoch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.authority = 'dedicated' THEN RAISE EXCEPTION 'isolated epoch failure'; END IF; RETURN NEW; END $$`,
		);
		await database.execute(
			sql`CREATE TRIGGER fail_download_epoch BEFORE UPDATE ON download_run_cutovers FOR EACH ROW EXECUTE FUNCTION fail_download_epoch()`,
		);
		try {
			await expect(repo.ensureCutover()).rejects.toMatchObject({
				cause: { message: expect.stringContaining("isolated epoch failure") },
			});
			expect(await jobs.findById(old.id)).toEqual(old);
			expect(await database.select().from(schema.downloadRuns)).toHaveLength(0);
		} finally {
			await database.execute(
				sql`DROP TRIGGER fail_download_epoch ON download_run_cutovers`,
			);
			await database.execute(sql`DROP FUNCTION fail_download_epoch()`);
		}
	});
	it("serializes competing cutover operations and rejects retired legacy producers", async () => {
		await jobs.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: item,
		});
		expect(
			(await Promise.all([repo.ensureCutover(), repo.ensureCutover()])).reduce(
				(sum, report) => sum + report.migrated,
				0,
			),
		).toBe(1);
		await expect(
			jobs.create({
				type: "downloadImage",
				mediaSourceId: sourceId,
				payload: item,
			}),
		).rejects.toMatchObject({
			cause: { message: expect.stringContaining("retired") },
		});
	});
	it("never lets the generic worker claim or stale-recover a download", async () => {
		const legacy = await jobs.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: item,
			status: "in_progress",
			updatedAt: new Date(0),
		});
		await jobs.requeueStaleInProgress(new Date());
		expect((await jobs.findById(legacy.id))?.status).toBe("in_progress");
		await jobs.update(legacy.id, { status: "pending" });
		expect(await jobs.claimPending(10)).toHaveLength(0);
	});
	it("restores native and legacy rows without making completed downloads pending", async () => {
		const legacy = await jobs.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: item,
			status: "completed",
		});
		const id = await add();
		const completed = await claim();
		const { handoff, entry } = await prepare(completed);
		await handoff.complete([entry]);
		await repo.settle(completed, "completed");
		const pending = await add({
			...item,
			targetUrl: "https://example.invalid/next.png",
		});
		expect(await repo.rollback()).toBe(3);
		expect((await jobs.findById(legacy.id))?.status).toBe("completed");
		expect((await jobs.findById(id))?.status).toBe("completed");
		expect((await jobs.findById(pending))?.status).toBe("pending");
		await expect(repo.ensureCutover()).rejects.toThrow("rolled back");
	});
	it("refuses rollback while a worker still owns a live lease", async () => {
		const id = await add();
		const run = await claim();
		await expect(repo.rollback()).rejects.toThrow("live leases");
		await expire(id);
		expect(await repo.rollback()).toBe(1);
		expect((await jobs.findById(id))?.status).toBe("pending");
		await expect(
			repo.withActiveClaim(run, async () => undefined),
		).rejects.toThrow("disabled");
	});
	it("does not overwrite conflicting jobs or partly switch authority on rollback", async () => {
		const id = await add();
		await jobs.create({
			id,
			type: "source_restore",
			mediaSourceId: sourceId,
			payload: {},
		});
		await expect(repo.rollback()).rejects.toThrow();
		expect((await jobs.findById(id))?.type).toBe("source_restore");
		expect(
			(await database.select().from(schema.downloadRunCutovers))[0],
		).toMatchObject({ authority: "dedicated", generation: 1 });
	});
	it("rejects an expired attempt before publishing and resumes its saved completed bytes", async () => {
		await add();
		const old = await claim();
		const { handoff, entry } = await prepare(old);
		const original = repo.withActiveClaim.bind(repo);
		let reclaimed: DownloadClaim | undefined;
		vi.spyOn(repo, "withActiveClaim")
			.mockImplementationOnce(original)
			.mockImplementationOnce(async (current, action) => {
				await expire(current.id);
				reclaimed = await claim();
				return original(current, action);
			});
		await expect(handoff.complete([entry])).rejects.toThrow(
			DownloadAttemptLostError,
		);
		await expect(stat(path.join(base, entry.filePath))).rejects.toMatchObject({
			code: "ENOENT",
		});
		if (!reclaimed) throw new Error("Missing reclaimed lease");
		expect(
			await new DownloadRegistration(
				reclaimed,
				sourceId,
				base,
				repo,
				register,
			).resume(),
		).toBe(true);
		expect(await repo.settle(old, "failed", "late")).toBeNull();
		expect(await repo.settle(reclaimed, "completed")).toMatchObject({
			status: "completed",
		});
		expect(await database.select().from(schema.medias)).toHaveLength(1);
		expect(await database.select().from(schema.mediaUrls)).toHaveLength(2);
	});
	it("rejects source path changes before publication", async () => {
		await add();
		const run = await claim();
		const { handoff, entry } = await prepare(run);
		await sources.update(sourceId, {
			connectionInfo: { path: "/changed-download-target" },
		});
		await expect(handoff.complete([entry])).rejects.toThrow("source changed");
		await expect(stat(path.join(base, entry.filePath))).rejects.toMatchObject({
			code: "ENOENT",
		});
	});
});
