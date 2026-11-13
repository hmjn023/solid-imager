import type { Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	mediaPath,
	sourcePath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const mobileProjects = ["responsive-320", "responsive-375"];

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth -
			document.documentElement.clientWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
}

async function sampleImagePixel(
	page: Page,
	accessibleName: string,
): Promise<number[]> {
	const image = page.locator("img.object-contain").and(
		page.getByRole("img", {
			name: accessibleName,
			exact: true,
		}),
	);
	await expect(image).toBeVisible();
	return image.evaluate((element) => {
		if (!(element instanceof HTMLImageElement)) {
			throw new Error("Expected an image element");
		}
		const canvas = document.createElement("canvas");
		canvas.width = element.naturalWidth;
		canvas.height = element.naturalHeight;
		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error("Failed to create a 2D canvas context");
		}
		context.drawImage(element, 0, 0);
		return [...context.getImageData(128, 64, 1, 1).data];
	});
}

async function openMediaDetail(
	page: Page,
	mediaId: string,
	returnPath: string,
): Promise<void> {
	const media = page.locator(`[data-media-id="${mediaId}"]`);
	const detailPath = mediaPath(mediaId);
	await media.click();
	await expect
		.poll(() => [returnPath, detailPath].includes(new URL(page.url()).pathname))
		.toBe(true);
	if (new URL(page.url()).pathname === returnPath) {
		await expect(media).toHaveAttribute("aria-current", "true");
		await media.dblclick();
	}
	await expect(page).toHaveURL(detailPath);
}

test("media detail follows the second thumbnail after returning to the list", async ({
	page,
}) => {
	await page.goto(sourcePath());
	await waitForAppHydration(page);

	const primaryResponse = page.waitForResponse(
		(response) =>
			response.url().endsWith(mediaPath(E2E_PRIMARY_MEDIA_ID)) &&
			response.request().resourceType() === "fetch",
	);
	await openMediaDetail(page, E2E_PRIMARY_MEDIA_ID, sourcePath());
	expect((await primaryResponse).headers()["cache-control"]).toBe("no-store");
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
	const primaryPixel = await sampleImagePixel(page, E2E_PRIMARY_FILE_NAME);

	await page.goBack();
	await expect.poll(() => new URL(page.url()).pathname).toBe(sourcePath());
	const similarResponse = page.waitForResponse(
		(response) =>
			response.url().endsWith(mediaPath(E2E_SIMILAR_MEDIA_ID)) &&
			response.request().resourceType() === "fetch",
	);
	await openMediaDetail(page, E2E_SIMILAR_MEDIA_ID, sourcePath());
	expect((await similarResponse).headers()["cache-control"]).toBe("no-store");
	await expect(
		page.getByRole("img", { name: E2E_SIMILAR_FILE_NAME, exact: true }),
	).toBeVisible();
	const similarPixel = await sampleImagePixel(page, E2E_SIMILAR_FILE_NAME);
	expect(similarPixel).not.toEqual(primaryPixel);
});

test("media detail follows the second search result after returning to search", async ({
	page,
}) => {
	await page.goto("/search");
	await waitForAppHydration(page);
	await expect(
		page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`),
	).toBeVisible();

	await openMediaDetail(page, E2E_PRIMARY_MEDIA_ID, "/search");
	const primaryPixel = await sampleImagePixel(page, E2E_PRIMARY_FILE_NAME);

	await page.goBack();
	await expect.poll(() => new URL(page.url()).pathname).toBe("/search");
	await openMediaDetail(page, E2E_SIMILAR_MEDIA_ID, "/search");
	const similarPixel = await sampleImagePixel(page, E2E_SIMILAR_FILE_NAME);
	expect(similarPixel).not.toEqual(primaryPixel);
});

test(
	"media detail returns to its saved collection URL after direct navigation",
	{
		tag: "@desktop-only",
	},
	async ({ page }) => {
		await page.goto(mediaPath(E2E_PRIMARY_MEDIA_ID));
		await waitForAppHydration(page);
		const savedReturnPath = "/search#results";
		await page.evaluate((returnPath) => {
			sessionStorage.setItem("solid-imager:media-return", returnPath);
		}, savedReturnPath);

		await page.getByRole("button", { name: "一覧に戻る", exact: true }).click();
		await expect
			.poll(() => {
				const url = new URL(page.url());
				return `${url.pathname}${url.search}${url.hash}`;
			})
			.toBe(savedReturnPath);
	},
);

test(
	"media detail list back does not re-enter detail on browser back",
	{
		tag: "@desktop-only",
	},
	async ({ page }) => {
		await page.goto("/about");
		await waitForAppHydration(page);
		await page.getByRole("link", { name: "ライブラリ", exact: true }).click();
		await waitForAppHydration(page);
		await expect(
			page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`),
		).toBeVisible();

		await openMediaDetail(page, E2E_PRIMARY_MEDIA_ID, "/search");
		await page.getByRole("button", { name: "一覧に戻る", exact: true }).click();
		await expect.poll(() => new URL(page.url()).pathname).toBe("/search");

		await page.goBack();
		await expect.poll(() => new URL(page.url()).pathname).toBe("/about");
		await expect(
			page.getByRole("button", { name: "一覧に戻る", exact: true }),
		).toHaveCount(0);
	},
);

test("media detail, manager, and settings remain usable on narrow screens", async ({
	page,
}, testInfo) => {
	if (testInfo.project.name === "responsive-768") {
		await page.setViewportSize({ width: 940, height: 1036 });
	}
	await page.goto(mediaPath());
	await expect(
		page.getByRole("heading", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
	if (testInfo.project.name === "responsive-desktop") {
		const verticalOverflow = await page.evaluate(
			() => document.documentElement.scrollHeight - window.innerHeight,
		);
		expect(verticalOverflow).toBeLessThanOrEqual(1);
		const viewer = page.locator("[data-media-viewer]");
		const image = page.getByRole("img", {
			name: E2E_PRIMARY_FILE_NAME,
			exact: true,
		});
		const viewerState = await Promise.all([
			viewer.evaluate((element) => element.clientHeight),
			image.evaluate((element) => element.clientHeight),
		]);
		expect(viewerState[1]).toBeGreaterThan(0);
		expect(viewerState[1]).toBeLessThanOrEqual(viewerState[0]);
	}
	if (testInfo.project.name === "responsive-768") {
		const viewer = page.locator("[data-media-viewer]");
		const image = page.getByRole("img", {
			name: E2E_PRIMARY_FILE_NAME,
			exact: true,
		});
		const viewerBox = await viewer.boundingBox();
		const imageBox = await image.boundingBox();
		expect(viewerBox).not.toBeNull();
		expect(imageBox).not.toBeNull();
		expect(viewerBox?.width ?? 0).toBeGreaterThanOrEqual(640);
		expect(imageBox?.width ?? 0).toBeGreaterThanOrEqual(640);
	}
	const detailsHeading = page.getByRole("heading", {
		name: "ファイル情報",
		exact: true,
	});
	await detailsHeading.scrollIntoViewIfNeeded();
	await expect(detailsHeading).toBeInViewport();
	await expectNoHorizontalOverflow(page);

	await page.goto("/manager");
	await expect(
		page.getByRole("heading", { name: "管理", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	await expectNoHorizontalOverflow(page);

	const projectName = `Responsive project ${testInfo.project.name}`;
	await page
		.getByRole("button", { name: "プロジェクトを新規作成", exact: true })
		.click();
	const projectDialog = page.getByRole("dialog");
	await expect(projectDialog).toBeVisible();
	await expect(
		projectDialog.getByRole("heading", {
			name: "プロジェクトを作成",
			exact: true,
		}),
	).toBeVisible();
	await projectDialog.getByLabel("名前", { exact: true }).fill(projectName);
	await projectDialog
		.getByRole("button", { name: "保存", exact: true })
		.click();
	await expect(projectDialog).toBeHidden();
	const projectRow = page.getByRole("button", {
		name: projectName,
		exact: true,
	});
	await expect(projectRow).toBeVisible();
	await projectRow.click();

	await page
		.getByRole("button", { name: `${projectName}を編集`, exact: true })
		.click();
	await expect(projectDialog).toBeVisible();
	await expect(
		projectDialog.getByLabel("名前", { exact: true }),
	).toBeInViewport();
	await page.keyboard.press("Escape");
	await expect(projectDialog).toBeHidden();

	await page
		.getByRole("button", { name: /^一括タグ付け(?: AIタグ付けジョブを登録)?$/ })
		.click();
	await expect(
		page.getByRole("heading", { name: "一括タグ付け", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "対象を確認", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "タグ付けを開始", exact: true }),
	).toBeVisible();
	await expectNoHorizontalOverflow(page);

	await page.goto("/config");
	await expect(
		page.getByRole("heading", { name: "設定", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	const saveButton = page.getByRole("button", {
		name: "変更を保存",
		exact: true,
	});
	const concurrencyInput = page.getByLabel("同時実行数", { exact: true });
	await concurrencyInput.fill("0");
	await expect(concurrencyInput).toHaveAttribute("aria-invalid", "true");
	await expect(saveButton).toBeDisabled();
	await concurrencyInput.fill("3");
	await expect(concurrencyInput).toHaveAttribute("aria-invalid", "false");
	await expect(saveButton).toBeEnabled();

	for (const category of [
		{ tab: "ジョブ", heading: "ジョブ処理" },
		{ tab: "AI", heading: "AIサービス" },
		{ tab: "ダウンロード", heading: "ダウンロード" },
		{ tab: "ストレージ", heading: "ストレージ" },
		{ tab: "メディア", heading: "メディアの拡張子" },
		{ tab: "ログ", heading: "ログ" },
	]) {
		await page
			.getByRole("tab", { name: new RegExp(`^${category.tab}(?: |$)`) })
			.click();
		await expect(
			page.getByRole("group", { name: category.heading, exact: true }),
		).toBeVisible();
	}

	await page.getByRole("tab", { name: /^ストレージ(?: |$)/ }).click();
	const thumbnailDirectory = page.getByLabel("サムネイル保存先", {
		exact: true,
	});
	await expect(thumbnailDirectory).toBeVisible();
	await expectNoHorizontalOverflow(page);

	if (mobileProjects.includes(testInfo.project.name)) {
		const fontSize = await thumbnailDirectory.evaluate((input) =>
			Number.parseFloat(getComputedStyle(input).fontSize),
		);
		expect(fontSize).toBeGreaterThanOrEqual(16);

		await page.getByRole("tab", { name: /^メディア(?: |$)/ }).click();
		await page.getByLabel("除外タグ", { exact: true }).scrollIntoViewIfNeeded();
		await expect(
			page.getByRole("button", { name: "変更を保存", exact: true }),
		).toBeInViewport();
	}
});
