import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mediaThumbnailPath } from "@solid-imager/core/http";
import {
	apiPathPattern,
	apiRequest,
	apiRequestInput,
	routeApi,
} from "./support/api";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SIMILAR_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SOURCE_ID,
	getFixtureMediaPath,
	sourcePath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

function gate() {
	let release: () => void = () => {};
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release };
}
async function openFromFile(page: Page) {
	const chooser = page.waitForEvent("filechooser");
	await page.getByRole("button", { name: "追加", exact: true }).click();
	await (await chooser).setFiles(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
	await expect(
		page.getByRole("dialog", { name: "メディアをアップロード" }),
	).toBeVisible();
}
async function pasteUrl(page: Page) {
	const url = new URL(
		mediaThumbnailPath(E2E_SOURCE_ID, E2E_PRIMARY_MEDIA_ID, { size: 256 }),
		page.url(),
	).href;
	await page.evaluate((value) => {
		const clipboardData = new DataTransfer();
		clipboardData.setData("text/plain", value);
		document.dispatchEvent(
			new ClipboardEvent("paste", {
				clipboardData,
				bubbles: true,
				cancelable: true,
			}),
		);
	}, url);
}

test("source file intake routes picked manifests and dropped files separately", async ({
	page,
}) => {
	const item = { targetUrl: "https://example.com/fixture.png" };
	const manifest = JSON.stringify([item]);
	const requests: unknown[] = [];
	await routeApi(page, "downloads/start", async (route) => {
		requests.push(apiRequestInput(route.request(), "downloads/start"));
		await route.fulfill({
			json: { success: true, jobCount: 1, message: "Queued" },
		});
	});
	await page.goto(sourcePath());
	await waitForAppHydration(page);
	const uploadArea = page.getByRole("region", {
		name: "メディアのアップロード領域",
	});
	const addMedia = uploadArea.getByRole("button", {
		name: "追加",
		exact: true,
	});
	const chosen = page.waitForEvent("filechooser");
	await addMedia.click();
	const picker = await chosen;
	expect(await picker.element().getAttribute("accept")).toBe(
		"image/*,video/*,audio/*,.json",
	);
	await picker.setFiles({
		name: "download.manifest",
		mimeType: "application/json",
		buffer: Buffer.from(manifest),
	});
	await expect
		.poll(() => requests)
		.toEqual([{ items: [item], mediaSourceId: E2E_SOURCE_ID }]);
	const dialog = page.getByRole("dialog", { name: "メディアをアップロード" });
	await expect(dialog).toBeHidden();
	const dragHandledOutside = await page.evaluate((json) => {
		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(new File([json], "download.json"));
		const drag = new DragEvent("dragover", {
			bubbles: true,
			cancelable: true,
			dataTransfer,
		});
		document.body.dispatchEvent(drag);
		return drag.defaultPrevented;
	}, manifest);
	expect(dragHandledOutside).toBe(false);

	await uploadArea.evaluate((area, json) => {
		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(
			new File([json], "download.json", { type: "application/json" }),
		);
		area.dispatchEvent(
			new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }),
		);
	}, manifest);
	await expect(dialog.getByLabel("ファイル名", { exact: true })).toHaveValue(
		"download.json",
	);
	await expect(dialog.getByRole("listitem")).toHaveCount(1);
	expect(requests).toHaveLength(1);
});

test("adds, replaces and drops dialog files before upload submission", async ({
	page,
	browserHealth,
}) => {
	// Each successful upload refreshes the same query and cancels its superseded read.
	browserHealth.allowRequestFailure(apiPathPattern("media/search"));
	const submissions: string[] = [];
	await routeApi(page, "media/upload", async (route) => {
		submissions.push(route.request().postDataBuffer()?.toString() ?? "");
		await route.fulfill({
			json: { success: true, filePath: "uploaded" },
		});
	});
	await page.goto(sourcePath());
	await waitForAppHydration(page);
	await openFromFile(page);
	const dialog = page.getByRole("dialog", { name: "メディアをアップロード" });
	const pickFiles = async (triggerName: string, ...names: string[]) => {
		const chooser = page.waitForEvent("filechooser");
		await dialog
			.getByRole("button", { name: triggerName, exact: true })
			.click();
		const fileChooser = await chooser;
		await fileChooser.setFiles(names.map((name) => getFixtureMediaPath(name)));
	};
	const files = dialog.getByRole("list").getByRole("listitem");
	const filename = dialog.getByLabel("ファイル名", { exact: true });

	await pickFiles(
		"ファイルを追加",
		E2E_PRIMARY_FILE_NAME,
		E2E_SIMILAR_FILE_NAME,
	);
	await expect(files).toHaveCount(2);
	await expect(filename).toHaveValue(E2E_PRIMARY_FILE_NAME);
	await pickFiles("ファイルを入れ替え", E2E_SIMILAR_FILE_NAME);
	await expect(files).toHaveCount(1);
	await expect(filename).toHaveValue(E2E_SIMILAR_FILE_NAME);
	const primaryImage = await readFile(
		getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
	);
	await files.first().evaluate(
		(item, { name, base64 }) => {
			const bytes = Uint8Array.from(atob(base64), (byte) => byte.charCodeAt(0));
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(new File([bytes], name, { type: "image/png" }));
			item.dispatchEvent(
				new DragEvent("drop", {
					bubbles: true,
					cancelable: true,
					dataTransfer,
				}),
			);
		},
		{ name: E2E_PRIMARY_FILE_NAME, base64: primaryImage.toString("base64") },
	);
	await expect(files).toHaveCount(2);
	await expect(filename).toHaveValue(E2E_SIMILAR_FILE_NAME);
	await expect(
		dialog.getByText(E2E_PRIMARY_FILE_NAME, { exact: true }),
	).toBeVisible();
	await expect(
		dialog.getByText(E2E_SIMILAR_FILE_NAME, { exact: true }),
	).toBeVisible();
	const preview = dialog.getByRole("img", { name: "取得したプレビュー" });
	await expect(preview).toBeVisible();
	await dialog
		.getByRole("button", { name: "アップロード", exact: true })
		.click();
	await expect.poll(() => submissions.length).toBe(2);
	expect(submissions.some((body) => body.includes(E2E_PRIMARY_FILE_NAME))).toBe(
		true,
	);
	expect(submissions.some((body) => body.includes(E2E_SIMILAR_FILE_NAME))).toBe(
		true,
	);
	await expect(dialog).toBeHidden();
});

test("stops sending remaining files when another client cancels the upload batch", async ({
	page,
	request,
	browserHealth,
}) => {
	const upload = apiPathPattern("media/upload");
	browserHealth.allowResponseFailure(upload);
	browserHealth.allowConsole(/410 \(Gone\)/);
	await routeApi(page, "media/reserveUploads", async (route) => {
		const response = await route.fetch();
		const { jobId } = await response.json();
		const cancelled = await apiRequest(request, "jobs/cancel", { id: jobId });
		expect(cancelled.ok()).toBe(true);
		await route.fulfill({ response });
	});
	await page.goto(sourcePath());
	await waitForAppHydration(page);
	await openFromFile(page);
	const dialog = page.getByRole("dialog", { name: "メディアをアップロード" });
	const buffer = await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
	await dialog.locator('input[type="file"]').setInputFiles(
		Array.from({ length: 8 }, (_, i) => ({
			name: `cancel-${i}.png`,
			mimeType: "image/png",
			buffer,
		})),
	);
	const rejected = page.waitForResponse(upload);
	await dialog
		.getByRole("button", { name: "アップロード", exact: true })
		.click();
	const rejection = await rejected;
	expect(rejection.status()).toBe(410);
	expect(await rejection.json()).toMatchObject({
		defined: true,
		code: "BATCH_CANCELLED",
	});
	await expect(
		dialog.getByText("一括操作をキャンセルしました。"),
	).toBeVisible();
	expect(browserHealth.apiRequestCount(upload)).toBe(3);
});

for (const discard of [false, true]) {
	test(`ignores an old URL response after ${discard ? "discard and reopen" : "choosing files"}`, async ({
		page,
	}) => {
		const requested = gate();
		const delayed = gate();
		await routeApi(page, "utils/fetchUrl", async (route) => {
			requested.release();
			await delayed.promise;
			await route.continue();
		});
		await page.goto(sourcePath());
		await waitForAppHydration(page);
		await expect(
			page.getByRole("button", { name: "追加", exact: true }),
		).toBeVisible();
		await pasteUrl(page);
		const dialog = page.getByRole("dialog", { name: "メディアをアップロード" });
		await expect(dialog).toBeVisible();
		await expect(
			dialog.getByText("読み込み中...", { exact: true }),
		).toBeVisible();
		await requested.promise;
		if (discard) {
			await dialog
				.getByRole("button", { name: "キャンセル", exact: true })
				.click();
			await page
				.getByRole("alertdialog")
				.getByRole("button")
				.filter({ hasText: "破棄して閉じる" })
				.click();
			await expect(dialog).toBeHidden();
			await openFromFile(page);
		} else {
			await dialog
				.locator('input[type="file"]')
				.setInputFiles(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
		}
		await expect(dialog.getByLabel("ファイル名", { exact: true })).toHaveValue(
			E2E_PRIMARY_FILE_NAME,
		);
		const preview = dialog.getByRole("img", { name: "取得したプレビュー" });
		await expect(preview).toBeVisible();
		const originalPreview = await preview.getAttribute("src");
		const finished = page.waitForResponse(apiPathPattern("utils/fetchUrl"));
		delayed.release();
		await (await finished).finished();
		await expect(dialog.getByLabel("ファイル名", { exact: true })).toHaveValue(
			E2E_PRIMARY_FILE_NAME,
		);
		await expect(preview).toHaveAttribute("src", originalPreview ?? "");
		await expect(dialog.getByRole("list").getByRole("listitem")).toHaveCount(1);
		await expect(
			dialog.getByText("読み込み中...", { exact: true }),
		).toHaveCount(0);
	});
}
