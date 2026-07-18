import { randomUUID } from "node:crypto";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import type { Request } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SOURCE_NAME,
	getE2eMediaDir,
	getFixtureMediaPath,
	sourcePath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const sourceEventsEndpoint = /\/api\/rpc\/sources\/events(?:\?|$)/;

test("preserves an open dialog, input value, and focus after an SSE reconnect refreshes media", async ({
	context,
	page,
}) => {
	let streamAttempts = 0;
	let reconnectedRequest: Request | undefined;
	const reconnected = page.waitForResponse(
		(response) =>
			response.request() === reconnectedRequest && response.status() === 200,
	);
	await page.route(sourceEventsEndpoint, async (route) => {
		streamAttempts++;
		if (streamAttempts === 1) {
			// Close a valid SSE response immediately. This exercises the normal
			// completion path and retry backoff without creating a browser error.
			await route.fulfill({
				status: 200,
				contentType: "text/event-stream",
				body: "",
			});
			return;
		}
		if (streamAttempts === 2) {
			reconnectedRequest = route.request();
		}
		await route.continue();
	});

	await page.goto(sourcePath());
	await expect(page.getByRole("button", { name: "Add media" })).toBeVisible();
	await waitForAppHydration(page);
	await reconnected;
	expect(streamAttempts).toBeGreaterThanOrEqual(2);
	await page.unroute(sourceEventsEndpoint);

	const fileChooser = page.waitForEvent("filechooser");
	await page.getByRole("button", { name: "Add media" }).click();
	await (await fileChooser).setFiles(
		getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
	);

	const filenameInput = page.getByLabel("ファイル名", { exact: true });
	await expect(page.getByRole("dialog")).toBeVisible();
	await expect(filenameInput).toBeVisible();
	await filenameInput.fill("draft-name.png");
	await filenameInput.focus();
	await expect(filenameInput).toBeFocused();

	const syncedFileName = `realtime-sse-event-${randomUUID()}.png`;
	await copyFile(
		getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
		path.join(getE2eMediaDir(), syncedFileName),
	);

	const syncPage = await context.newPage();
	await syncPage.goto("/sources");
	const sourceCard = syncPage
		.getByTestId("source-card")
		.filter({ hasText: E2E_SOURCE_NAME });
	await expect(sourceCard).toBeVisible();
	await waitForAppHydration(syncPage);
	const addSourceButton = syncPage.getByRole("button", { name: "Add Source" });
	await addSourceButton.click();
	await expect(syncPage.getByRole("dialog")).toBeVisible();
	await syncPage.getByRole("button", { name: "Cancel" }).click();
	await expect(syncPage.getByRole("dialog")).toHaveCount(0);
	const syncResponse = syncPage.waitForResponse((response) => {
		const url = new URL(response.url());
		return url.pathname === "/api/rpc/sources/sync" && response.ok();
	});
	const syncButton = sourceCard.getByTestId("sync-source-btn");
	await syncButton.click();
	await syncResponse;

	await expect(
		page.locator("p").filter({ hasText: /^3 件の結果$/ }),
	).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole("dialog")).toBeVisible();
	await expect(filenameInput).toHaveValue("draft-name.png");
	await expect(filenameInput).toBeFocused();
});
