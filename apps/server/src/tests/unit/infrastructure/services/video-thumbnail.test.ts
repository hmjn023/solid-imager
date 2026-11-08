import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	thumbnailPath: "",
	generateThumbnailForMedia: vi.fn(),
}));
vi.mock("~/infrastructure/jobs/thumbnails", () => ({
	getThumbnailPath: () => mocks.thumbnailPath,
	generateThumbnailForMedia: mocks.generateThumbnailForMedia,
	THUMBNAIL_SIZE_LARGE: 512,
}));
import { resolveVideoThumbnail } from "~/infrastructure/services/video-thumbnail";

const media = {
	id: "11111111-1111-4111-8111-111111111111",
	mediaSourceId: "22222222-2222-4222-8222-222222222222",
	modifiedAt: new Date("2026-01-01"),
};

describe("resolveVideoThumbnail", () => {
	let directory: string;
	beforeEach(async () => {
		directory = await mkdtemp(path.join(tmpdir(), "video-thumbnail-test-"));
		mocks.thumbnailPath = path.join(directory, "thumbnail.webp");
		mocks.generateThumbnailForMedia.mockReset();
		mocks.generateThumbnailForMedia.mockImplementation(async () => {
			await writeFile(mocks.thumbnailPath, "generated still image");
		});
	});
	afterEach(async () => {
		await rm(directory, { recursive: true, force: true });
	});

	it("reuses a nonempty thumbnail current for the original video", async () => {
		await writeFile(mocks.thumbnailPath, "cached still image");
		await utimes(mocks.thumbnailPath, media.modifiedAt, media.modifiedAt);
		expect(await resolveVideoThumbnail(media)).toBe(mocks.thumbnailPath);
		expect(mocks.generateThumbnailForMedia).not.toHaveBeenCalled();
	});

	it.each(["missing", "stale", "legacy", "empty"])(
		"generates a %s thumbnail before returning its path",
		async (state) => {
			if (state !== "missing") {
				await writeFile(
					mocks.thumbnailPath,
					state === "empty" ? "" : "old still image",
				);
				const timestamp =
					state === "stale"
						? new Date("2025-01-01")
						: state === "legacy"
							? new Date("2026-01-02")
							: media.modifiedAt;
				await utimes(mocks.thumbnailPath, timestamp, timestamp);
			}
			expect(await resolveVideoThumbnail(media)).toBe(mocks.thumbnailPath);
			expect(mocks.generateThumbnailForMedia).toHaveBeenCalledExactlyOnceWith(
				media.mediaSourceId,
				media.id,
				512,
			);
		},
	);

	it("shares an in-flight generation across concurrent tagging and vector jobs", async () => {
		let finishGeneration: (() => void) | undefined;
		mocks.generateThumbnailForMedia.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finishGeneration = resolve;
				}),
		);
		const pending = Array.from({ length: 3 }, () =>
			resolveVideoThumbnail(media),
		);
		await vi.waitFor(() =>
			expect(mocks.generateThumbnailForMedia).toHaveBeenCalledTimes(1),
		);
		finishGeneration?.();
		expect(await Promise.all(pending)).toEqual(
			Array(3).fill(mocks.thumbnailPath),
		);
	});

	it("propagates generation failure and allows a later job to retry", async () => {
		mocks.generateThumbnailForMedia.mockRejectedValueOnce(
			new Error("FFmpeg failed"),
		);
		await expect(resolveVideoThumbnail(media)).rejects.toThrow("FFmpeg failed");
		expect(await resolveVideoThumbnail(media)).toBe(mocks.thumbnailPath);
		expect(mocks.generateThumbnailForMedia).toHaveBeenCalledTimes(2);
	});

	it("propagates cache filesystem errors instead of treating them as a missing thumbnail", async () => {
		const nonDirectory = path.join(directory, "file");
		await writeFile(nonDirectory, "not a directory");
		mocks.thumbnailPath = path.join(nonDirectory, "thumbnail.webp");
		await expect(resolveVideoThumbnail(media)).rejects.toMatchObject({
			code: "ENOTDIR",
		});
		expect(mocks.generateThumbnailForMedia).not.toHaveBeenCalled();
	});
});
