import {
	pixivDownloadItem,
	type PixivArtwork,
} from "@solid-imager/core/external-viewer";
import { pendingImportJobSchema } from "@solid-imager/core/media";
import { z } from "zod";
import {
	E2E_PRIMARY_MEDIA_ID,
	E2E_PRIMARY_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SOURCE_ID,
	getFixtureMediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("import inbox previews the full image and details without changing the selection", async ({
	page,
}, testInfo) => {
	await page.goto("/about");
	await waitForAppHydration(page);
	const titlePrefix =
		"制作サンプルのキャラクター設定資料と仕上げの確認用イメージ";
	const items = [
		{ mediaId: E2E_PRIMARY_MEDIA_ID, kind: "昼光版", author: "大橋 葵" },
		{ mediaId: E2E_SIMILAR_MEDIA_ID, kind: "夜景版", author: "大橋 茜" },
	].map(({ mediaId, kind, author }) => ({
		targetUrl: new URL(
			`/api/sources/${E2E_SOURCE_ID}/thumbnail/${mediaId}`,
			page.url(),
		).toString(),
		description: `${titlePrefix}・${kind}`,
		fileName: `設定資料-${kind}.png`,
		authors: [{ name: author }],
	}));
	const response = await page.request.post("/api/rpc/imports/bulkAdd", {
		data: { json: { items } },
	});
	expect(response.ok()).toBe(true);
	const list = await page.request.post("/api/rpc/imports/listPending", {
		data: { json: null },
	});
	expect(list.ok()).toBe(true);
	const pending = z
		.array(pendingImportJobSchema)
		.parse((await list.json()).json);
	const jobs = pending.filter((job) =>
		items.some((item) => item.description === job.item.description),
	);
	try {
		expect(jobs).toHaveLength(2);
		const openInbox = page.getByRole("button", { name: /^取り込み待ち/ });
		await expect(openInbox).toBeEnabled();
		await openInbox.click();
		const inbox = page.getByRole("dialog", {
			name: "取り込み待ち",
			exact: true,
		});
		await expect(inbox).toBeVisible();
		await expect(
			inbox.getByRole("button", { name: "内容を見る", exact: true }),
		).toHaveCount(2);
		await expect
			.poll(() =>
				inbox
					.locator("img")
					.evaluateAll(
						(images: HTMLImageElement[]) =>
							images.filter((image) => image.naturalWidth > 0).length,
					),
			)
			.toBe(2);
		await page.screenshot({
			path: testInfo.outputPath("import-inbox.png"),
			animations: "disabled",
		});
		const second = items[1];
		await inbox.getByText(second.description, { exact: true }).click();
		await expect(inbox.getByText("2件中1件 選択中")).toBeVisible();
		const openPreview = inbox.getByRole("button", {
			name: "内容を見る",
			exact: true,
			description: second.description,
		});
		await openPreview.click();
		const preview = page.getByRole("dialog", { name: "取り込みプレビュー" });
		await expect(preview).toBeVisible();
		await expect(
			preview.getByText(second.description, { exact: true }),
		).toBeVisible();
		await expect(
			preview.getByText(second.fileName, { exact: true }),
		).toBeVisible();
		await expect(
			preview.getByText(second.authors[0].name, { exact: true }),
		).toBeVisible();
		const image = preview.getByRole("img", { name: "取り込みプレビュー" });
		await expect
			.poll(() =>
				image.evaluate((element: HTMLImageElement) => element.naturalWidth),
			)
			.toBeGreaterThan(0);
		await expect(image).toHaveCSS("object-fit", "contain");
		await page.screenshot({
			path: testInfo.outputPath("import-preview.png"),
			animations: "disabled",
		});
		await page.keyboard.press("Escape");
		await expect(preview).toBeHidden();
		await expect(openPreview).toBeFocused();
		await expect(inbox.getByText("2件中1件 選択中")).toBeVisible();
	} finally {
		const cancel = await page.request.post("/api/rpc/imports/cancel", {
			data: { json: { jobIds: jobs.map((job) => job.id) } },
		});
		expect(cancel.ok()).toBe(true);
	}
});

test("import inbox previews Pixiv originals and ugoira through the image proxy", async ({
	page,
}) => {
	const cdn = "https://i.pximg.net";
	const date = "img/2026/01/01/00/00/00/";
	const original = `${cdn}/img-original/${date}123_p0.png`;
	const artwork = (id: number): PixivArtwork => {
		const poster = `${cdn}/img-master/${date}${id}_p0_master1200.jpg`;
		return {
			id,
			title: `Ugoira ${id}`,
			author: "Pixiv artist",
			userId: "23",
			pageCount: 1,
			createdAt: "2026-01-01T00:00:00Z",
			tags: [],
			thumbnail: poster,
			isAnimation: true,
			pages: [{ preview: poster, original: null, width: 640, height: 400 }],
			animation: {
				zip: `${cdn}/img-zip-ugoira/${date}${id}_ugoira640x400.zip`,
				metadata: { frames: [{ file: "000000.jpg", delay: 100 }] },
			},
		};
	};
	const queuedAnimation = artwork(124);
	const olderAnimation = artwork(125);
	const newItem = pixivDownloadItem(queuedAnimation, 0);
	if (!newItem || !olderAnimation.animation)
		throw new Error("Missing ugoira fixture");
	const items = [
		{ targetUrl: original, description: "Pixiv original" },
		newItem,
		{
			targetUrl: olderAnimation.animation.zip,
			description: olderAnimation.title,
			ugoira: olderAnimation.animation.metadata,
		},
	];
	const previewUrls = [
		original,
		...[queuedAnimation, olderAnimation].map((post) => post.pages[0].preview),
	];
	await page.route(`${cdn}/**`, (route) => route.fulfill({ status: 403 }));
	await page.route("**/api/pixiv-image?*", (route) => {
		const url = new URL(route.request().url()).searchParams.get("url");
		expect(previewUrls).toContain(url);
		return route.fulfill({ path: getFixtureMediaPath(E2E_PRIMARY_FILE_NAME) });
	});
	const lookups: number[] = [];
	await page.route("**/api/rpc/viewer/pixivArtwork", (route) => {
		const id: number = route.request().postDataJSON().json.id;
		lookups.push(id);
		return route.fulfill({ json: { json: olderAnimation } });
	});

	await page.goto("/about");
	await waitForAppHydration(page);
	const response = await page.request.post("/api/rpc/imports/bulkAdd", {
		data: { json: { items } },
	});
	expect(response.ok()).toBe(true);
	const list = await page.request.post("/api/rpc/imports/listPending", {
		data: { json: null },
	});
	expect(list.ok()).toBe(true);
	const pending = z
		.array(pendingImportJobSchema)
		.parse((await list.json()).json);
	const jobs = pending.filter((job) =>
		items.some((item) => item.targetUrl === job.item.targetUrl),
	);
	try {
		expect(jobs).toHaveLength(3);
		expect(
			jobs.find((job) => job.item.targetUrl === newItem.targetUrl)?.item
				.previewUrl,
		).toBe(queuedAnimation.pages[0].preview);
		await page.getByRole("button", { name: /^取り込み待ち/ }).click();
		const inbox = page.getByRole("dialog", {
			name: "取り込み待ち",
			exact: true,
		});
		await expect
			.poll(
				async () =>
					new Set(
						await inbox
							.locator("img")
							.evaluateAll((images: HTMLImageElement[]) =>
								images
									.filter((img) => img.naturalWidth > 0)
									.map((img) => new URL(img.src).searchParams.get("url")),
							),
					),
			)
			.toEqual(new Set(previewUrls));
		expect(lookups).toEqual([olderAnimation.id]);

		for (const [index, item] of items.entries()) {
			await inbox
				.getByRole("button", {
					name: "内容を見る",
					exact: true,
					description: item.description ?? undefined,
				})
				.click();
			const preview = page.getByRole("dialog", { name: "取り込みプレビュー" });
			const image = preview.getByRole("img", { name: "取り込みプレビュー" });
			await expect
				.poll(() =>
					image.evaluate(
						(img: HTMLImageElement) =>
							img.naturalWidth > 0 && new URL(img.src).searchParams.get("url"),
					),
				)
				.toBe(previewUrls[index]);
			await page.keyboard.press("Escape");
			await expect(preview).toBeHidden();
		}
	} finally {
		const cancel = await page.request.post("/api/rpc/imports/cancel", {
			data: { json: { jobIds: jobs.map((job) => job.id) } },
		});
		expect(cancel.ok()).toBe(true);
	}
});

test("import inbox shows Danbooru video posters and plays the original on demand", async ({
	page,
}) => {
	const cdn = "https://cdn.donmai.us";
	const clips = [171, 172].map((id) => ({
		id,
		fileUrl: `${cdn}/original/${id}.webm`,
		previewUrl: `${cdn}/preview/${id}.jpg`,
	}));
	const [current, legacy] = clips;
	const items = clips.map((clip) => ({
		targetUrl: clip.fileUrl,
		description: `Danbooru Post #${clip.id}`,
		sourceUrls: [`https://danbooru.donmai.us/posts/${clip.id}`],
		previewUrl: clip === current ? clip.previewUrl : undefined,
	}));
	const thumbnails = clips.map((clip) => clip.previewUrl);
	await page.route("**/api/danbooru-thumbnail?*", (route) => {
		const url = new URL(route.request().url()).searchParams.get("url");
		expect(thumbnails).toContain(url);
		return route.fulfill({ path: getFixtureMediaPath(E2E_PRIMARY_FILE_NAME) });
	});
	const loadedPosts: number[] = [];
	await page.route("**/api/rpc/danbooru/getPost", (route) => {
		const id: number = route.request().postDataJSON().json.id;
		loadedPosts.push(id);
		return route.fulfill({ json: { json: legacy } });
	});
	const videoRequests: string[] = [];
	await page.route(`${cdn}/original/*.webm`, (route) => {
		videoRequests.push(route.request().url());
		return route.fulfill({
			path: "src/tests/e2e/ui-gallery/video-player.webm",
			contentType: "video/webm",
		});
	});

	await page.goto("/about");
	await waitForAppHydration(page);
	const response = await page.request.post("/api/rpc/imports/bulkAdd", {
		data: { json: { items } },
	});
	expect(response.ok()).toBe(true);
	const list = await page.request.post("/api/rpc/imports/listPending", {
		data: { json: null },
	});
	const pending = z
		.array(pendingImportJobSchema)
		.parse((await list.json()).json);
	const jobs = pending.filter((job) =>
		items.some((item) => item.targetUrl === job.item.targetUrl),
	);

	try {
		expect(jobs).toHaveLength(clips.length);
		await page.getByRole("button", { name: /^取り込み待ち/ }).click();
		const inbox = page.getByRole("dialog", {
			name: "取り込み待ち",
			exact: true,
		});
		await expect
			.poll(async () =>
				inbox.locator("img").evaluateAll((images: HTMLImageElement[]) =>
					images
						.filter((image) => image.naturalWidth > 0)
						.map((image) => new URL(image.src).searchParams.get("url"))
						.sort((left, right) => String(left).localeCompare(String(right))),
				),
			)
			.toEqual(thumbnails);
		expect(loadedPosts).toEqual([legacy.id]);
		expect(videoRequests).toEqual([]);

		for (const item of items) {
			await inbox
				.getByRole("button", {
					name: "内容を見る",
					exact: true,
					description: item.description,
				})
				.click();
			const preview = page.getByRole("dialog", { name: "取り込みプレビュー" });
			const video = preview.locator("video");
			await expect(video).toHaveAttribute("src", item.targetUrl);
			await expect
				.poll(() =>
					video.evaluate((element: HTMLVideoElement) => element.readyState),
				)
				.toBeGreaterThan(0);
			await preview.locator("media-play-button").click();
			await expect
				.poll(() =>
					video.evaluate((element: HTMLVideoElement) => element.paused),
				)
				.toBe(false);
			await page.keyboard.press("Escape");
			await expect(preview).toBeHidden();
		}
	} finally {
		const cancel = await page.request.post("/api/rpc/imports/cancel", {
			data: { json: { jobIds: jobs.map((job) => job.id) } },
		});
		expect(cancel.ok()).toBe(true);
	}
});
