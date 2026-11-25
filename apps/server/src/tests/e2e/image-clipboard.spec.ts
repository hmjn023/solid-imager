import sharp from "sharp";
import { apiRequest } from "./support/api";
import {
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SOURCE_ID,
	mediaPath,
	sourcePath,
} from "./support/fixture";
import { readClipboardImage } from "./support/image-clipboard";
import { expect, test, waitForAppHydration } from "./support/test";

test("copies the original image from grid, list, and detail menus", async ({
	page,
}) => {
	await page.goto(sourcePath());
	await waitForAppHydration(page);
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
		origin: new URL(page.url()).origin,
	});
	const copyItem = page.getByRole("menuitem", {
		name: "画像をコピー",
		exact: true,
	});
	const moreActions = page.getByRole("button", {
		name: "その他の操作",
		exact: true,
	});
	const primaryImage = { width: 256, height: 256, pixel: [224, 231, 255, 255] };
	const similarImage = { width: 256, height: 256, pixel: [238, 242, 255, 255] };

	await page
		.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`)
		.click({ button: "right" });
	await copyItem.click();
	await expect.poll(() => readClipboardImage(page)).toEqual(primaryImage);

	await page.getByRole("button", { name: "リスト表示", exact: true }).click();
	const rowActions = page.getByRole("button", {
		name: `${E2E_SIMILAR_FILE_NAME}の操作`,
		exact: true,
	});
	await rowActions.click();
	await copyItem.click();
	await expect.poll(() => readClipboardImage(page)).toEqual(similarImage);
	await expect(page).toHaveURL((url) => url.pathname === sourcePath());
	await expect(copyItem).toHaveCount(0);

	await rowActions.click();
	await page
		.getByRole("menuitem", { name: "詳細を開く", exact: true })
		.press("Enter");
	await expect(page).toHaveURL(
		(url) => url.pathname === mediaPath(E2E_SIMILAR_MEDIA_ID),
	);
	await page.evaluate(() => navigator.clipboard.writeText(""));
	await moreActions.click();
	await copyItem.click();
	await expect.poll(() => readClipboardImage(page)).toEqual(similarImage);

	await page.reload();
	await waitForAppHydration(page);
	await page.evaluate(() => navigator.clipboard.writeText(""));
	await moreActions.click();
	await copyItem.click();
	await expect.poll(() => readClipboardImage(page)).toEqual(similarImage);
});

test("copies the original image from JPEG as PNG", async ({
	page,
	request,
}) => {
	const name = "clipboard-test.jpg";
	const buffer = await sharp({
		create: { width: 31, height: 19, channels: 3, background: "white" },
	})
		.jpeg()
		.toBuffer();
	const uploaded = await request.post(`/api/sources/${E2E_SOURCE_ID}/media`, {
		multipart: { file: { name, mimeType: "image/jpeg", buffer } },
	});
	expect(uploaded.ok()).toBe(true);
	expect(await uploaded.json()).toMatchObject({ success: true });

	let mediaId = "";
	try {
		await expect
			.poll(async () => {
				const response = await apiRequest(request, "media/search", {
					sourceId: E2E_SOURCE_ID,
					params: { sort: "date", order: "desc", limit: 5 },
				});
				const { media } = await response.json();
				mediaId =
					media.find((item: { fileName: string }) => item.fileName === name)
						?.id ?? "";
				return mediaId;
			})
			.not.toBe("");
		await page.goto(mediaPath(mediaId));
		await waitForAppHydration(page);
		await page
			.context()
			.grantPermissions(["clipboard-read", "clipboard-write"], {
				origin: new URL(page.url()).origin,
			});
		await page
			.getByRole("button", { name: "その他の操作", exact: true })
			.click();
		await page
			.getByRole("menuitem", { name: "画像をコピー", exact: true })
			.click();
		await expect(
			page.getByText("クリップボードにコピーしました", { exact: true }),
		).toBeVisible();
		await expect
			.poll(() => readClipboardImage(page))
			.toEqual({
				width: 31,
				height: 19,
				pixel: [255, 255, 255, 255],
			});
	} finally {
		await page.goto("about:blank");
		if (mediaId) {
			const deleted = await apiRequest(request, "media/delete", {
				sourceId: E2E_SOURCE_ID,
				mediaId,
			});
			expect(deleted.ok()).toBe(true);
		}
	}
});
