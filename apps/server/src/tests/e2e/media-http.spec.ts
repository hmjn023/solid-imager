import { randomUUID } from "node:crypto";
import { copyFile, mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import { mediaContentPath } from "@solid-imager/core/http";
import { mediaSearchResponseSchema } from "@solid-imager/core/media";
import { apiRequest } from "./support/api";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SOURCE_ID,
	getE2eRuntimeDir,
	getFixtureMediaPath,
} from "./support/fixture";
import { expect, test } from "./support/test";

test("the oRPC media endpoint serves byte ranges and a bodyless HEAD @dev-smoke", async ({
	request,
}) => {
	const path = mediaContentPath(E2E_SOURCE_ID, E2E_PRIMARY_MEDIA_ID);
	const original = await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
	const head = await request.head(path, { headers: { Range: "bytes=0-7" } });
	expect(head.status()).toBe(200);
	expect(head.headers()).toMatchObject({
		"accept-ranges": "bytes",
		"content-length": String(original.length),
		"content-type": "image/png",
	});
	expect(head.headers()).not.toHaveProperty("content-range");
	expect(await head.body()).toHaveLength(0);

	const partial = await request.get(path, { headers: { Range: "bytes=0-7" } });
	expect(partial.status()).toBe(206);
	expect(partial.headers()).toMatchObject({
		"content-length": "8",
		"content-range": `bytes 0-7/${original.length}`,
		"content-type": "image/png",
	});
	expect(await partial.body()).toEqual(original.subarray(0, 8));

	const invalid = await request.get(path, {
		headers: { Range: `bytes=${original.length}-` },
	});
	expect(invalid.status()).toBe(416);
	expect(invalid.headers()["content-range"]).toBe(`bytes */${original.length}`);
});

test("Chromium seeks a video served by the oRPC media endpoint", async ({
	page,
	request,
}) => {
	const directory = await mkdtemp(path.join(getE2eRuntimeDir(), "seek-"));
	const name = "seek-test.webm";
	const sourceId = randomUUID();
	let sourceCreated = false;
	try {
		await copyFile(
			new URL("./ui-gallery/video-player.webm", import.meta.url),
			path.join(directory, name),
		);
		const created = await apiRequest(request, "sources/create", {
			id: sourceId,
			name: `Seek test ${sourceId}`,
			description: null,
			type: "local",
			connectionInfo: { path: directory },
		});
		expect(created.ok()).toBe(true);
		sourceCreated = true;
		const sync = await apiRequest(request, "sources/sync", { ids: [sourceId] });
		expect(sync.ok()).toBe(true);

		let mediaId = "";
		await expect
			.poll(async () => {
				const response = await apiRequest(request, "media/search", {
					sourceId,
					params: { limit: 1, offset: 0 },
				});
				const result = mediaSearchResponseSchema.parse(await response.json());
				mediaId = result.media.find((item) => item.fileName === name)?.id ?? "";
				return mediaId;
			})
			.not.toBe("");
		await page.goto(mediaContentPath(sourceId, mediaId));
		const video = page.locator("video");
		await expect
			.poll(() =>
				video.evaluate((element: HTMLVideoElement) => element.duration),
			)
			.toBeGreaterThan(1);
		await video.evaluate((element: HTMLVideoElement) => {
			element.pause();
			element.currentTime = 1;
		});
		await expect
			.poll(() =>
				video.evaluate((element: HTMLVideoElement) =>
					element.seeking ? 0 : element.currentTime,
				),
			)
			.toBeCloseTo(1);
	} finally {
		try {
			await page.goto("about:blank");
		} finally {
			if (sourceCreated)
				await apiRequest(request, "sources/delete", { id: sourceId });
		}
		// The harness removes the directory after shutting down thumbnail jobs.
	}
});
