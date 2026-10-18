import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
import { ImportRequestService } from "@solid-imager/application/services/import-request-service";
import { createImportRequestRepository } from "@solid-imager/db/repositories/import-request-repository";
import { createJobRepository } from "@solid-imager/db/repositories/job-repository";
import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import { createTransactionManager } from "@solid-imager/db/transaction-manager";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { ImportRequest } from "@solid-imager/core/domain/imports/schemas";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import * as schema from "@solid-imager/db/schema";
import { createPglite } from "~/infrastructure/db/pglite";

describe("dedicated import requests", () => {
	let directory: string;
	let local: ReturnType<typeof createPglite> | undefined;
	let postgres: Pool | undefined;
	let database: DrizzleExecutor;
	const executor = (tx?: Transaction) => (tx ?? database) as DrizzleExecutor;
	const repo = createImportRequestRepository(executor);
	const jobs = createJobRepository(executor);
	const sources = createSourceRepository(executor);
	const transactions = createTransactionManager(executor);
	const notify = vi.fn();
	const reserve =
		vi.fn<
			(
				sourceId: string,
				requests: ImportRequest[],
				tx: Transaction,
			) => Promise<void>
		>();
	const service = new ImportRequestService({
		repo,
		sources,
		transactions,
		reserve,
		notify,
	});
	const item = {
		targetUrl: "https://example.invalid/image.png",
		sourceUrls: ["https://example.invalid/post/1"],
		fileName: "image.png",
	};
	let sourceId: string;
	beforeAll(async () => {
		const port = process.env.IMPORT_REQUEST_TEST_POSTGRES_PORT;
		if (port) {
			if (!/^\d+$/.test(port) || Number(port) <= 1024 || Number(port) > 65535)
				throw new Error("Invalid isolated PostgreSQL port");
			postgres = new Pool({
				host: "127.0.0.1",
				port: Number(port),
				user: "import_test",
				password: "ephemeral_import_test",
				database: "import_request_test",
				max: 8,
			});
			const pg = drizzlePostgres(postgres, { schema });
			await migratePostgres(pg, { migrationsFolder: path.resolve("drizzle") });
			database = pg;
		} else {
			directory = await mkdtemp(path.join(tmpdir(), "import-requests-"));
			local = createPglite(directory);
			const pg = drizzle(local, { schema });
			await migrate(pg, { migrationsFolder: path.resolve("drizzle") });
			database = pg;
		}
	}, 30_000);
	beforeEach(async () => {
		await database
			.update(schema.importRequestCutovers)
			.set({ authority: "legacy", generation: 0 });
		await database
			.delete(schema.importRequests)
			.where(eq(schema.importRequests.status, "superseded"));
		await database.delete(schema.importRequests);
		await database.delete(schema.jobs);
		await database.delete(schema.mediaSources);
		sourceId = (
			await sources.create({
				name: "Import target",
				description: null,
				type: "local",
				connectionInfo: { path: "/isolated-import-target" },
			})
		).id;
		notify.mockReset();
		reserve.mockReset().mockImplementation(async (target, requests, tx) => {
			for (const request of requests)
				await jobs.create(
					{
						type: "downloadImage",
						mediaSourceId: target,
						payload: { ...request.item, importRequestId: request.id },
					},
					tx,
				);
		});
	});
	afterAll(async () => {
		await local?.close();
		await postgres?.end();
		if (directory) await rm(directory, { recursive: true, force: true });
	});
	async function add() {
		await service.add([item]);
		return (await service.listPending())[0];
	}
	const state = async (id: string) =>
		(
			await database
				.select()
				.from(schema.importRequests)
				.where(eq(schema.importRequests.id, id))
		)[0];
	const downloads = () =>
		database
			.select()
			.from(schema.jobs)
			.where(eq(schema.jobs.type, "downloadImage"));

	it("stores native requests outside jobs and strips authentication only from the DTO", async () => {
		await service.add([
			{
				...item,
				cookies: [{ name: "auth", value: "private-secret" }],
				userAgent: "private-agent",
			},
		]);
		const [pending] = await service.listPending();
		expect(JSON.stringify(pending)).not.toMatch(
			/private-secret|private-agent|cookies|userAgent/,
		);
		expect(await database.select().from(schema.jobs)).toHaveLength(0);
		await service.process([pending.id], sourceId);
		expect((await downloads())[0].payload).toMatchObject({
			cookies: [{ name: "auth", value: "private-secret" }],
			importRequestId: pending.id,
		});
		expect((await state(pending.id)).targetSourceId).toBe(sourceId);
	});
	it("deduplicates concurrent pending reception with canonical nested JSON", async () => {
		const results = await Promise.all([
			service.add([
				{ ...item, generationInfo: { metadata: { first: 1, second: 2 } } },
			]),
			service.add([
				{ ...item, generationInfo: { metadata: { second: 2, first: 1 } } },
			]),
		]);
		expect(results.reduce((a, b) => a + b, 0)).toBe(1);
		expect(await service.countPending()).toBe(1);
	});
	it("approves each selected request once and reserves downloads in the same transaction", async () => {
		const pending = await add();
		expect(await service.process([pending.id, pending.id], sourceId)).toBe(1);
		expect(await service.process([pending.id], sourceId)).toBe(0);
		expect(await downloads()).toHaveLength(1);
		expect(await service.countPending()).toBe(0);
		expect((await state(pending.id)).status).toBe("approved");
		expect(reserve).toHaveBeenCalledOnce();
		expect(await database.select().from(schema.medias)).toHaveLength(0);
		expect(
			await database.select().from(schema.mediaProcessingStates),
		).toHaveLength(0);
	});
	it("releases the pending key after cancellation and keeps the receipt", async () => {
		const pending = await add();
		await service.cancel([pending.id]);
		expect((await state(pending.id)).status).toBe("cancelled");
		expect(await service.add([item])).toBe(1);
		expect((await service.listPending())[0].id).not.toBe(pending.id);
	});
	it("never modifies unrelated jobs or approved requests during cancel", async () => {
		const pending = await add();
		await service.process([pending.id], sourceId);
		const unrelated = await jobs.create({
			type: "source_export",
			status: "in_progress",
		});
		await service.cancel([pending.id, unrelated.id]);
		expect((await state(pending.id)).status).toBe("approved");
		expect(await jobs.findById(unrelated.id)).toEqual(unrelated);
	});
	it("rolls download insertion back and keeps pending on reservation failure", async () => {
		const pending = await add();
		reserve.mockImplementationOnce(async (target, requests, tx) => {
			await jobs.create(
				{
					type: "downloadImage",
					mediaSourceId: target,
					payload: requests[0].item,
				},
				tx,
			);
			throw new Error("injected reservation failure");
		});
		notify.mockClear();
		await expect(service.process([pending.id], sourceId)).rejects.toThrow(
			"injected reservation failure",
		);
		expect((await state(pending.id)).status).toBe("pending");
		expect(await downloads()).toHaveLength(0);
		expect(notify).not.toHaveBeenCalled();
	});
	it("rolls downloads back when saving approval fails", async () => {
		const pending = await add();
		await database.execute(
			sql`CREATE FUNCTION reject_import_approval() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'approved' THEN RAISE EXCEPTION 'injected approval failure'; END IF; RETURN NEW; END $$`,
		);
		await database.execute(
			sql`CREATE TRIGGER reject_import_approval BEFORE UPDATE ON import_requests FOR EACH ROW EXECUTE FUNCTION reject_import_approval()`,
		);
		try {
			await expect(service.process([pending.id], sourceId)).rejects.toThrow();
			expect(await downloads()).toHaveLength(0);
			expect((await state(pending.id)).status).toBe("pending");
		} finally {
			await database.execute(
				sql`DROP FUNCTION reject_import_approval() CASCADE`,
			);
		}
	});
	it("does not fail committed approval when notification fails", async () => {
		const pending = await add();
		notify.mockImplementationOnce(() => {
			throw new Error("listener disconnected");
		});
		expect(await service.process([pending.id], sourceId)).toBe(1);
		expect(await downloads()).toHaveLength(1);
	});
	it("rejects invalid or non-local target sources before reserving", async () => {
		const pending = await add();
		await sources.update(sourceId, { type: "s3" });
		await expect(service.process([pending.id], sourceId)).rejects.toThrow(
			"local target",
		);
		expect((await state(pending.id)).status).toBe("pending");
		expect(reserve).not.toHaveBeenCalled();
	});
	it("serializes concurrent approvals", async () => {
		const pending = await add();
		const results = await Promise.all([
			service.process([pending.id], sourceId),
			service.process([pending.id], sourceId),
		]);
		expect(results.reduce((a, b) => a + b, 0)).toBe(1);
		expect(await downloads()).toHaveLength(1);
	});
	it("serializes cancel against approval without losing a queued download", async () => {
		const pending = await add();
		await Promise.all([
			service.process([pending.id], sourceId),
			service.cancel([pending.id]),
		]);
		const current = await state(pending.id);
		expect(["approved", "cancelled"]).toContain(current.status);
		expect(await downloads()).toHaveLength(
			current.status === "approved" ? 1 : 0,
		);
	});
	it("migrates old IDs, JSON-string payloads, duplicates and invalid input without dropping snapshots", async () => {
		const first = await jobs.create({ type: "import_request", payload: item });
		const duplicate = await jobs.create({
			type: "import_request",
			payload: JSON.stringify(item),
		});
		const invalid = await jobs.create({
			type: "import_request",
			payload: "invalid JSON",
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
		expect(await service.countPending()).toBe(1);
		expect(await state(invalid.id)).toMatchObject({
			status: "blocked",
			item: null,
			blockedReason: "invalid_item",
		});
		expect(
			await database.select().from(schema.importRequestLegacySnapshots),
		).toHaveLength(3);
		expect(await database.select().from(schema.jobs)).toHaveLength(0);
		expect(await service.process([first.id, duplicate.id], sourceId)).toBe(1);
		expect(await downloads()).toHaveLength(1);
	});
	it("blocks an ambiguous legacy download reservation instead of replaying it", async () => {
		const original = await jobs.create({
			type: "import_request",
			payload: item,
		});
		await jobs.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: item,
		});
		expect((await repo.ensureCutover()).blocked).toBe(1);
		expect(await state(original.id)).toMatchObject({
			status: "blocked",
			blockedReason: "legacy_reservation",
		});
		expect(await service.process([original.id], sourceId)).toBe(0);
		expect(await downloads()).toHaveLength(1);
	});
	it("rejects retired legacy producers after cutover", async () => {
		await repo.ensureCutover();
		await expect(
			jobs.create({ type: "import_request", payload: item }),
		).rejects.toThrow();
		expect(await database.select().from(schema.jobs)).toHaveLength(0);
	});
	it("rolls an interrupted cutover back without removing legacy input", async () => {
		const original = await jobs.create({
			type: "import_request",
			payload: item,
		});
		await database.execute(
			sql`CREATE FUNCTION reject_import_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected archive failure'; END $$`,
		);
		await database.execute(
			sql`CREATE TRIGGER reject_import_snapshot BEFORE INSERT ON import_request_legacy_snapshots FOR EACH ROW EXECUTE FUNCTION reject_import_snapshot()`,
		);
		try {
			await expect(repo.ensureCutover()).rejects.toThrow();
			expect(await jobs.findById(original.id)).toEqual(original);
			expect(await database.select().from(schema.importRequests)).toHaveLength(
				0,
			);
		} finally {
			await database.execute(
				sql`DROP FUNCTION reject_import_snapshot() CASCADE`,
			);
		}
		expect((await repo.ensureCutover()).migrated).toBe(1);
	});
	it("restores legacy and native receipts on rollback without making approved imports pending", async () => {
		const original = await jobs.create({
			type: "import_request",
			payload: item,
		});
		await service.countPending();
		await service.process([original.id], sourceId);
		await service.add([
			{ ...item, targetUrl: "https://example.invalid/second.png" },
		]);
		const pending = (await service.listPending())[0];
		expect(await repo.rollback()).toBe(2);
		expect(await repo.rollback()).toBe(0);
		expect(await jobs.findById(original.id)).toMatchObject({
			status: "completed",
			payload: item,
		});
		expect(await jobs.findById(pending.id)).toMatchObject({
			status: "pending",
		});
		expect(await downloads()).toHaveLength(1);
		await expect(service.add([item])).rejects.toThrow("rolled back");
	});
	it("recovers pending state from reopened DB without event history", async () => {
		const pending = await add();
		if (local) {
			await local.close();
			local = createPglite(directory);
			database = drizzle(local, { schema });
		}
		expect((await service.listPending())[0].id).toBe(pending.id);
		expect(await service.countPending()).toBe(1);
	});
	it("rolls cutover back if the final epoch update fails after legacy deletion", async () => {
		const original = await jobs.create({
			type: "import_request",
			payload: item,
		});
		await database.execute(
			sql`CREATE FUNCTION reject_import_epoch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.authority = 'dedicated' THEN RAISE EXCEPTION 'injected epoch failure'; END IF; RETURN NEW; END $$`,
		);
		await database.execute(
			sql`CREATE TRIGGER reject_import_epoch BEFORE UPDATE ON import_request_cutovers FOR EACH ROW EXECUTE FUNCTION reject_import_epoch()`,
		);
		try {
			await expect(repo.ensureCutover()).rejects.toThrow();
			expect(await jobs.findById(original.id)).toEqual(original);
			expect(await database.select().from(schema.importRequests)).toHaveLength(
				0,
			);
			expect(
				await database.select().from(schema.importRequestLegacySnapshots),
			).toHaveLength(0);
		} finally {
			await database.execute(sql`DROP FUNCTION reject_import_epoch() CASCADE`);
		}
	});
	it("does not overwrite a conflicting job during rollback or partially switch authority", async () => {
		const original = await jobs.create({
			type: "import_request",
			payload: item,
		});
		await repo.ensureCutover();
		const conflicting = await jobs.create({
			id: original.id,
			type: "source_export",
		});
		await expect(repo.rollback()).rejects.toThrow();
		expect(await jobs.findById(original.id)).toEqual(conflicting);
		expect(
			(await database.select().from(schema.importRequestCutovers))[0].authority,
		).toBe("dedicated");
		expect((await service.listPending())[0].id).toBe(original.id);
	});
});
