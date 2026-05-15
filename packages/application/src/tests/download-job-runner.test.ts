import { describe, expect, it, vi } from "vite-plus/test";
import type { JobRecord } from "../ports/job-repository";
import {
	getDownloadItemFromJob,
	queueDownloadJobs,
	runDownloadImageJob,
} from "../services/download-job-runner";

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
	const now = new Date();
	return {
		id: "job-1",
		type: "downloadImage",
		mediaSourceId: "source-1",
		status: "pending",
		payload: {
			targetUrl: "https://example.com/image.png",
			imageUrl: "https://example.com/image.png",
		},
		result: null,
		error: null,
		createdAt: now,
		updatedAt: now,
		parentId: null,
		...overrides,
	};
}

describe("download-job-runner", () => {
	it("normalizes legacy payload fields", () => {
		const item = getDownloadItemFromJob(
			makeJob({
				payload: {
					imageUrl: "https://example.com/image.png",
					sourceUrl: "https://example.com/post",
					description: "hello",
				},
			}),
		);
		expect(item.targetUrl).toBe("https://example.com/image.png");
		expect(item.sourceUrls).toEqual(["https://example.com/post"]);
		expect(item.description).toBe("hello");
	});

	it("queues canonical download jobs", async () => {
		const create = vi.fn(async () => makeJob());
		const count = await queueDownloadJobs({ create }, "source-1", [
			{
				targetUrl: "https://example.com/image.png",
			},
		]);

		expect(count).toBe(1);
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "downloadImage",
				mediaSourceId: "source-1",
				payload: expect.objectContaining({
					imageUrl: "https://example.com/image.png",
					sourceUrl: "https://example.com/image.png",
				}),
			}),
		);
	});

	it("publishes download-error on failure", async () => {
		const downloadError = vi.fn(async () => undefined);
		await expect(
			runDownloadImageJob(makeJob(), {
				resolveBasePath: vi.fn(async () => "/tmp/source"),
				selectMode: vi.fn(() => "direct" as const),
				download: vi.fn(async () => {
					throw new Error("boom");
				}),
				registerMedia: vi.fn(async () => undefined),
				events: { downloadError },
			}),
		).rejects.toThrow("boom");

		expect(downloadError).toHaveBeenCalledWith(
			expect.objectContaining({
				mediaSourceId: "source-1",
				url: "https://example.com/image.png",
				error: "boom",
			}),
		);
	});
});
