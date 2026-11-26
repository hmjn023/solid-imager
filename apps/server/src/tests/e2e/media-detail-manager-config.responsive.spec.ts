import { apiPathPattern, apiResponse, apiRequest } from "./support/api";
import type { Page } from "@playwright/test";
import {
	captureSearchSnapshotResponseSchema,
	defaultState,
} from "@solid-imager/core/search";
import { z } from "zod";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	mediaPath,
	sourcePath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";
import { selectManagerCategory } from "./support/manager-navigation";
import {
	selectSettingsCategory,
	settingsCategorySelect,
} from "./support/settings-navigation";

const mobileProjects = ["responsive-320", "responsive-390"];
const entityResponse = z.object({ id: z.uuid() });

test("edits linked IPs and characters without losing the selection across tabs", async ({
	browserHealth,
	page,
	request,
}, testInfo) => {
	// The RPC client may cancel the empty response body after reading the 200.
	browserHealth.allowRequestFailure(
		apiPathPattern("ips/addToMedia"),
		"net::ERR_ABORTED",
	);
	const ipName = `Relation fixture IP ${testInfo.project.name}`;
	const characterName = `Relation fixture character ${testInfo.project.name}`;
	const ipResponse = await apiRequest(request, "ips/create", { name: ipName });
	expect(ipResponse.ok()).toBe(true);
	const ipId = entityResponse.parse(await ipResponse.json()).id;
	let characterId: string | undefined;
	try {
		const characterResponse = await apiRequest(request, "characters/create", {
			name: characterName,
			ipIds: [ipId],
		});
		expect(characterResponse.ok()).toBe(true);
		characterId = entityResponse.parse(await characterResponse.json()).id;

		await page.goto(mediaPath());
		await waitForAppHydration(page);
		const relationHeader = page
			.getByRole("heading", { name: "関連付け", exact: true })
			.locator("..");
		const edit = relationHeader.getByRole("button", {
			name: "編集",
			exact: true,
		});
		await edit.click();
		const dialog = page.getByRole("dialog", { name: "関連付けを編集" });
		await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
		await expect(edit).toBeFocused();
		await edit.click();
		const ipTab = dialog.getByRole("tab", { name: /^IP/ });
		const characterTab = dialog.getByRole("tab", { name: /^キャラクター/ });
		await expect(ipTab).toHaveAttribute("aria-selected", "true");
		const ipSearch = dialog.getByRole("searchbox", { name: "IPを検索" });
		if (await page.evaluate(() => matchMedia("(pointer: coarse)").matches)) {
			await expect(ipSearch).not.toBeFocused();
		} else {
			await expect(ipSearch).toBeFocused();
		}
		const draftName = "New relation draft";
		await ipSearch.fill(draftName);
		await dialog
			.getByRole("button", { name: `「${draftName}」を新規項目として選択` })
			.click();
		await expect(
			dialog.getByText(`${draftName}（新規）`, { exact: true }),
		).toBeVisible();
		await dialog
			.getByRole("button", { name: `「${draftName}」を選択から外す` })
			.click();
		await characterTab.click();
		const search = dialog.getByRole("searchbox", {
			name: "キャラクターを検索",
		});
		await search.fill(ipName);
		const character = dialog.getByRole("checkbox", {
			name: new RegExp(characterName),
		});
		await expect(character).toBeVisible();
		await dialog.getByText(characterName, { exact: true }).click();
		await expect(character).toBeChecked();
		await search.fill("no matching relation");
		await expect(
			dialog.getByRole("button", {
				name: `「${characterName}」を選択から外す`,
			}),
		).toBeVisible();
		await ipTab.click();
		await expect(
			dialog.getByRole("checkbox", { name: ipName, exact: true }),
		).toBeChecked();
		await characterTab.click();
		await expect(search).toHaveValue("no matching relation");

		await page.keyboard.press("Escape");
		const discard = page.getByRole("alertdialog", {
			name: "変更を破棄しますか？",
		});
		await expect(discard).toBeVisible();
		await discard.getByRole("button", { name: "編集を続ける" }).click();
		await expect(discard).toBeHidden();
		await expect(search).toHaveValue("no matching relation");
		const save = dialog.getByRole("button", { name: "変更を保存" });
		const saveButton = await save.boundingBox();
		expect(saveButton?.y).toBeGreaterThanOrEqual(0);
		expect(
			(saveButton?.y ?? 0) + (saveButton?.height ?? 0),
		).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
		await expectNoHorizontalOverflow(page);
		const saved = Promise.all(
			["ips", "characters"].map((group) =>
				page.waitForResponse(
					(response) =>
						apiResponse(`${group}/addToMedia`)(response) && response.ok(),
				),
			),
		);
		await save.click();
		await saved;
		await expect(dialog).toBeHidden();

		const relations = relationHeader.locator("..");
		await expect(
			relations.getByText(characterName, { exact: true }),
		).toBeVisible();
		await expect(relations.getByText(ipName, { exact: true })).toBeVisible();
		await page.reload();
		await waitForAppHydration(page);
		await edit.click();
		await expect(
			dialog.getByRole("button", { name: `「${ipName}」を選択から外す` }),
		).toBeVisible();
		await dialog
			.getByRole("button", { name: `「${ipName}」を選択から外す` })
			.click();
		await expect(dialog.getByRole("heading", { name: "選択中" })).toBeFocused();
		await page.keyboard.press("Escape");
		await discard.getByRole("button", { name: "破棄", exact: true }).click();
		await expect(dialog).toBeHidden();
		await expect(edit).toBeFocused();
		await expect(relations.getByText(ipName, { exact: true })).toBeVisible();
	} finally {
		if (characterId) {
			const response = await apiRequest(request, "characters/delete", {
				id: characterId,
			});
			expect(response.ok()).toBe(true);
		}
		const response = await apiRequest(request, "ips/delete", { id: ipId });
		expect(response.ok()).toBe(true);
	}
});

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
	async ({ page, request }) => {
		const captured = await apiRequest(request, "searchSnapshots/capture", {
			state: { ...defaultState, searchQuery: E2E_PRIMARY_FILE_NAME },
		});
		await expect(captured).toBeOK();
		const { id } = captureSearchSnapshotResponseSchema.parse(
			await captured.json(),
		);
		await page.goto(mediaPath(E2E_PRIMARY_MEDIA_ID));
		await waitForAppHydration(page);
		const savedReturnPath = `/search?search=${id}#results`;
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
		await expect(
			page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`),
		).toBeVisible();
		await expect(
			page.locator(`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`),
		).toHaveCount(0);
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

	await selectManagerCategory(page, "一括タグ付け");
	if (testInfo.project.name !== "responsive-desktop") {
		const currentCategory = page.getByRole("combobox", {
			name: /^管理カテゴリ/,
		});
		await expect(currentCategory).toHaveText("一括タグ付け");
		await expect(currentCategory).toBeInViewport();
	}
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

	const compactCategory = settingsCategorySelect(page);
	if (await compactCategory.isVisible()) {
		await expect(compactCategory).toHaveText("ジョブ");
		await compactCategory.press("ArrowDown");
		await expect(
			page.getByRole("option", { name: "ログ", exact: true }),
		).toBeVisible();
		await page.keyboard.press("End");
		await page.keyboard.press("Enter");
		await expect(compactCategory).toHaveText("ログ");
		await expect(compactCategory).toBeFocused();
		await expect(
			page.getByRole("group", { name: "ログ", exact: true }),
		).toBeVisible();
	}

	for (const category of [
		{ tab: "ジョブ", heading: "ジョブ処理" },
		{ tab: "AI", heading: "AIサービス" },
		{ tab: "ダウンロード", heading: "ダウンロード" },
		{ tab: "ストレージ", heading: "ストレージ" },
		{ tab: "メディア", heading: "メディアの拡張子" },
		{ tab: "ログ", heading: "ログ" },
	]) {
		await selectSettingsCategory(page, category.tab);
		await expect(
			page.getByRole("group", { name: category.heading, exact: true }),
		).toBeVisible();
	}

	await selectSettingsCategory(page, "ジョブ");
	await expect(concurrencyInput).toHaveValue("3");
	await expect(saveButton).toBeEnabled();

	await selectSettingsCategory(page, "AI");
	const aiUrl = page.getByLabel("リモートAIサーバーURL（oRPC）", {
		exact: true,
	});
	await expect(aiUrl).toHaveValue("");
	await expect(aiUrl).toHaveAccessibleDescription(/空欄の場合はローカルで処理/);
	await expect(
		page.getByText("入力例：http://power-machine:3000"),
	).toBeVisible();

	await selectSettingsCategory(page, "ストレージ");
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

		await selectSettingsCategory(page, "メディア");
		await page.getByLabel("除外タグ", { exact: true }).scrollIntoViewIfNeeded();
		await expect(
			page.getByRole("button", { name: "変更を保存", exact: true }),
		).toBeInViewport();
	}
});

test("keeps the mobile settings category selector reachable after scrolling", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 500 });
	await page.goto("/config");
	await waitForAppHydration(page);
	await selectSettingsCategory(page, "AI");
	const selector = page.getByRole("tablist", { name: "設定カテゴリ" });
	const scrollArea = page.locator("[data-management-scroll]");
	await expect(selector).toBeInViewport();
	await scrollArea.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
	});
	expect(
		await scrollArea.evaluate((element) => element.scrollTop),
	).toBeGreaterThan(100);
	await expect(selector).toBeInViewport();
	await selectSettingsCategory(page, "ストレージ");
	await expect(
		page.getByRole("group", { name: "ストレージ", exact: true }),
	).toBeVisible();
});
