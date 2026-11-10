import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	unlink,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { DeferredActions } from "@solid-imager/application/media";
import type { Media } from "@solid-imager/core/media";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	publish: vi.fn(),
	deleteFile: vi.fn(),
	deleteThumbnail: vi.fn(),
}));
vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: { publishSourceCommand: mocks.publish },
}));
vi.mock("~/infrastructure/service-registry", () => ({
	services: { getMediaStorage: () => ({ deleteFile: mocks.deleteFile }) },
}));
vi.mock("~/infrastructure/jobs/tagging-jobs", () => ({
	processBulkTaggingDispatchJob: vi.fn(),
	processAutoTaggingJob: vi.fn(),
}));
vi.mock("~/infrastructure/jobs/ccip-jobs", () => ({
	processBatchCcipDispatchJob: vi.fn(),
}));
vi.mock("~/infrastructure/services/source-transfer-job-service", () => ({
	processSourceExportJob: vi.fn(),
	processSourceRestoreJob: vi.fn(),
}));
vi.mock("~/infrastructure/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn() },
}));
import {
	configureThumbnailJobHandlers,
	executeDeferredActions,
} from "~/infrastructure/services/job-dispatch-service";

const sourceId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const mediaId = "33333333-3333-4333-8333-333333333333";
let directory: string;
let actions: DeferredActions;
beforeEach(async () => {
	vi.resetAllMocks();
	directory = await mkdtemp(path.join(os.tmpdir(), "si-deferred-move-"));
	await mkdir(path.join(directory, "source"));
	await writeFile(path.join(directory, "source", "image.png"), "moved source");
	await writeFile(path.join(directory, "thumbnail.webp"), "old thumbnail");
	mocks.deleteFile.mockImplementation(async (base: string, relative: string) =>
		unlink(path.join(base, relative)),
	);
	mocks.deleteThumbnail.mockImplementation(async () =>
		unlink(path.join(directory, "thumbnail.webp")),
	);
	configureThumbnailJobHandlers({
		deleteThumbnail: mocks.deleteThumbnail,
		processThumbnailGenerationJob: vi.fn(),
	});
	actions = {
		jobs: [],
		filesToDelete: [
			{ basePath: path.join(directory, "source"), filePath: "image.png" },
		],
		thumbnailsToDelete: [{ mediaSourceId: sourceId, mediaId }],
		sourceEvents: [
			{
				mediaSourceId: sourceId,
				event: "media-moved",
				payload: {
					type: "source",
					mediaId,
					targetId,
					timestamp: new Date().toISOString(),
				},
			},
			{
				mediaSourceId: targetId,
				event: "media-moved",
				payload: {
					type: "target",
					media: { id: mediaId } as Media,
					sourceId,
					timestamp: new Date().toISOString(),
				},
			},
		],
	};
});
afterEach(async () => {
	await rm(directory, { recursive: true, force: true });
});

describe("committed move cleanup", () => {
	it("deletes physical source and thumbnail and attempts both observers even when the first observer throws", async () => {
		mocks.publish.mockImplementationOnce(() => {
			throw new Error("observer failed");
		});
		await expect(executeDeferredActions(actions)).resolves.toBeUndefined();
		await expect(
			readFile(path.join(directory, "source", "image.png")),
		).rejects.toThrow();
		await expect(
			readFile(path.join(directory, "thumbnail.webp")),
		).rejects.toThrow();
		expect(mocks.publish).toHaveBeenCalledTimes(2);
	});
	it.each(["file", "thumbnail"] as const)(
		"reports unreconciled %s cleanup while still attempting the remaining cleanup and observers",
		async (failure) => {
			if (failure === "file")
				mocks.deleteFile.mockRejectedValueOnce(
					new Error(`cleanup failed at ${directory}`),
				);
			else
				mocks.deleteThumbnail.mockRejectedValueOnce(
					new Error(`cleanup failed at ${directory}`),
				);
			const error = await executeDeferredActions(actions).catch(
				(cause: unknown) => cause,
			);
			expect(error).toMatchObject({ name: "UnreconciledStorageError" });
			expect(error instanceof Error && error.message).not.toContain(directory);
			expect(mocks.deleteFile).toHaveBeenCalledOnce();
			expect(mocks.deleteThumbnail).toHaveBeenCalledOnce();
			expect(mocks.publish).toHaveBeenCalledTimes(2);
			const remaining =
				failure === "file"
					? path.join(directory, "source", "image.png")
					: path.join(directory, "thumbnail.webp");
			expect((await readFile(remaining, "utf8")).length).toBeGreaterThan(0);
		},
	);
});
