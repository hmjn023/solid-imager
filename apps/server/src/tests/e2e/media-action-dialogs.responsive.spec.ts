import { apiPathPattern, apiRequest } from "./support/api";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	getE2eRuntimeDir,
	sourcePath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

async function delayMutationFailure(page: Page, action: "copy" | "delete") {
	const gate = Promise.withResolvers<void>();
	await page.route(
		apiPathPattern(`media/${action}`),
		async (route) => {
			await gate.promise;
			await route.fulfill({
				status: 503,
				json: { code: "SERVICE_UNAVAILABLE", message: "Fixture unavailable" },
			});
		},
		{ times: 1 },
	);
	return gate.resolve;
}

for (const collection of [
	{ name: "Library", route: "/search" },
	{ name: "Source", route: sourcePath() },
]) {
	test(`${collection.name} preserves the media action and target on delayed failure`, async ({
		page,
		browserHealth,
	}) => {
		for (const action of ["copy", "delete"])
			browserHealth.allowResponseFailure(apiPathPattern(`media/${action}`));
		browserHealth.allowConsole(/Failed to load resource:.*503/);
		browserHealth.allowRequestFailure(
			apiPathPattern("sources/list"),
			"net::ERR_ABORTED",
		);
		const id = randomUUID();
		const directory = path.join(getE2eRuntimeDir(), id);
		const destination = `Transfer destination ${id}`;
		await mkdir(directory);
		const created = await apiRequest(page.request, "sources/create", {
			id,
			name: destination,
			description: null,
			type: "local",
			connectionInfo: { path: directory },
		});
		expect(created.ok()).toBe(true);
		try {
			await page.goto(collection.route);
			await waitForAppHydration(page);
			const item = page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`);
			await item.click({ button: "right" });
			await page
				.getByRole("menuitem", { name: "他のソースへコピー", exact: true })
				.click();
			const transfer = page.getByRole("dialog", {
				name: "メディアをコピー",
				exact: true,
			});
			const copy = transfer.getByRole("button", {
				name: "コピー",
				exact: true,
			});
			expect(await transfer.textContent()).not.toContain("false");
			await expect(copy).toBeDisabled();
			const destinationField = transfer.getByRole("button", {
				name: /^保存先ソース/,
			});
			await destinationField.click();
			await transfer
				.getByRole("option", { name: destination, exact: true })
				.click();
			const releaseCopy = await delayMutationFailure(page, "copy");
			try {
				await copy.click();
				await expect(
					transfer.getByRole("button", { name: "処理中...", exact: true }),
				).toBeDisabled();
				await expect(destinationField).toBeDisabled();
				await expect(
					transfer.getByRole("button", { name: "閉じる", exact: true }),
				).toBeDisabled();
				await page.keyboard.press("Escape");
				await expect(transfer).toBeVisible();
			} finally {
				releaseCopy();
			}
			const copyWarning =
				"コピーの結果を確認できませんでした。コピー先を確認してください。";
			const copyAlert = transfer.getByRole("alert");
			await expect(copyAlert).toHaveText(copyWarning);
			await expect(destinationField).toContainText(destination);
			const retryCheckpoint = browserHealth.requestCheckpoint();
			// Hold any unexpected retry so it cannot complete before the assertions.
			const releaseRetry = await delayMutationFailure(page, "copy");
			try {
				await copy.click();
				await expect(copy).toBeEnabled();
				await expect(copyAlert).toHaveText(copyWarning);
				expect(
					browserHealth
						.apiRequests()
						.slice(retryCheckpoint)
						.filter((url) => apiPathPattern("media/copy").test(url)).length,
				).toBe(0);
			} finally {
				releaseRetry();
			}
			await transfer
				.getByRole("button", { name: "キャンセル", exact: true })
				.click();
			await expect(transfer).toBeHidden();

			await item.click({ button: "right" });
			await page.getByRole("menuitem", { name: /^削除(?: Delete)?$/ }).click();
			const confirmDelete = page.getByRole("alertdialog", {
				name: "メディアを削除",
				exact: true,
			});
			await expect(confirmDelete).toContainText(E2E_PRIMARY_FILE_NAME);
			const releaseDelete = await delayMutationFailure(page, "delete");
			try {
				await confirmDelete
					.getByRole("button", { name: "削除", exact: true })
					.click();
				await expect(
					confirmDelete.getByRole("button", { name: "削除中...", exact: true }),
				).toBeDisabled();
				await expect(
					confirmDelete.getByRole("button", {
						name: "キャンセル",
						exact: true,
					}),
				).toBeDisabled();
			} finally {
				releaseDelete();
			}
			await expect(confirmDelete.getByRole("alert")).toContainText(
				"メディアの削除に失敗しました",
			);
			await expect(confirmDelete).toContainText(E2E_PRIMARY_FILE_NAME);
			await confirmDelete
				.getByRole("button", { name: "キャンセル", exact: true })
				.click();
			await expect(item).toBeVisible();
		} finally {
			await apiRequest(page.request, "sources/delete", { id });
			await rm(directory, { recursive: true, force: true });
		}
	});
}
