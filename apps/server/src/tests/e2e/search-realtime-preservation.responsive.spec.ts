import { randomUUID } from "node:crypto";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SOURCE_NAME,
	getE2eMediaDir,
	getFixtureMediaPath,
	sourcePath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const sourceEventsEndpoint = /\/api\/rpc\/sources\/events(?:\?|$)/;

test("global search preserves the mobile filter dialog, input value, and focus after an SSE refresh", async ({
	context,
	page,
}, testInfo) => {
	test.skip(
		!["responsive-320", "responsive-375"].includes(testInfo.project.name),
		"The mobile filter dialog is only rendered below the md breakpoint.",
	);

	const sourceEventsConnected = page.waitForResponse(
		(response) =>
			sourceEventsEndpoint.test(new URL(response.url()).pathname) &&
			response.status() === 200,
	);
	await page.goto("/search");
	await expect(
		page.getByRole("heading", { name: "メディア検索", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	await sourceEventsConnected;

	await page.getByRole("button", { name: "Filter results" }).click();
	const filterDialog = page.getByRole("dialog");
	const fileNameInput = filterDialog.getByPlaceholder("ファイル名を入力...");
	await expect(filterDialog).toBeVisible();
	await fileNameInput.fill("e2e");
	await fileNameInput.focus();
	await expect(fileNameInput).toBeFocused();
	const resultCount = page.locator("p").filter({ hasText: /^\d+ 件の結果$/ });
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

	const syncPage = await context.newPage();
	await syncPage.setViewportSize({ width: 1440, height: 900 });
	await syncPage.goto("/sources");
	const sourceCard = syncPage
		.getByTestId("source-card")
		.filter({ hasText: E2E_SOURCE_NAME });
	await expect(sourceCard).toBeVisible();
	await waitForAppHydration(syncPage);
	const syncResponse = syncPage.waitForResponse((response) => {
		const url = new URL(response.url());
		return url.pathname === "/api/rpc/sources/sync" && response.ok();
	});
	await sourceCard.getByTestId("sync-source-btn").click();
	await syncResponse;

	await expect
		.poll(
			async () => Number.parseInt((await resultCount.textContent()) ?? "0", 10),
			{ timeout: 30_000 },
		)
		.toBeGreaterThan(initialResultCount);
	await expect(filterDialog).toBeVisible();
	await expect(fileNameInput).toHaveValue("e2e");
	await expect(fileNameInput).toBeFocused();
});

test("source media preserves the mobile filter draft and focus after an SSE refresh", async ({
	context,
	page,
}, testInfo) => {
	test.skip(
		!["responsive-320", "responsive-375"].includes(testInfo.project.name),
		"The mobile filter dialog is only rendered below the md breakpoint.",
	);

	const sourceEventsConnected = page.waitForResponse(
		(response) =>
			sourceEventsEndpoint.test(new URL(response.url()).pathname) &&
			response.status() === 200,
	);
	await page.goto(sourcePath());
	await expect(page.getByRole("button", { name: "Add media" })).toBeVisible();
	await waitForAppHydration(page);
	await sourceEventsConnected;

	await page.getByRole("button", { name: "Filter results" }).click();
	const filterDialog = page.getByRole("dialog");
	const fileNameInput = filterDialog.getByPlaceholder("ファイル名を入力...");
	await expect(filterDialog).toBeVisible();
	await fileNameInput.fill("e2e");
	await fileNameInput.focus();
	await expect(fileNameInput).toBeFocused();
	const resultCount = page.locator("p").filter({
		hasText: /^\d+ 件の結果$/,
	});
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

	const syncPage = await context.newPage();
	await syncPage.setViewportSize({ width: 1440, height: 900 });
	await syncPage.goto("/sources");
	const sourceCard = syncPage
		.getByTestId("source-card")
		.filter({ hasText: E2E_SOURCE_NAME });
	await expect(sourceCard).toBeVisible();
	await waitForAppHydration(syncPage);
	const syncResponse = syncPage.waitForResponse((response) => {
		const url = new URL(response.url());
		return url.pathname === "/api/rpc/sources/sync" && response.ok();
	});
	await sourceCard.getByTestId("sync-source-btn").click();
	await syncResponse;

	await expect
		.poll(
			async () => Number.parseInt((await resultCount.textContent()) ?? "0", 10),
			{ timeout: 30_000 },
		)
		.toBeGreaterThan(initialMediaCount);
	await expect(filterDialog).toBeVisible();
	await expect(fileNameInput).toHaveValue("e2e");
	await expect(fileNameInput).toBeFocused();
});
