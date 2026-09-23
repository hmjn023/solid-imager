import { randomUUID } from "node:crypto";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import type { Request } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	getE2eMediaDir,
	getFixtureMediaPath,
	sourcePath,
} from "./support/fixture";
import { syncFixtureSource } from "./support/source-sync";
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
	await expect(
		page.getByRole("button", { name: "追加", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);
	await reconnected;
	expect(streamAttempts).toBeGreaterThanOrEqual(2);
	await page.unroute(sourceEventsEndpoint);

	const fileChooser = page.waitForEvent("filechooser");
	await page.getByRole("button", { name: "追加", exact: true }).click();
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

	await syncFixtureSource(context);

	const resultCount = page.getByText(/^[\d,]+ items$/);
	await expect(resultCount).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText(syncedFileName, { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.getByRole("dialog")).toBeVisible();
	await expect(filenameInput).toHaveValue("draft-name.png");
	await expect(filenameInput).toBeFocused();
});
