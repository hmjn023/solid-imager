import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { appContract } from "@solid-imager/core/domain/contract";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SOURCE_ID,
	getFixtureMediaPath,
	sourcePath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("restores a fixed thumbnail batch after SSE reconnect while preserving the upload draft", async ({
	page,
	baseURL,
}) => {
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: baseURL + "/api/rpc" }),
	);
	const stream = /\/api\/rpc\/sources\/events(?:\?|$)/;
	let attempts = 0;
	await page.route(stream, async (route) => {
		attempts++;
		if (attempts === 1)
			await route.fulfill({
				status: 200,
				contentType: "text/event-stream",
				body: "",
			});
		else await route.continue();
	});
	const connected = page.waitForResponse(
		(response) =>
			stream.test(response.url()) && attempts >= 2 && response.status() === 200,
		{ timeout: 30_000 },
	);
	await page.goto(sourcePath());
	await waitForAppHydration(page);
	await connected;
	await page.unroute(stream);
	const fileChooser = page.waitForEvent("filechooser");
	await page.getByRole("button", { name: "追加", exact: true }).click();
	await (
		await fileChooser
	).setFiles(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
	const filename = page.getByLabel("ファイル名", { exact: true });
	await filename.fill("batch-draft.png");
	await filename.focus();
	const batch = await client.batches.start({
		kind: "thumbnail",
		mediaSourceId: E2E_SOURCE_ID,
		mediaIds: [E2E_SIMILAR_MEDIA_ID],
		force: true,
		missingOnly: false,
		thumbnailSize: 512,
	});
	expect(batch.progress.total).toBe(1);
	await expect
		.poll(async () => (await client.batches.get({ id: batch.id })).status, {
			timeout: 30000,
		})
		.toBe("completed");
	await expect(page.getByRole("dialog")).toBeVisible();
	await expect(filename).toHaveValue("batch-draft.png");
	await expect(filename).toBeFocused();
	await page.keyboard.press("Escape");
	await page
		.getByRole("alertdialog")
		.getByRole("button")
		.filter({ hasText: "破棄して閉じる" })
		.click();
	await page.getByRole("link", { name: /^Jobs/ }).click();
	const select = () =>
		page
			.getByRole("button", {
				name: new RegExp("job " + batch.id.slice(0, 8) + "$"),
			})
			.click();
	await select();
	await expect(
		page
			.getByRole("region", { name: "Current media processing" })
			.filter({ visible: true }),
	).toContainText("ThumbnailsCompleted");
	await page.reload();
	await waitForAppHydration(page);
	await select();
	expect(await client.jobs.get({ id: batch.id })).toMatchObject({
		status: "completed",
		progress: { total: 1, processed: 1, failed: 0 },
	});
	const targets = await client.batches.items({
		id: batch.id,
		limit: 25,
		offset: 0,
	});
	expect(targets.items).toEqual([
		expect.objectContaining({
			mediaId: E2E_SIMILAR_MEDIA_ID,
			status: "completed",
		}),
	]);
	expect(targets.items[0]).not.toHaveProperty("input");
});
