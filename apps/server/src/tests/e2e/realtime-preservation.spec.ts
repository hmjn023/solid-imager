import { randomUUID } from "node:crypto";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import type { Page, Request } from "@playwright/test";
import { apiPathPattern, apiRequest } from "./support/api";
import { expectDomPreserved } from "./support/dom";
import {
	E2E_PRIMARY_FILE_NAME,
	getE2eMediaDir,
	getE2eRuntimeDir,
	getFixtureMediaPath,
	sourcePath,
} from "./support/fixture";
import { syncFixtureSource } from "./support/source-sync";
import { expect, test, waitForAppHydration } from "./support/test";

const sourceEventsEndpoint = apiPathPattern("sources/events");

async function openWithSourceEventsReconnect(page: Page, destination: string) {
	let streamAttempts = 0;
	const reconnect = Promise.withResolvers<Request>();
	await page.route(sourceEventsEndpoint, async (route) => {
		streamAttempts++;
		if (streamAttempts === 1) {
			// Close a valid SSE response immediately to exercise normal reconnect.
			await route.fulfill({
				status: 200,
				contentType: "text/event-stream",
				body: "event: close\n\n",
			});
			return;
		}
		if (streamAttempts === 2) {
			reconnect.resolve(route.request());
		}
		await route.continue();
	});
	await page.goto(destination, { waitUntil: "domcontentloaded" });
	await waitForAppHydration(page);
	const request = await reconnect.promise;
	const response = await request.response();
	expect(response?.status()).toBe(200);
	await page.unroute(sourceEventsEndpoint);
}

test(
	"preserves an open dialog, input value, and focus after an SSE reconnect refreshes media",
	{ tag: "@dev-smoke" },
	async ({ browser, page }) => {
		await openWithSourceEventsReconnect(page, sourcePath());
		await expect(
			page.getByRole("button", { name: "追加", exact: true }),
		).toBeVisible();

		const fileChooser = page.waitForEvent("filechooser");
		await page.getByRole("button", { name: "追加", exact: true }).click();
		await (
			await fileChooser
		).setFiles(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));

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

		await syncFixtureSource(browser, page.url());

		const resultCount = page.getByText(/^[\d,]+件$/);
		await expect(resultCount).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText(syncedFileName, { exact: true })).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(filenameInput).toHaveValue("draft-name.png");
		await expect(filenameInput).toBeFocused();
	},
);

test(
	"preserves the source row and action menu focus when a sync refreshes the list after SSE reconnect",
	{ tag: "@dev-smoke" },
	async ({ browserHealth, page, request }) => {
		// Successive sync events can supersede an in-flight list refresh.
		browserHealth.allowRequestFailure(
			apiPathPattern("sources/list"),
			"net::ERR_ABORTED",
		);
		const directory = await mkdtemp(
			path.join(getE2eRuntimeDir(), "source-focus-"),
		);
		const sourceId = randomUUID();
		const name = `Focus library ${sourceId}`;
		let sourceCreated = false;
		try {
			const created = await apiRequest(request, "sources/create", {
				id: sourceId,
				name,
				description: null,
				type: "local",
				connectionInfo: { path: directory },
			});
			await expect(created).toBeOK();
			sourceCreated = true;
			await openWithSourceEventsReconnect(page, "/search");

			const sourceLink = page.getByRole("link", {
				name: new RegExp(`^${name} `),
				includeHidden: true,
			});
			const mediaCount = sourceLink.getByText(/\d+件$/);
			await expect(mediaCount).toHaveText(/\b0件$/);
			await expect(sourceLink.getByText(/^最終同期 /)).toBeVisible();
			const actions = page.getByRole("button", {
				name: `${name}の操作`,
				exact: true,
				includeHidden: true,
			});
			await actions.press("ArrowDown");
			const edit = page.getByRole("menuitem", { name: "編集", exact: true });
			await edit.focus();
			await expect(edit).toBeFocused();

			await expectDomPreserved({ sourceLink, actions, edit }, async () => {
				await copyFile(
					getFixtureMediaPath(E2E_PRIMARY_FILE_NAME),
					path.join(directory, "source-focus.png"),
				);
				const sync = await apiRequest(request, "sources/sync", {
					ids: [sourceId],
				});
				await expect(sync).toBeOK();
				await expect(mediaCount).toHaveText(/\b1件$/, { timeout: 30_000 });
			});
			await expect(edit).toBeFocused();
		} finally {
			try {
				if (sourceCreated) {
					const removed = await apiRequest(request, "sources/delete", {
						id: sourceId,
					});
					await expect(removed).toBeOK();
				}
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		}
	},
);
