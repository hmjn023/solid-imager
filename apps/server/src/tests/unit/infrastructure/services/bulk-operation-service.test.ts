import {
	mkdtemp,
	readFile,
	rename,
	rm,
	writeFile,
	mkdir,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
	findByIds: vi.fn(),
	bulkUpdatePaths: vi.fn(),
	moveFile: vi.fn(),
	deleteFile: vi.fn(),
	copyMedia: vi.fn(),
	moveMedia: vi.fn(),
	notify: vi.fn(),
	values: vi.fn(),
	findSource: vi.fn(),
}));
vi.mock("~/infrastructure/service-registry", () => ({
	services: {
		getMediaRepository: () => ({
			findByIds: mocks.findByIds,
			bulkUpdatePaths: mocks.bulkUpdatePaths,
		}),
		getMediaStorage: () => ({
			moveFile: mocks.moveFile,
			deleteFile: mocks.deleteFile,
		}),
		getSourceRepository: () => ({ findById: mocks.findSource }),
	},
}));
vi.mock("~/infrastructure/db", () => ({
	db: {
		transaction: async (fn: (tx: object) => Promise<unknown>) =>
			fn({ insert: () => ({ values: mocks.values }) }),
	},
}));
vi.mock("~/infrastructure/jobs/thumbnails", () => ({
	deleteThumbnail: vi.fn(),
}));
vi.mock("~/infrastructure/services/media-service", () => ({
	MediaService: { copyMedia: mocks.copyMedia, moveMedia: mocks.moveMedia },
}));
vi.mock("~/infrastructure/services/job-dispatch-service", () => ({
	executeDeferredActions: mocks.notify,
}));
vi.mock("~/infrastructure/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn() },
}));
import { BulkOperationService } from "~/infrastructure/services/bulk-operation-service";
const one = "11111111-1111-4111-8111-111111111111";
const two = "22222222-2222-4222-8222-222222222222";
const sourceId = "33333333-3333-4333-8333-333333333333";
const targetId = "44444444-4444-4444-8444-444444444444";
let directory: string;
beforeEach(async () => {
	vi.resetAllMocks();
	directory = await mkdtemp(path.join(os.tmpdir(), "si-bulk-858-"));
	mocks.findSource.mockResolvedValue({
		id: sourceId,
		type: "local",
		connectionInfo: { path: directory },
	});
	mocks.findByIds.mockResolvedValue([
		{
			id: one,
			mediaSourceId: sourceId,
			fileName: "one.png",
			filePath: "one.png",
		},
		{
			id: two,
			mediaSourceId: sourceId,
			fileName: "two.png",
			filePath: "two.png",
		},
	]);
	mocks.copyMedia.mockImplementation(async (id: string) => ({
		success: true,
		media: { id: `copied-${id}`, filePath: `copied-${id}.png` },
		deferred: {
			jobs: [
				{
					mediaSourceId: targetId,
					jobs: [
						{
							type: "processMedia",
							mediaId: `copied-${id}`,
							sourcePath: directory,
							payload: {},
						},
					],
				},
			],
			sourceEvents: [],
		},
	}));
	mocks.moveMedia.mockImplementation(mocks.copyMedia);
	mocks.moveFile.mockImplementation(
		async (base: string, from: string, to: string) => {
			await mkdir(path.dirname(path.join(base, to)), { recursive: true });
			await rename(path.join(base, from), path.join(base, to));
		},
	);
});
afterEach(async () => {
	await rm(directory, { recursive: true, force: true });
});

describe("bulk media item outcomes", () => {
	it.each(["bulkCopyToSource", "bulkMoveToSource"] as const)(
		"returns partial %s success without discarding successful IDs",
		async (operation) => {
			const perform =
				operation === "bulkCopyToSource" ? mocks.copyMedia : mocks.moveMedia;
			perform.mockRejectedValueOnce(
				new Error("secret /storage/path or credentials"),
			);
			const result = await BulkOperationService[operation](
				sourceId,
				[one, two],
				targetId,
			);

			expect(result.success).toBe(false);
			expect(result.items).toEqual([
				{
					mediaId: one,
					status: "failed",
					error: "メディアのコピー・移動に失敗しました。",
				},
				{ mediaId: two, status: "succeeded" },
			]);
			expect(JSON.stringify(result)).not.toContain("secret");
		},
	);
	it("does not label a committed copy failed when publishing its notification fails", async () => {
		mocks.notify.mockRejectedValue(new Error("listener failure"));
		const result = await BulkOperationService.bulkCopyToSource(
			sourceId,
			[one],
			targetId,
		);
		expect(result.items).toEqual([{ mediaId: one, status: "succeeded" }]);
		expect(mocks.values).toHaveBeenCalledTimes(1);
		expect(mocks.notify).toHaveBeenCalledWith(
			expect.objectContaining({ jobs: [] }),
		);
	});
	it("cleans an uncommitted copied file when processing reservation fails", async () => {
		mocks.values.mockRejectedValueOnce(new Error("queue insert failed"));
		const result = await BulkOperationService.bulkCopyToSource(
			sourceId,
			[one],
			targetId,
		);
		expect(result.items[0]).toMatchObject({ status: "failed" });
		expect(mocks.deleteFile).toHaveBeenCalledWith(
			directory,
			`copied-${one}.png`,
		);
		expect(mocks.notify).not.toHaveBeenCalled();
	});
	it.each([
		["bulkCopyToSource", "delete-fails"],
		["bulkCopyToSource", "missing-target"],
		["bulkCopyToSource", "lookup-fails"],
		["bulkMoveToSource", "delete-fails"],
	] as const)(
		"marks %s unsafe to retry when compensation %s leaves a copied file",
		async (operation, failure) => {
			const copiedFile = path.join(directory, `copied-${one}.png`);
			await writeFile(copiedFile, "uncommitted-copy");
			mocks.values.mockRejectedValueOnce(
				new Error("processing reservation failed"),
			);
			if (failure === "delete-fails")
				mocks.deleteFile.mockRejectedValueOnce(
					new Error("storage unavailable"),
				);
			else if (failure === "missing-target")
				mocks.findSource.mockResolvedValueOnce(null);
			else
				mocks.findSource.mockRejectedValueOnce(
					new Error("target lookup unavailable"),
				);
			const result = await BulkOperationService[operation](
				sourceId,
				[one],
				targetId,
			);
			expect(await readFile(copiedFile, "utf8")).toBe("uncommitted-copy");
			expect(result.items).toEqual([
				expect.objectContaining({
					mediaId: one,
					status: "failed",
					retryable: false,
				}),
			]);
			expect(mocks.notify).not.toHaveBeenCalled();
		},
	);
	it("keeps a transfer retryable when rollback deletes its copied file successfully", async () => {
		const copiedFile = path.join(directory, `copied-${one}.png`);
		await writeFile(copiedFile, "uncommitted-copy");
		mocks.values.mockRejectedValueOnce(
			new Error("processing reservation failed"),
		);
		mocks.deleteFile.mockImplementationOnce(
			async (base: string, relative: string) => {
				await rm(path.join(base, relative));
			},
		);
		const result = await BulkOperationService.bulkCopyToSource(
			sourceId,
			[one],
			targetId,
		);
		expect(result.items[0]).toMatchObject({ status: "failed" });
		expect(
			result.items[0].status === "failed" && result.items[0].retryable,
		).not.toBe(false);
		await expect(readFile(copiedFile)).rejects.toThrow();
	});
	it("does not perform any side effects when a group contains a wrong-source item", async () => {
		mocks.findByIds.mockResolvedValue([
			{ id: one, mediaSourceId: sourceId },
			{ id: two, mediaSourceId: targetId },
		]);
		const result = await BulkOperationService.bulkCopyToSource(
			sourceId,
			[one, two],
			targetId,
		);
		expect(result.items.map((item) => item.status)).toEqual([
			"not_processed",
			"failed",
		]);
		expect(mocks.copyMedia).not.toHaveBeenCalled();
	});
	it("deduplicates requested IDs so the same item is copied only once", async () => {
		await BulkOperationService.bulkCopyToSource(sourceId, [one, one], targetId);
		expect(mocks.copyMedia).toHaveBeenCalledTimes(1);
	});
	it("reports actual file-move partial success and persists only successful items", async () => {
		await writeFile(path.join(directory, "one.png"), "image-one");
		const result = await BulkOperationService.bulkMoveMedia(
			sourceId,
			[one, two],
			"destination",
		);
		expect(result.items.map((item) => item.status)).toEqual([
			"succeeded",
			"failed",
		]);
		expect(
			await readFile(path.join(directory, "destination", "one.png"), "utf8"),
		).toBe("image-one");
		expect(mocks.bulkUpdatePaths).toHaveBeenCalledExactlyOnceWith([
			{ id: one, fileName: "one.png", filePath: "destination/one.png" },
		]);
	});
	it("restores the original file when the move's database update fails", async () => {
		await writeFile(path.join(directory, "one.png"), "image-one");
		mocks.bulkUpdatePaths.mockRejectedValue(new Error("db failure"));
		const result = await BulkOperationService.bulkMoveMedia(
			sourceId,
			[one],
			"destination",
		);
		expect(result.items[0]).toMatchObject({
			status: "failed",
			retryable: true,
		});
		expect(await readFile(path.join(directory, "one.png"), "utf8")).toBe(
			"image-one",
		);
	});
});
