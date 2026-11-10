import { call } from "@orpc/server";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRepositories, type DrizzleExecutor } from "@solid-imager/db";
import { jobs, mediaSources } from "@solid-imager/db/schema";
import * as schema from "@solid-imager/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { migrate } from "drizzle-orm/pglite/migrator";
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

const state = vi.hoisted(() => ({
	database: undefined as DrizzleExecutor | undefined,
}));
vi.mock("~/infrastructure/db", () => ({
	get db() {
		return state.database;
	},
}));
vi.mock("~/infrastructure/db/index", () => ({
	get db() {
		return state.database;
	},
}));
vi.mock("~/infrastructure/logger", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { processImportRequests, cancelImportRequests } =
	await import("~/infrastructure/services/import-queue-service");
const { importDownloadJobId } =
	await import("~/infrastructure/jobs/download-jobs");
const { importsRouter } =
	await import("~/infrastructure/api/routers/imports-router");
const { jobsRouter } = await import("~/infrastructure/api/routers/jobs-router");

let client: { exec(text: string): Promise<unknown>; close(): Promise<void> };
let database: DrizzleExecutor;
let repositories: ReturnType<typeof createRepositories>;
const SOURCE_ID = "11111111-1111-4111-8111-111111111111";

describe("persisted import, attempt and batch transitions", () => {
	beforeAll(async () => {
		const postgresUrl = process.env.STATE_TEST_POSTGRES_URL;
		if (postgresUrl) {
			if (
				new URL(postgresUrl).pathname !== "/855_state" ||
				!["127.0.0.1", "localhost"].includes(new URL(postgresUrl).hostname)
			)
				throw new Error("Use only an isolated 855_state PostgreSQL fixture");
			const pool = new Pool({ connectionString: postgresUrl, max: 4 });
			client = { exec: (text) => pool.query(text), close: () => pool.end() };
			database = drizzlePostgres(pool, { schema });
			// This dedicated database validates real independent-connection locking.
			// Production migrations are exercised by the PGlite branch; no schema changes are introduced here.
			await client.exec(`
				DROP TABLE IF EXISTS jobs, media_sources CASCADE;
				DROP TYPE IF EXISTS job_status, media_source_type, media_source_sync_status;
				CREATE TYPE job_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'cancelled');
				CREATE TYPE media_source_type AS ENUM ('local', 'sftp', 's3');
				CREATE TYPE media_source_sync_status AS ENUM ('idle', 'syncing', 'error');
				CREATE TABLE media_sources (
					id uuid PRIMARY KEY DEFAULT uuidv7(), name text NOT NULL, description text,
					type media_source_type NOT NULL, connection_info jsonb NOT NULL,
					created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
					sync_status media_source_sync_status NOT NULL DEFAULT 'idle', last_sync_started_at timestamp,
					last_sync_completed_at timestamp, last_sync_error text
				);
				CREATE TABLE jobs (
					id uuid PRIMARY KEY DEFAULT uuidv7(), type text NOT NULL,
					source_id uuid REFERENCES media_sources(id) ON DELETE CASCADE,
					status job_status NOT NULL DEFAULT 'pending', payload jsonb, result jsonb, error text,
					created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
					parent_id uuid REFERENCES jobs(id) ON DELETE CASCADE, cancel_requested_at timestamp,
					cancelled_at timestamp, attempt_count integer NOT NULL DEFAULT 0,
					started_at timestamp, finished_at timestamp, artifact_path text, artifact_file_name text,
					artifact_content_type text, artifact_size bigint, artifact_expires_at timestamp
				);
			`);
		} else {
			const pglite = createPglite();
			client = pglite;
			const pgliteDatabase = drizzle(pglite, { schema });
			database = pgliteDatabase;
			await migrate(pgliteDatabase, {
				migrationsFolder: path.resolve("drizzle"),
			});
		}
		state.database = database;
		repositories = createRepositories(() => database, {
			info: vi.fn(),
			error: vi.fn(),
		});
	}, 60000);
	afterAll(async () => {
		await client?.close();
	});
	beforeEach(async () => {
		await database.delete(jobs);
		await database.delete(mediaSources);
		await database.insert(mediaSources).values({
			id: SOURCE_ID,
			name: "State test",
			type: "local",
			connectionInfo: { path: "/tmp/855-state-test" },
		});
	});

	async function receipt(status: "pending" | "completed" = "pending") {
		return repositories.job.create({
			type: "import_request",
			status,
			payload: {
				targetUrl: "https://example.com/image.png",
				fileName: "image.png",
			},
		});
	}

	it("approves concurrent and replayed requests once and ignores unrelated or submitted rows", async () => {
		const request = await receipt();
		const submitted = await receipt("completed");
		const unrelated = await repositories.job.create({
			type: "auto_tagging",
			payload: {},
		});
		const counts = await Promise.all([
			call(importsRouter.process, {
				jobIds: [request.id, submitted.id, unrelated.id, request.id],
				targetSourceId: SOURCE_ID,
			}).then((result) => result.processedCount),
			processImportRequests([request.id], SOURCE_ID),
		]);
		expect(counts.reduce((sum, value) => sum + value, 0)).toBe(1);
		expect(await processImportRequests([request.id], SOURCE_ID)).toBe(0);
		const rows = await database.select().from(jobs);
		expect(rows.filter((job) => job.type === "downloadImage")).toEqual([
			expect.objectContaining({
				id: importDownloadJobId(request.id),
				status: "pending",
				mediaSourceId: SOURCE_ID,
			}),
		]);
		expect(await repositories.job.findById(request.id)).toMatchObject({
			status: "completed",
			result: { status: "submitted", targetSourceId: SOURCE_ID },
		});
		expect(await repositories.job.findById(unrelated.id)).toMatchObject({
			status: "pending",
			type: "auto_tagging",
		});
		await call(importsRouter.cancel, {
			jobIds: [request.id, submitted.id, unrelated.id],
		});
		expect((await database.select().from(jobs)).length).toBe(4);
	});

	it("orders concurrent approval and cancellation without an orphaned download", async () => {
		const request = await receipt();
		await Promise.all([
			processImportRequests([request.id], SOURCE_ID),
			cancelImportRequests([request.id]),
		]);
		const row = await repositories.job.findById(request.id);
		const download = await repositories.job.findById(
			importDownloadJobId(request.id),
		);
		if (row) {
			expect(row.status).toBe("completed");
			expect(download).not.toBeNull();
		} else expect(download).toBeNull();
	});

	it("rolls back queue insertion and approval together when confirming the receipt fails", async () => {
		const request = await receipt();
		await client.exec(
			`CREATE FUNCTION reject_import_confirmation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'import_request' AND NEW.status = 'completed' THEN RAISE EXCEPTION 'injected receipt failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_import_confirmation BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION reject_import_confirmation();`,
		);
		try {
			await expect(
				processImportRequests([request.id], SOURCE_ID),
			).rejects.toThrow();
			expect(await repositories.job.findById(request.id)).toMatchObject({
				status: "pending",
			});
			expect(
				await repositories.job.findById(importDownloadJobId(request.id)),
			).toBeNull();
		} finally {
			await client.exec(
				"DROP TRIGGER reject_import_confirmation ON jobs; DROP FUNCTION reject_import_confirmation();",
			);
		}
	});

	it.each(["completed", "failed"] as const)(
		"resolves a cancellation arriving before %s CAS to terminal cancelled",
		async (status) => {
			const job = await repositories.job.create({
				type: "processMedia",
				status: "in_progress",
				attemptCount: 2,
				payload: {},
			});
			await repositories.job.requestCancellation(job.id);
			const outcome =
				status === "completed"
					? { status, result: { ok: true } }
					: { status, error: "processor failed" };
			expect(await repositories.job.finishAttempt(job.id, 2, outcome)).toBe(
				"cancelled",
			);
			expect(await repositories.job.findById(job.id)).toMatchObject({
				status: "cancelled",
				finishedAt: expect.any(Date),
				cancelledAt: expect.any(Date),
			});
		},
	);

	it("does not let an old attempt finalize a newer claim", async () => {
		const job = await repositories.job.create({
			type: "processMedia",
			status: "in_progress",
			attemptCount: 2,
		});
		expect(
			await repositories.job.finishAttempt(job.id, 1, {
				status: "failed",
				error: "old",
			}),
		).toBeNull();
		expect(await repositories.job.findById(job.id)).toMatchObject({
			status: "in_progress",
			attemptCount: 2,
			error: null,
		});
		expect(
			await repositories.job.finishAttempt(job.id, 2, {
				status: "completed",
				result: {},
			}),
		).toBe("completed");
		await repositories.job.requestCancellation(job.id);
		expect(await repositories.job.findById(job.id)).toMatchObject({
			status: "completed",
			cancelRequestedAt: null,
		});
	});

	it("does not claim legacy pending parents even when explicitly included", async () => {
		const parent = await repositories.job.create({
			type: "bulk_tagging_parent",
			status: "pending",
			payload: { total: 1, processed: 0, failed: 0 },
		});
		expect(
			await repositories.job.findPending(10, {
				includeTypes: ["bulk_tagging_parent"],
			}),
		).toEqual([]);
		expect(
			await repositories.job.claimPending(10, {
				includeTypes: ["bulk_tagging_parent"],
			}),
		).toEqual([]);
		expect(await repositories.job.findById(parent.id)).toMatchObject({
			status: "pending",
		});
	});

	it("rolls back a parent when dispatch insertion fails", async () => {
		await expect(
			repositories.job.createBatch(
				{
					type: "bulk_tagging_parent",
					status: "in_progress",
					payload: { total: 0, processed: 0, failed: 0 },
				},
				{
					type: "bulk_tagging_dispatch",
					mediaSourceId: randomUUID(),
					payload: {},
				},
			),
		).rejects.toThrow();
		expect(await database.select().from(jobs)).toEqual([]);
	});

	it("keeps retry and duplicate child progress idempotent and a terminal batch immutable", async () => {
		const parent = await repositories.job.createBatch(
			{
				type: "bulk_tagging_parent",
				status: "in_progress",
				payload: { total: 1, processed: 0, failed: 0 },
			},
			{ type: "bulk_tagging_dispatch", payload: {} },
		);
		const child = await repositories.job.create({
			type: "auto_tagging",
			parentId: parent.id,
			status: "in_progress",
			attemptCount: 1,
		});
		expect(
			await repositories.job.recordBatchChildOutcome(
				parent.id,
				child.id,
				1,
				0,
				1,
			),
		).toMatchObject({ processed: 0, failed: 1 });
		expect(
			await repositories.job.recordBatchChildOutcome(
				parent.id,
				child.id,
				1,
				0,
				1,
			),
		).toMatchObject({ processed: 0, failed: 1 });
		await repositories.job.update(child.id, { attemptCount: 2 });
		expect(
			await repositories.job.recordBatchChildOutcome(
				parent.id,
				child.id,
				1,
				1,
				0,
			),
		).toBeNull();
		expect(
			await repositories.job.recordBatchChildOutcome(
				parent.id,
				child.id,
				2,
				1,
				0,
			),
		).toMatchObject({ processed: 1, failed: 0 });
		expect(await repositories.job.finishBatch(parent.id)).toBeNull();
		await repositories.job.finishAttempt(child.id, 2, {
			status: "completed",
			result: {},
		});
		const dispatch = (
			await database.select().from(jobs).where(eq(jobs.parentId, parent.id))
		).find((job) => job.type === "bulk_tagging_dispatch");
		if (!dispatch) throw new Error("Expected batch dispatch");
		await repositories.job.update(dispatch.id, {
			status: "in_progress",
			attemptCount: 1,
		});
		await repositories.job.finishAttempt(dispatch.id, 1, {
			status: "completed",
			result: {},
		});
		expect(await repositories.job.finishBatch(parent.id)).toBe("completed");
		expect(
			await repositories.job.recordBatchChildOutcome(
				parent.id,
				child.id,
				2,
				0,
				1,
			),
		).toBeNull();
		expect(await repositories.job.finishBatch(parent.id)).toBeNull();
		expect(await repositories.job.findById(parent.id)).toMatchObject({
			status: "completed",
			payload: expect.objectContaining({ processed: 1, failed: 0 }),
		});
	});

	it("preserves contributions recorded by the previous handler before an interrupted attempt", async () => {
		const parent = await repositories.job.create({
			type: "bulk_tagging_parent",
			status: "in_progress",
			payload: { total: 1, processed: 1, failed: 0 },
		});
		const child = await repositories.job.create({
			type: "auto_tagging",
			status: "in_progress",
			parentId: parent.id,
			attemptCount: 2,
			result: { parentProcessed: true },
		});
		expect(
			await repositories.job.recordBatchChildOutcome(
				parent.id,
				child.id,
				2,
				1,
				0,
			),
		).toMatchObject({ processed: 1, failed: 0 });
		expect(
			await repositories.job.recordBatchChildOutcome(
				parent.id,
				child.id,
				2,
				0,
				1,
			),
		).toMatchObject({ processed: 0, failed: 1 });
	});

	it("rejects generic retry of parents, children and receipts without changing them", async () => {
		const parent = await repositories.job.create({
			type: "bulk_tagging_parent",
			status: "failed",
			payload: { total: 1, processed: 0, failed: 1 },
		});
		const child = await repositories.job.create({
			type: "auto_tagging",
			parentId: parent.id,
			status: "failed",
		});
		const request = await receipt("completed");
		for (const job of [parent, child, request]) {
			await expect(
				call(jobsRouter.retry, { id: job.id }),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(await repositories.job.findById(job.id)).toMatchObject({
				status: job.status,
			});
		}
		const standalone = await repositories.job.create({
			type: "processMedia",
			status: "failed",
		});
		expect(await call(jobsRouter.retry, { id: standalone.id })).toMatchObject({
			id: standalone.id,
			status: "pending",
		});
	});

	it("publishes a nonterminal cancellation request from the actual API", async () => {
		const job = await repositories.job.create({
			type: "processMedia",
			status: "in_progress",
			attemptCount: 1,
		});
		const publish = vi.spyOn(RealtimeEventBus, "publishJob");
		try {
			expect(await call(jobsRouter.cancel, { id: job.id })).toMatchObject({
				status: "in_progress",
				finishedAt: null,
			});
			expect(publish).toHaveBeenCalledWith(
				"job-cancellation-requested",
				expect.objectContaining({ jobId: job.id }),
			);
			expect(publish).not.toHaveBeenCalledWith(
				"job-cancelled",
				expect.anything(),
			);
		} finally {
			publish.mockRestore();
		}
	});

	it("fails the aggregate when dispatch or payload handling fails before recording progress", async () => {
		const parent = await repositories.job.createBatch(
			{
				type: "bulk_tagging_parent",
				status: "in_progress",
				payload: { total: 0, processed: 0, failed: 0 },
			},
			{
				type: "bulk_tagging_dispatch",
				status: "in_progress",
				attemptCount: 1,
				payload: {},
			},
		);
		const dispatch = (
			await database.select().from(jobs).where(eq(jobs.parentId, parent.id))
		).find((job) => job.type === "bulk_tagging_dispatch");
		if (!dispatch) throw new Error("Expected batch dispatch");
		expect(
			await repositories.job.finishAttempt(dispatch.id, 1, {
				status: "failed",
				error: "bad payload",
			}),
		).toBe("failed");
		expect(await repositories.job.findById(parent.id)).toMatchObject({
			status: "failed",
			finishedAt: expect.any(Date),
		});
		expect(await repositories.job.finishBatch(parent.id)).toBeNull();
	});
});
