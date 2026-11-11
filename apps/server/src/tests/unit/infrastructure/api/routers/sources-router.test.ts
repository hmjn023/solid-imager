import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sourcesRouter } from "~/infrastructure/api/routers/sources-router";
import { DirectorySyncService } from "~/infrastructure/services/directory-sync-service";
import { FileWatcherService } from "~/infrastructure/jobs/file-watcher-service";
import { MediaSourceService } from "~/infrastructure/services/media-source-service";

vi.mock("~/infrastructure/api/routers/jobs-router", () => ({
	toJobDto: vi.fn(),
}));
vi.mock("~/infrastructure/services/directory-sync-service", () => ({
	DirectorySyncService: { syncMediaSource: vi.fn() },
}));
vi.mock("~/infrastructure/jobs/file-watcher-service", () => ({
	FileWatcherService: { stopMonitoring: vi.fn() },
}));
vi.mock("~/infrastructure/services/media-source-service", () => ({
	MediaSourceService: { deleteSource: vi.fn() },
}));
vi.mock("~/infrastructure/services/job-transfer-storage", () => ({
	persistJobInput: vi.fn(),
}));
vi.mock("~/infrastructure/service-registry", () => ({ services: {} }));
vi.mock("~/infrastructure/db/repositories", () => ({ allocateJobId: vi.fn() }));
vi.mock("~/infrastructure/logger", () => ({ logger: { error: vi.fn() } }));

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
beforeEach(() => vi.clearAllMocks());

describe("source sync RPC outcomes", () => {
	it.each(["partial", "fatal"] as const)(
		"preserves %s failure outcomes and committed counts from a fulfilled scan",
		async (failureKind) => {
			vi.mocked(DirectorySyncService.syncMediaSource)
				.mockResolvedValueOnce({
					sourceId: first,
					success: false,
					failureKind,
					added: 2,
					deleted: 1,
					failed: 1,
					error: "Directory sync failed",
				})
				.mockResolvedValueOnce({
					sourceId: second,
					success: true,
					added: 3,
					deleted: 0,
					failed: 0,
				});
			const { results } = await call(sourcesRouter.sync, {
				ids: [first, second],
			});
			expect(results).toEqual([
				{
					id: first,
					sourceId: first,
					success: false,
					failureKind,
					added: 2,
					deleted: 1,
					failed: 1,
					error: "Directory sync failed",
				},
				{
					id: second,
					sourceId: second,
					success: true,
					added: 3,
					deleted: 0,
					failed: 0,
				},
			]);
		},
	);

	it("does not expose internal paths or credentials when a scan unexpectedly rejects", async () => {
		vi.mocked(DirectorySyncService.syncMediaSource).mockRejectedValueOnce(
			new Error("/private/path password=secret"),
		);
		await expect(call(sourcesRouter.sync, { ids: [first] })).resolves.toEqual({
			results: [
				{
					id: first,
					sourceId: first,
					success: false,
					failureKind: "fatal",
					added: 0,
					deleted: 0,
					failed: 1,
					error: "Directory sync failed",
				},
			],
		});
	});
});

describe("source deletion monitoring fence", () => {
	it("waits for watcher invalidation and handle release before deleting the source", async () => {
		const stopping = Promise.withResolvers<void>();
		vi.mocked(FileWatcherService.stopMonitoring).mockReturnValueOnce(
			stopping.promise,
		);
		const deleting = call(sourcesRouter.delete, { id: first });
		await vi.waitFor(() =>
			expect(FileWatcherService.stopMonitoring).toHaveBeenCalledWith(first),
		);
		expect(MediaSourceService.deleteSource).not.toHaveBeenCalled();
		stopping.resolve();
		await deleting;
		expect(MediaSourceService.deleteSource).toHaveBeenCalledExactlyOnceWith(
			first,
		);
	});

	it("keeps the source when handle release fails so stop can be retried", async () => {
		vi.mocked(FileWatcherService.stopMonitoring).mockRejectedValueOnce(
			new Error("close failed"),
		);
		await expect(call(sourcesRouter.delete, { id: first })).rejects.toThrow(
			"close failed",
		);
		expect(MediaSourceService.deleteSource).not.toHaveBeenCalled();
	});
});
