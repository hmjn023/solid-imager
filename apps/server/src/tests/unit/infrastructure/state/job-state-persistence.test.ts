import { call } from "@orpc/server";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { randomUUID } from "node:crypto";
import {
	relations,
	createImportBatch,
	createRepositories,
	type DrizzleExecutor,
} from "@solid-imager/db";
import { jobs, mediaSources } from "@solid-imager/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
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
import { MIGRATIONS_DIR } from "~/tests/paths";
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
			database = drizzlePostgres({ client: pool, relations });
			// This dedicated database validates real independent-connection locking.
			// Production migrations are exercised by the PGlite branch; no schema changes are introduced here.
			await client.exec(`
				DROP TABLE IF EXISTS jobs, media, media_sources CASCADE;
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
				CREATE TABLE media (
					id uuid PRIMARY KEY DEFAULT uuidv7(),
					source_id uuid NOT NULL REFERENCES media_sources(id) ON DELETE CASCADE,
					file_name text NOT NULL, modified_at timestamp NOT NULL DEFAULT now()
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
			const pgliteDatabase = drizzle({ client: pglite, relations });
			database = pgliteDatabase;
			await migrate(pgliteDatabase, {
				migrationsFolder: MIGRATIONS_DIR,
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

	it("filters statuses and types before pagination and uses the same visibility rules for totals", async () => {
		const statuses = [
			"pending",
			"in_progress",
			"completed",
			"failed",
			"cancelled",
		] as const;
		for (const status of statuses) {
			await database.insert(jobs).values([
				{ type: "processMedia", status },
				{ type: "source_export", status },
				{ type: "import_batch_target", status },
				{
					type: "hidden_child",
					status,
					payload: { importBatchId: randomUUID() },
				},
			]);
		}
		// New completed work must not hide older active work behind a page boundary.
		await database.insert(jobs).values(
			Array.from({ length: 205 }, () => ({
				type: "processMedia",
				status: "completed" as const,
			})),
		);
		expect(await call(jobsRouter.types, undefined)).toEqual([
			"processMedia",
			"source_export",
		]);
		for (const status of [...statuses, "active"] as const) {
			const expected =
				status === "active" ? 4 : status === "completed" ? 207 : 2;
			const first = await call(jobsRouter.list, {
				status,
				limit: 1,
				offset: 0,
			});
			const second = await call(jobsRouter.list, {
				status,
				limit: 1,
				offset: 1,
			});
			expect(first.total).toBe(expected);
			expect(second.total).toBe(expected);
			expect(first.items).toHaveLength(1);
			expect(second.items[0].id).not.toBe(first.items[0].id);
			for (const item of [...first.items, ...second.items])
				expect(
					status === "active" ? ["pending", "in_progress"] : [status],
				).toContain(item.status);
			const typed = await call(jobsRouter.list, {
				status,
				type: "source_export",
				limit: 200,
				offset: 0,
			});
			expect(typed.total).toBe(status === "active" ? 2 : 1);
			expect(typed.items).toHaveLength(typed.total);
			expect(typed.items.every((job) => job.type === "source_export")).toBe(
				true,
			);
		}
		expect(
			await call(jobsRouter.list, { type: "missing", limit: 200, offset: 0 }),
		).toEqual({ items: [], total: 0 });
		expect((await call(jobsRouter.list, { limit: 1, offset: 0 })).total).toBe(
			215,
		);
	});

	it("orders the whole list by processing stage before pagination, keeping parallel work together", async () => {
		const date = (day: number) => new Date(Date.UTC(2026, 0, day));
		const id = (index: number) =>
			`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
		const entries = [
			{ type: "extract_ccip_vector", status: "pending" },
			{ type: "extract_embedding_vector", status: "pending" },
			{ type: "auto_tagging", status: "pending" },
			{ type: "downloadImage", status: "pending" },
			{ type: "generate_thumbnail", status: "pending" },
			{ type: "processMedia", status: "pending" },
			{ type: "extract_ccip_vector", status: "in_progress" },
			{ type: "auto_tagging", status: "completed", finishedAt: date(18) },
			{ type: "processMedia", status: "failed", finishedAt: date(20) },
			{ type: "downloadImage", status: "cancelled", cancelledAt: date(19) },
			{ type: "generate_thumbnail", status: "pending" },
			{ type: "downloadImage", status: "in_progress" },
			{ type: "import_request", status: "pending" },
		] as const;
		await database.insert(jobs).values(
			entries.map((entry, index) => ({
				...entry,
				id: id(index),
				createdAt: date(index + 1),
				updatedAt: date(index + 1),
			})),
		);
		const expected = [11, 6, 3, 4, 5, 10, 2, 1, 0, 12, 8, 9, 7].map(id);
		const list = () => call(jobsRouter.list, { limit: 200, offset: 0 });
		expect((await list()).items.map((job) => job.id)).toEqual(expected);
		const paged: string[] = [];
		for (let offset = 0; offset < expected.length; offset += 3) {
			const page = await call(jobsRouter.list, { limit: 3, offset });
			expect(page.total).toBe(entries.length);
			paged.push(...page.items.map((job) => job.id));
		}
		expect(paged).toEqual(expected);
		const active = await call(jobsRouter.list, {
			status: "active",
			limit: 200,
			offset: 0,
		});
		expect(active.items.map((job) => job.id)).toEqual(expected.slice(0, 10));
		const thumbnails = await call(jobsRouter.list, {
			type: "generate_thumbnail",
			limit: 200,
			offset: 0,
		});
		expect(thumbnails.items.map((job) => job.id)).toEqual([id(4), id(10)]);
		// Progress/heartbeat writes cannot reshuffle active rows.
		await database
			.update(jobs)
			.set({
				updatedAt: date(30),
				payload: { processed: 1, failed: 0, total: 3 },
			})
			.where(eq(jobs.id, id(3)));
		expect((await list()).items.map((job) => job.id)).toEqual(expected);
	});

	it("groups batch parents with their inference stage and preserves standalone AI priority", async () => {
		const date = (day: number) => new Date(Date.UTC(2026, 0, day));
		const parentTypes = [
			"batch_ccip_parent",
			"batch_embedding_parent",
			"bulk_tagging_parent",
			"import_batch_parent",
			"thumbnail_generation_parent",
		];
		const parents = await database
			.insert(jobs)
			.values(
				parentTypes.map((type, index) => ({
					type,
					status: "in_progress" as const,
					createdAt: date(index + 1),
				})),
			)
			.returning();
		await database.insert(jobs).values([
			{
				type: "auto_tagging",
				status: "pending",
				parentId: parents[2].id,
				createdAt: date(1),
			},
			{ type: "auto_tagging", status: "pending", createdAt: date(10) },
			{
				type: "extract_embedding_batch",
				status: "pending",
				createdAt: date(1),
			},
		]);
		const list = await call(jobsRouter.list, { limit: 200, offset: 0 });
		expect(list.items.slice(0, 5).map((job) => job.type)).toEqual([
			"import_batch_parent",
			"thumbnail_generation_parent",
			"bulk_tagging_parent",
			"batch_embedding_parent",
			"batch_ccip_parent",
		]);
		expect(list.items.slice(5).map((job) => [job.type, job.parentId])).toEqual([
			["auto_tagging", null],
			["auto_tagging", parents[2].id],
			["extract_embedding_batch", null],
		]);
	});

	it("rolls back earlier import pages if a later chunk cannot be queued", async () => {
		const items = Array.from({ length: 101 }, (_, index) => ({
			targetUrl: `https://example.com/artwork_p${index}.png`,
		}));
		// PostgreSQL jsonb rejects a NUL in the last page's metadata.
		const invalid = [
			...items.slice(0, -1),
			{ ...items[100], description: "\0" },
		];
		await expect(
			call(importsRouter.bulkAdd, { items: invalid }),
		).rejects.toThrow();
		expect(await call(importsRouter.countPending, undefined)).toEqual({
			count: 0,
		});
		const result = await call(importsRouter.bulkAdd, { items });
		expect(await call(importsRouter.countPending, undefined)).toEqual({
			count: items.length,
		});
		const pending = await call(importsRouter.listPending, undefined);
		expect(result.createdRequests).toHaveLength(items.length);
		expect(
			new Map(
				result.createdRequests?.map(({ id, targetUrl }) => [id, targetUrl]),
			),
		).toEqual(new Map(pending.map(({ id, item }) => [id, item.targetUrl])));
	});

	async function receipt(
		status: "pending" | "completed" = "pending",
		targetUrl = "https://example.com/image.png",
	) {
		return repositories.job.create({
			type: "import_request",
			status,
			payload: {
				targetUrl,
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
			processImportRequests([request.id], SOURCE_ID).then(
				(result) => result.processedCount,
			),
		]);
		expect(counts.reduce((sum, value) => sum + value, 0)).toBe(1);
		expect(await processImportRequests([request.id], SOURCE_ID)).toEqual({
			processedCount: 0,
		});
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

	it("shows one import parent for an approved batch and keeps receipts out of lists, counts and type filters", async () => {
		const requests = await Promise.all(
			[1, 2, 3].map((page) =>
				receipt("pending", `https://example.com/${page}.png`),
			),
		);
		const approval = await processImportRequests(
			requests.map((job) => job.id),
			SOURCE_ID,
		);
		expect(approval.processedCount).toBe(3);
		expect(approval.batchId).toBeDefined();
		const batchId = approval.batchId;
		if (!batchId) throw new Error("Expected an import batch ID");
		const list = await call(jobsRouter.list, { limit: 200, offset: 0 });
		expect(list.total).toBe(1);
		expect(list.items).toEqual([
			expect.objectContaining({
				id: batchId,
				type: "import_batch_parent",
				progress: { processed: 0, failed: 0, total: 3 },
			}),
		]);
		expect(await call(jobsRouter.types, undefined)).toEqual([
			"import_batch_parent",
		]);
		expect(
			await call(jobsRouter.list, {
				status: "completed",
				limit: 200,
				offset: 0,
			}),
		).toEqual({ items: [], total: 0 });
		expect(
			await call(jobsRouter.list, {
				type: "import_request",
				limit: 200,
				offset: 0,
			}),
		).toEqual({ items: [], total: 0 });
		const targets = await call(jobsRouter.targets, {
			id: batchId,
			limit: 25,
			offset: 0,
		});
		expect(targets.total).toBe(3);
		expect(targets.items).toHaveLength(3);
		expect(
			targets.items.every(
				(item) => item.mediaSourceId === null && item.mediaModifiedAt === null,
			),
		).toBe(true);
		for (const request of requests) {
			expect(await repositories.job.findById(request.id)).toMatchObject({
				status: "completed",
				result: { batchId },
			});
		}
		await call(jobsRouter.cancel, { id: batchId });
		const history = await call(jobsRouter.list, {
			status: "cancelled",
			limit: 200,
			offset: 0,
		});
		expect(history.total).toBe(1);
		expect(history.items[0].id).toBe(batchId);
		expect(
			(
				await call(jobsRouter.targets, { id: batchId, limit: 25, offset: 0 })
			).items.every((target) => target.status === "cancelled"),
		).toBe(true);
	});

	it("downloads the same inbox URL once per batch without skipping a different artwork page", async () => {
		const pageOne = await receipt();
		const duplicate = await receipt();
		const pageTwo = await receipt("pending", "https://example.com/page-2.png");
		const { processedCount, batchId } = await processImportRequests(
			[pageOne.id, duplicate.id, pageTwo.id],
			SOURCE_ID,
		);

		expect(processedCount).toBe(3);
		const rows = await database.select().from(jobs);
		expect(rows.find((row) => row.id === batchId)?.payload).toMatchObject({
			processed: 1,
			total: 3,
		});
		expect(
			rows
				.filter((row) => row.type === "downloadImage")
				.map((row) => row.payload),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ targetUrl: "https://example.com/image.png" }),
				expect.objectContaining({
					targetUrl: "https://example.com/page-2.png",
				}),
			]),
		);
		expect(rows.filter((row) => row.type === "downloadImage")).toHaveLength(2);
		expect(await call(importsRouter.countPending, undefined)).toEqual({
			count: 0,
		});
	});

	it("shares one active download for simultaneous approvals of separate inbox receipts", async () => {
		const first = await receipt();
		const second = await receipt();
		const approvals = await Promise.all([
			processImportRequests([first.id], SOURCE_ID),
			processImportRequests([second.id], SOURCE_ID),
		]);

		expect(approvals.map((result) => result.processedCount)).toEqual([1, 1]);
		const rows = await database.select().from(jobs);
		expect(rows.filter((row) => row.type === "downloadImage")).toHaveLength(1);
		expect(await call(importsRouter.countPending, undefined)).toEqual({
			count: 0,
		});
	});

	it("queues a replacement when the active download is being cancelled", async () => {
		await database.insert(jobs).values({
			type: "downloadImage",
			status: "in_progress",
			mediaSourceId: SOURCE_ID,
			cancelRequestedAt: new Date(),
			payload: { targetUrl: "https://example.com/image.png" },
		});
		const request = await receipt();
		await processImportRequests([request.id], SOURCE_ID);
		expect(
			await repositories.job.findById(importDownloadJobId(request.id)),
		).toMatchObject({ status: "pending" });
	});

	it("preserves standalone and unapproved receipts when hiding batch approval receipts", async () => {
		const standalone = await receipt();
		await processImportRequests([standalone.id], SOURCE_ID);
		const waiting = await receipt();
		const batch = await Promise.all([receipt(), receipt()]);
		await processImportRequests(
			batch.map((job) => job.id),
			SOURCE_ID,
		);
		const receipts = await call(jobsRouter.list, {
			type: "import_request",
			limit: 200,
			offset: 0,
		});
		expect(receipts.total).toBe(2);
		expect(receipts.items.map((job) => job.id).sort()).toEqual(
			[standalone.id, waiting.id].sort(),
		);
		expect(
			(await call(importsRouter.listPending, undefined)).map((job) => job.id),
		).toEqual([waiting.id]);
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
		expect(await repositories.job.findById(parent.id)).toMatchObject({
			status: "completed",
		});
		expect(await repositories.job.finishBatch(parent.id)).toBeNull();
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

	it("reconciles cancellation of a pending child without waiting for a worker", async () => {
		const parent = await repositories.job.create({
			type: "bulk_tagging_parent",
			status: "in_progress",
			payload: { total: 1, processed: 0, failed: 0 },
		});
		const child = await repositories.job.create({
			type: "auto_tagging",
			status: "pending",
			parentId: parent.id,
		});
		expect(await call(jobsRouter.cancel, { id: child.id })).toMatchObject({
			status: "cancelled",
		});
		expect(await repositories.job.findById(parent.id)).toMatchObject({
			status: "failed",
			finishedAt: expect.any(Date),
		});
	});

	it.each(["auto_tagging", "dispatch_bulk_tagging"])(
		"closes the parent when recovery cancels a stale %s after a worker crash",
		async (type) => {
			const parent = await repositories.job.create({
				type: "bulk_tagging_parent",
				status: "in_progress",
				payload: { total: 1, processed: 0, failed: 0 },
			});
			const child = await repositories.job.create({
				type,
				status: "in_progress",
				parentId: parent.id,
				attemptCount: 1,
				artifactPath: "/tmp/stale-artifact",
			});
			await repositories.job.requestCancellation(child.id);
			await database
				.update(jobs)
				.set({ updatedAt: new Date(0) })
				.where(eq(jobs.id, child.id));
			// No finishAttempt runs: a new repository represents the restarted worker.
			const recovered = createRepositories(() => database, {
				info: vi.fn(),
				error: vi.fn(),
			});
			expect(await recovered.job.requeueStaleInProgress(new Date())).toBe(1);
			expect(await recovered.job.findById(child.id)).toMatchObject({
				status: "cancelled",
				finishedAt: expect.any(Date),
				cancelledAt: expect.any(Date),
				artifactPath: null,
			});
			const finishedParent = await recovered.job.findById(parent.id);
			expect(finishedParent).toMatchObject({
				status: "failed",
				finishedAt: expect.any(Date),
			});
			expect(await recovered.job.requeueStaleInProgress(new Date())).toBe(0);
			expect(
				await repositories.job.finishAttempt(child.id, 1, {
					status: "completed",
					result: {},
				}),
			).toBeNull();
			expect(await recovered.job.findById(parent.id)).toEqual(finishedParent);
		},
	);

	it.each([
		{ outcome: "completed", scanFlag: null, status: "completed" },
		{ outcome: "failed", scanFlag: null, status: "failed" },
		{ outcome: "cancelled", scanFlag: null, status: "cancelled" },
		{ outcome: "completed", scanFlag: "scanFailed", status: "failed" },
		{ outcome: "completed", scanFlag: "collecting", status: "failed" },
	] as const)(
		"recovers a stale legacy import as $status with a $outcome target and scan flag $scanFlag",
		async ({ outcome, scanFlag, status }) => {
			const parent = await database.transaction((tx) =>
				createImportBatch(tx, SOURCE_ID, [
					{ label: "existing", skipped: true, work: { type: "downloadImage" } },
					{ label: "download", work: { type: "downloadImage" } },
				]),
			);
			const [work] = await repositories.job.claimPending(1);
			await repositories.job.finishAttempt(
				work.id,
				1,
				outcome === "failed"
					? { status: outcome, error: "Download failed" }
					: { status: outcome, result: null },
			);
			const original = {
				total: 2,
				processed: 1,
				failed: 0,
				...(scanFlag && { [scanFlag]: true }),
			};
			const counter = outcome === "completed" ? "processed" : outcome;
			// The legacy writer concatenated a JSONB string with an outcome fragment.
			await database
				.update(jobs)
				.set({
					payload: sql`to_jsonb(${JSON.stringify(original)}::text) || jsonb_build_object(${counter}::text, 1)`,
					status: "in_progress",
					updatedAt: new Date(0),
					finishedAt: null,
					cancelledAt: null,
				})
				.where(eq(jobs.id, parent.id));
			const cutoff = new Date();
			await repositories.job.requeueStaleInProgress(cutoff);
			const repaired = await repositories.job.findById(parent.id);
			expect(repaired).toMatchObject({
				status,
				finishedAt: expect.any(Date),
				cancelledAt: status === "cancelled" ? expect.any(Date) : null,
				payload: {
					total: 2,
					processed: outcome === "completed" ? 2 : 1,
					failed: outcome === "failed" ? 1 : 0,
					...(outcome === "cancelled" && { cancelled: 1 }),
					...(scanFlag && { scanFailed: true }),
				},
			});
			expect(
				await call(jobsRouter.list, { status: "active", offset: 0, limit: 10 }),
			).toMatchObject({ total: 0, items: [] });
			expect(await repositories.job.requeueStaleInProgress(cutoff)).toBe(0);
			expect(await repositories.job.findById(parent.id)).toEqual(repaired);
			expect(await repositories.job.claimPending(1)).toEqual([]);
		},
	);

	it("does not close a damaged import with work still running under a terminal target", async () => {
		const parent = await database.transaction((tx) =>
			createImportBatch(tx, SOURCE_ID, [
				{ label: "download", work: { type: "downloadImage" } },
			]),
		);
		const [work] = await repositories.job.claimPending(1);
		await database
			.update(jobs)
			.set({ status: "completed" })
			.where(eq(jobs.parentId, parent.id));
		await database
			.update(jobs)
			.set({
				payload: sql`to_jsonb(payload::text) || '{"processed":1}'::jsonb`,
				updatedAt: new Date(0),
			})
			.where(eq(jobs.id, parent.id));
		const before = await repositories.job.findById(parent.id);
		await repositories.job.requeueStaleInProgress(
			new Date(Date.now() - 60_000),
		);
		expect(await repositories.job.findById(parent.id)).toEqual(before);
		expect(await repositories.job.findById(work.id)).toMatchObject({
			status: "in_progress",
			attemptCount: 1,
		});
	});

	it("keeps a live import running during recovery and settles a stringified root on its last outcome", async () => {
		const parent = await database.transaction((tx) =>
			createImportBatch(tx, SOURCE_ID, [
				{ label: "existing", skipped: true, work: { type: "downloadImage" } },
				{ label: "download", work: { type: "downloadImage" } },
			]),
		);
		const [work] = await repositories.job.claimPending(1);
		const cutoff = new Date(Date.now() - 60_000);
		await database
			.update(jobs)
			.set({ updatedAt: new Date(0) })
			.where(eq(jobs.id, parent.id));
		const activeParent = await repositories.job.findById(parent.id);
		await repositories.job.requeueStaleInProgress(cutoff);
		expect(await repositories.job.findById(parent.id)).toEqual(activeParent);
		await database
			.update(jobs)
			.set({
				payload: sql`to_jsonb(payload::text)`,
			})
			.where(inArray(jobs.id, [parent.id, work.id]));
		expect(
			await call(jobsRouter.targets, { id: parent.id, offset: 2, limit: 1 }),
		).toMatchObject({
			items: [],
			stages: [{ type: "downloadImage", running: 1, total: 1 }],
		});
		expect(
			await repositories.job.finishAttempt(work.id, 1, {
				status: "completed",
				result: null,
			}),
		).toBe("completed");
		expect(await repositories.job.findById(parent.id)).toMatchObject({
			status: "completed",
			finishedAt: expect.any(Date),
			payload: { total: 2, processed: 2, failed: 0 },
		});
	});

	it("rolls back stale child cancellation when its parent cannot be finalized", async () => {
		const parent = await repositories.job.create({
			type: "bulk_tagging_parent",
			status: "in_progress",
			payload: { total: 1, processed: 0, failed: 0 },
		});
		const child = await repositories.job.create({
			type: "auto_tagging",
			status: "in_progress",
			parentId: parent.id,
			cancelRequestedAt: new Date(0),
			updatedAt: new Date(0),
		});
		await client.exec(
			`CREATE FUNCTION reject_recovered_parent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'bulk_tagging_parent' AND NEW.status = 'failed' THEN RAISE EXCEPTION 'injected parent failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_recovered_parent BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION reject_recovered_parent();`,
		);
		try {
			await expect(
				repositories.job.requeueStaleInProgress(new Date()),
			).rejects.toThrow();
			expect(await repositories.job.findById(child.id)).toMatchObject({
				status: "in_progress",
				finishedAt: null,
			});
			expect(await repositories.job.findById(parent.id)).toMatchObject({
				status: "in_progress",
				finishedAt: null,
			});
		} finally {
			await client.exec(
				"DROP TRIGGER reject_recovered_parent ON jobs; DROP FUNCTION reject_recovered_parent();",
			);
		}
	});

	it("does not publish a parent failure when cancelling a legacy child of an already closed parent", async () => {
		const parent = await repositories.job.create({
			type: "bulk_tagging_parent",
			status: "completed",
			payload: { total: 1, processed: 1, failed: 0 },
		});
		const child = await repositories.job.create({
			type: "auto_tagging",
			status: "pending",
			parentId: parent.id,
		});
		const publish = vi.spyOn(RealtimeEventBus, "publishJob");
		try {
			await call(jobsRouter.cancel, { id: child.id });
			expect(await repositories.job.findById(parent.id)).toMatchObject({
				status: "completed",
			});
			expect(publish).not.toHaveBeenCalledWith(
				"job-failed",
				expect.objectContaining({ jobId: parent.id }),
			);
		} finally {
			publish.mockRestore();
		}
	});

	it("closes the parent when last siblings finish concurrently on independent connections", async () => {
		const parent = await repositories.job.create({
			type: "bulk_tagging_parent",
			status: "in_progress",
			payload: { total: 2, processed: 2, failed: 0 },
		});
		const children = await Promise.all(
			[1, 2].map(() =>
				repositories.job.create({
					type: "auto_tagging",
					status: "in_progress",
					parentId: parent.id,
					attemptCount: 1,
				}),
			),
		);
		await Promise.all(
			children.map((child) =>
				repositories.job.finishAttempt(child.id, 1, {
					status: "completed",
					result: {},
				}),
			),
		);
		expect(await repositories.job.findById(parent.id)).toMatchObject({
			status: "completed",
			finishedAt: expect.any(Date),
		});
	});

	it("rolls back child termination when final parent persistence fails", async () => {
		const parent = await repositories.job.createBatch(
			{
				type: "bulk_tagging_parent",
				status: "in_progress",
				payload: { total: 0, processed: 0, failed: 0 },
			},
			{ type: "bulk_tagging_dispatch", status: "in_progress", attemptCount: 1 },
		);
		const dispatch = (
			await database.select().from(jobs).where(eq(jobs.parentId, parent.id))
		)[0];
		await client.exec(
			`CREATE FUNCTION reject_parent_confirmation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'bulk_tagging_parent' AND NEW.status = 'completed' THEN RAISE EXCEPTION 'injected parent failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_parent_confirmation BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION reject_parent_confirmation();`,
		);
		try {
			await expect(
				repositories.job.finishAttempt(dispatch.id, 1, {
					status: "completed",
					result: {},
				}),
			).rejects.toThrow();
			expect(await repositories.job.findById(dispatch.id)).toMatchObject({
				status: "in_progress",
			});
			expect(await repositories.job.findById(parent.id)).toMatchObject({
				status: "in_progress",
			});
		} finally {
			await client.exec(
				"DROP TRIGGER reject_parent_confirmation ON jobs; DROP FUNCTION reject_parent_confirmation();",
			);
		}
	});

	it("fails ambiguous legacy chunk accounting explicitly instead of inventing a one-item contribution", async () => {
		const parent = await repositories.job.create({
			type: "batch_ccip_parent",
			status: "in_progress",
			payload: { total: 25, processed: 25, failed: 0 },
		});
		const child = await repositories.job.create({
			type: "extract_ccip_vector",
			status: "in_progress",
			parentId: parent.id,
			attemptCount: 2,
			payload: { mediaIds: Array.from({ length: 25 }, () => randomUUID()) },
			result: { parentProcessed: true },
		});
		expect(
			await repositories.job.recordBatchChildOutcome(
				parent.id,
				child.id,
				2,
				25,
				0,
			),
		).toBeNull();
		expect(await repositories.job.findById(parent.id)).toMatchObject({
			status: "failed",
			error: "Legacy chunk progress requires a new batch",
			payload: expect.objectContaining({ processed: 25, failed: 0 }),
		});
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
