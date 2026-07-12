import { copyFile } from "node:fs/promises";
import path from "node:path";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SOURCE_NAME,
	getE2eMediaDir,
	getFixtureMediaPath,
	sourcePath,
} from "./support/fixture";
import { expect, test } from "./support/test";

const SYNCED_FILE_NAME = "realtime-sse-event.png";

test("preserves an open dialog, input value, and focus while a source sync SSE event refreshes media", async ({
	context,
	page,
}) => {
	const streamConnected = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === "/api/rpc/sources/events" &&
			response.status() === 200,
	);
	await page.goto(sourcePath());
	await expect(page.getByRole("button", { name: "Add media" })).toBeVisible();
	await streamConnected;

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

	await copyFile(
		getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
		path.join(getE2eMediaDir(), SYNCED_FILE_NAME),
	);

	const syncPage = await context.newPage();
	await syncPage.goto("/sources");
	const sourceCard = syncPage
		.getByTestId("source-card")
		.filter({ hasText: E2E_SOURCE_NAME });
	await expect(sourceCard).toBeVisible();
	await sourceCard.getByTestId("sync-source-btn").click();

	await expect(
		page.locator("p").filter({ hasText: /^3 件の結果$/ }),
	).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole("dialog")).toBeVisible();
	await expect(filenameInput).toHaveValue("draft-name.png");
	await expect(filenameInput).toBeFocused();
});
