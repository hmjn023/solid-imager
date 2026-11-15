import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
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
		`/api/sources/${E2E_SOURCE_ID}/thumbnail/${E2E_PRIMARY_MEDIA_ID}?size=256`,
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

test("keeps both dialog-selected files through actual upload submission", async ({
	page,
	browserHealth,
}) => {
	// Each successful upload refreshes the same query and cancels its superseded read.
	browserHealth.allowRequestFailure(/\/api\/rpc\/media\/search(?:\?|$)/);
	const submissions: string[] = [];
	await page.route(/\/api\/rpc\/media\/upload(?:\?|$)/, async (route) => {
		submissions.push(route.request().postDataBuffer()?.toString() ?? "");
		await route.fulfill({
			json: { json: { success: true, filePath: "uploaded" } },
		});
	});
	await page.goto(sourcePath());
	await waitForAppHydration(page);
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
	await openFromFile(page);
	const dialog = page.getByRole("dialog", { name: "メディアをアップロード" });
	await dialog
		.locator('input[type="file"]')
		.setInputFiles([
			getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
			getFixtureMediaPath(E2E_SIMILAR_FILE_NAME),
		]);
	await expect(dialog.getByRole("list").getByRole("listitem")).toHaveCount(2);
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
	const upload = /\/api\/rpc\/media\/upload(?:\?|$)/;
	browserHealth.allowResponseFailure(upload);
	// The RPC transport returns HTTP 400 for a declared application error.
	browserHealth.allowConsole(/400 \(Bad Request\)/);
	await page.route("**/api/rpc/media/reserveUploads", async (route) => {
		const response = await route.fetch();
		const {
			json: { jobId },
		} = await response.json();
		const cancelled = await request.post("/api/rest/jobs/cancel", {
			data: { id: jobId },
		});
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
	expect(await (await rejected).json()).toMatchObject({
		json: { defined: true, code: "BATCH_CANCELLED" },
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
		await page.route(/\/api\/rpc\/utils\/fetchUrl(?:\?|$)/, async (route) => {
			requested.release();
			await delayed.promise;
			await route.continue();
		});
		await page.goto(sourcePath());
		await waitForAppHydration(page);
		await expect(
			page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
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
		const finished = page.waitForResponse(
			/\/api\/rpc\/utils\/fetchUrl(?:\?|$)/,
		);
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
