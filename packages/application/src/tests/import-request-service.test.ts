import { describe, expect, it, vi } from "vite-plus/test";
import type { JobRecord, NewJobRecord } from "../ports/job-repository";
import {
	createImportRequestService,
	IMPORT_REQUEST_JOB_TYPE,
} from "../services/import-request-service";

function makeJob(id: string, payload: unknown): JobRecord {
	const now = new Date("2026-04-25T00:00:00.000Z");
	return {
		id,
		type: IMPORT_REQUEST_JOB_TYPE,
		mediaSourceId: null,
		status: "pending",
		payload,
		result: null,
		error: null,
		createdAt: now,
		updatedAt: now,
		parentId: null,
	};
}

describe("import-request-service", () => {
	it("classifies restore and import items during bulk add", async () => {
		const createMany = vi.fn(async (jobs: NewJobRecord[]) =>
			jobs.map((job, index) => ({
				...makeJob(`job-${index + 1}`, job.payload as Record<string, unknown>),
				status: job.status ?? "pending",
				payload: job.payload ?? {},
			})),
		);
		const restoreSource = vi.fn(async () => ({
			processed: 1,
			skipped: 0,
		}));
		const publishImportEvent = vi.fn();
		const service = createImportRequestService({
			jobRepository: {
				createMany,
				findPendingImportRequests: vi.fn(async () => []),
				findImportRequestsByIds: vi.fn(async () => []),
				markImportRequestsCompleted: vi.fn(async () => undefined),
				deleteImportRequests: vi.fn(async () => undefined),
			},
			findMediaSourceForFile: vi.fn(async (filePath: string) =>
				filePath === "restorable/image.png" ? "source-1" : null,
			),
			restoreSource,
			executeImport: vi.fn(async () => ({ processedCount: 0 })),
			publishImportEvent,
		});

		const result = await service.bulkAddImportItems([
			{
				filePath: "restorable/image.png",
				fileName: "image.png",
			},
			{
				description: "queued",
				sourceUrls: ["https://example.com/image.png"],
			},
			{
				description: "skipped",
			},
		]);

		expect(result).toEqual({
			addedCount: 1,
			skippedCount: 1,
			restoredCount: 1,
		});
		expect(restoreSource).toHaveBeenCalledWith("source-1", [
			expect.objectContaining({
				filePath: "restorable/image.png",
			}),
		]);
		expect(createMany).toHaveBeenCalledWith([
			expect.objectContaining({
				type: IMPORT_REQUEST_JOB_TYPE,
				status: "pending",
				payload: expect.objectContaining({
					description: "queued",
					targetUrl: "https://example.com/image.png",
				}),
			}),
		]);
		expect(publishImportEvent).toHaveBeenCalledWith("import-request:created", {
			count: 1,
		});
	});

	it("lists only valid pending import jobs", async () => {
		const service = createImportRequestService({
			jobRepository: {
				createMany: vi.fn(async () => []),
				findPendingImportRequests: vi.fn(async () => [
					makeJob("job-1", {
						description: "valid",
						targetUrl: "https://example.com/image.png",
						targetSourceId: "00000000-0000-4000-8000-000000000001",
					}),
					makeJob("job-2", "invalid"),
				]),
				findImportRequestsByIds: vi.fn(async () => []),
				markImportRequestsCompleted: vi.fn(async () => undefined),
				deleteImportRequests: vi.fn(async () => undefined),
			},
			findMediaSourceForFile: vi.fn(async () => null),
			restoreSource: vi.fn(async () => ({ processed: 0, skipped: 0 })),
			executeImport: vi.fn(async () => ({ processedCount: 0 })),
			publishImportEvent: vi.fn(),
		});

		await expect(service.listPendingImports()).resolves.toEqual([
			expect.objectContaining({
				id: "job-1",
				targetSourceId: "00000000-0000-4000-8000-000000000001",
				item: expect.objectContaining({
					targetUrl: "https://example.com/image.png",
				}),
			}),
		]);
	});

	it("processes selected jobs, updates status, and emits an event", async () => {
		const executeImport = vi.fn(async () => ({ processedCount: 2 }));
		const markImportRequestsCompleted = vi.fn(async () => undefined);
		const publishImportEvent = vi.fn();
		const service = createImportRequestService({
			jobRepository: {
				createMany: vi.fn(async () => []),
				findPendingImportRequests: vi.fn(async () => []),
				findImportRequestsByIds: vi.fn(async () => [
					makeJob("job-1", {
						targetUrl: "https://example.com/a.png",
						targetSourceId: "00000000-0000-4000-8000-000000000001",
					}),
					makeJob("job-2", {
						targetUrl: "https://example.com/b.png",
					}),
				]),
				markImportRequestsCompleted,
				deleteImportRequests: vi.fn(async () => undefined),
			},
			findMediaSourceForFile: vi.fn(async () => null),
			restoreSource: vi.fn(async () => ({ processed: 0, skipped: 0 })),
			executeImport,
			publishImportEvent,
		});

		const result = await service.processPendingImports(["job-1", "job-2"]);

		expect(result).toEqual({ success: true, processedCount: 2 });
		expect(executeImport).toHaveBeenCalledWith(
			"00000000-0000-4000-8000-000000000001",
			[
				expect.objectContaining({
					targetUrl: "https://example.com/a.png",
				}),
				expect.objectContaining({
					targetUrl: "https://example.com/b.png",
				}),
			],
		);
		expect(markImportRequestsCompleted).toHaveBeenCalledWith([
			"job-1",
			"job-2",
		]);
		expect(publishImportEvent).toHaveBeenCalledWith(
			"import-request:processed",
			{ processedCount: 2 },
		);
	});

	it("deletes selected jobs and emits a deletion event", async () => {
		const deleteImportRequests = vi.fn(async () => undefined);
		const publishImportEvent = vi.fn();
		const service = createImportRequestService({
			jobRepository: {
				createMany: vi.fn(async () => []),
				findPendingImportRequests: vi.fn(async () => []),
				findImportRequestsByIds: vi.fn(async () => []),
				markImportRequestsCompleted: vi.fn(async () => undefined),
				deleteImportRequests,
			},
			findMediaSourceForFile: vi.fn(async () => null),
			restoreSource: vi.fn(async () => ({ processed: 0, skipped: 0 })),
			executeImport: vi.fn(async () => ({ processedCount: 0 })),
			publishImportEvent,
		});

		await expect(
			service.cancelPendingImports(["job-1", "job-2"]),
		).resolves.toEqual({ success: true });
		expect(deleteImportRequests).toHaveBeenCalledWith(["job-1", "job-2"]);
		expect(publishImportEvent).toHaveBeenCalledWith("import-request:deleted", {
			jobIds: ["job-1", "job-2"],
		});
	});
});
