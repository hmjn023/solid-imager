import { randomUUID } from "node:crypto";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import {
	E2E_PRIMARY_FILE_NAME,
	getE2eMediaDir,
	getFixtureMediaPath,
	sourcePath,
} from "./support/fixture";
import { syncFixtureSource } from "./support/source-sync";
import { expect, test, waitForAppHydration } from "./support/test";

const sourceEventsEndpoint = /\/api\/rpc\/sources\/events(?:\?|$)/;

test("global search preserves the mobile filter dialog, input value, and focus after an SSE refresh", {
	tag: "@mobile-only",
}, async ({ context, page }) => {
	const sourceEventsConnected = page.waitForResponse(
		(response) =>
			sourceEventsEndpoint.test(new URL(response.url()).pathname) &&
			response.status() === 200,
	);
	await page.goto("/search");
	await expect(
		page.getByRole("combobox", { name: "メディアを検索", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	await sourceEventsConnected;

	await page.getByRole("button", { name: /^検索フィルター、/ }).click();
	const filterDialog = page.getByRole("dialog");
	const fileNameInput = filterDialog.getByPlaceholder("ファイル名を入力...");
	await expect(filterDialog).toBeVisible();
	await fileNameInput.fill("e2e");
	await fileNameInput.focus();
	await expect(fileNameInput).toBeFocused();
	const resultCount = page.getByText(/^[\d,]+ items$/);
	await expect(resultCount).toBeVisible();
	const initialResultCount = Number.parseInt(
		(await resultCount.textContent()) ?? "0",
		10,
	);

	const syncedFileName = `e2e-global-sse-${randomUUID()}.png`;
	await copyFile(
		getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
		path.join(getE2eMediaDir(), syncedFileName),
	);

	await syncFixtureSource(context);

	await expect
		.poll(
			async () => Number.parseInt((await resultCount.textContent()) ?? "0", 10),
			{
				timeout: 30_000,
			},
		)
		.toBeGreaterThan(initialResultCount);
	await expect(filterDialog).toBeVisible();
	await expect(fileNameInput).toHaveValue("e2e");
	await expect(fileNameInput).toBeFocused();
});

test("source media preserves the mobile filter input and focus after an SSE refresh", {
	tag: "@mobile-only",
}, async ({ context, page }) => {
	const sourceEventsConnected = page.waitForResponse(
		(response) =>
			sourceEventsEndpoint.test(new URL(response.url()).pathname) &&
			response.status() === 200,
	);
	await page.goto(sourcePath());
	await expect(
		page.getByRole("button", { name: "追加", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	await sourceEventsConnected;

	await page.getByRole("button", { name: /^検索フィルター、/ }).click();
	const filterDialog = page.getByRole("dialog");
	const fileNameInput = filterDialog.getByPlaceholder("ファイル名を入力...");
	await expect(filterDialog).toBeVisible();
	await fileNameInput.fill("e2e");
	await fileNameInput.focus();
	await expect(fileNameInput).toBeFocused();
	const resultCount = page.getByText(/^[\d,]+ items$/);
	await expect(resultCount).toBeVisible();
	const initialMediaCount = Number.parseInt(
		(await resultCount.textContent()) ?? "0",
		10,
	);

	const syncedFileName = `e2e-source-filter-sse-${randomUUID()}.png`;
	await copyFile(
		getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
		path.join(getE2eMediaDir(), syncedFileName),
	);

	await syncFixtureSource(context);

	await expect
		.poll(
			async () => Number.parseInt((await resultCount.textContent()) ?? "0", 10),
			{
				timeout: 30_000,
			},
		)
		.toBeGreaterThan(initialMediaCount);
	await expect(filterDialog).toBeVisible();
	await expect(fileNameInput).toHaveValue("e2e");
	await expect(fileNameInput).toBeFocused();
});
