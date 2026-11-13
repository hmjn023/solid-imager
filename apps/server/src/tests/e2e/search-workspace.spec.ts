import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { mediaSearchResponseSchema } from "@solid-imager/core/media";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_MEDIA_ID,
	getE2eRuntimeDir,
} from "./support/fixture";
import { expect, test } from "./support/test";

// Both projects execute this same scenario through their own route and API adapters.
test("shared search selection, bulk dialog, copy, move and delete workflows", async ({
	page,
	browserHealth,
}, testInfo) => {
	// Copy/move/delete and fixture cleanup invalidate the source list while a
	// previous refresh can still be pending. Only its deliberate abort is allowed.
	browserHealth.allowRequestFailure(
		/\/api\/rpc\/sources\/list(?:\?|$)/,
		"net::ERR_ABORTED",
	);
	const sources = ["Copy destination", "Move destination"].map((name) => {
		const id = randomUUID();
		return {
			id,
			name: `${name} ${id}`,
			directory: path.join(getE2eRuntimeDir(), id),
		};
	});
	const [copyDestination, moveDestination] = sources;
	const mediaItem = (id: string) => page.locator(`[data-media-id="${id}"]`);
	const searchSource = async (sourceId: string) => {
		const response = await page.request.post("/api/rpc/media/search", {
			data: { json: { sourceId, params: { limit: 20, offset: 0 } } },
		});
		expect(response.ok()).toBe(true);
		return mediaSearchResponseSchema.parse((await response.json()).json);
	};
	const transfer = async (
		mediaId: string,
		mode: "copy" | "move",
		destination: typeof copyDestination,
	) => {
		await mediaItem(mediaId).click({ button: "right" });
		await page
			.getByRole("menuitem", {
				name: mode === "copy" ? "他のソースへコピー" : "他のソースへ移動",
				exact: true,
			})
			.click();
		const dialog = page.getByRole("dialog").filter({
			has: page.getByRole("heading", {
				name: mode === "copy" ? "メディアをコピー" : "メディアを移動",
				exact: true,
			}),
		});
		await dialog.getByRole("button", { name: /^保存先ソース/ }).click();
		await page
			.locator('[role="listbox"]')
			.getByText(destination.name, { exact: true })
			.click();
		const completed = page.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === `/api/rpc/media/${mode}` &&
				response.ok(),
		);
		await dialog
			.getByRole("button", {
				name: mode === "copy" ? "コピー" : "移動",
				exact: true,
			})
			.click();
		await completed;
		await expect(dialog).toHaveCount(0);
		await expect
			.poll(async () => (await searchSource(destination.id)).total)
			.toBe(1);
		const result = await searchSource(destination.id);
		const transferred = result.media[0];
		await expect(mediaItem(transferred.id)).toBeVisible();
		return transferred;
	};
	try {
		for (const source of sources) {
			await mkdir(source.directory);
			const response = await page.request.post("/api/rpc/sources/create", {
				data: {
					json: {
						id: source.id,
						name: source.name,
						description: null,
						type: "local",
						connectionInfo: { path: source.directory },
					},
				},
			});
			expect(response.ok()).toBe(true);
		}
		await page.goto(
			testInfo.project.name === "tauri" ? "/#/search" : "/search",
		);
		await expect(mediaItem(E2E_PRIMARY_MEDIA_ID)).toBeVisible();
		await expect(mediaItem(E2E_SIMILAR_MEDIA_ID)).toBeVisible();
		await mediaItem(E2E_PRIMARY_MEDIA_ID).click({ modifiers: ["Control"] });
		await mediaItem(E2E_SIMILAR_MEDIA_ID).click({ modifiers: ["Control"] });
		const bulkActions = page.getByTestId("search-bulk-actions-bar");
		await expect(bulkActions).toContainText("2件選択中");
		await bulkActions
			.getByRole("button", { name: "一括操作を実行", exact: true })
			.click();
		const bulkDialog = page.getByRole("dialog", {
			name: "一括操作を実行",
			exact: true,
		});
		await expect(bulkDialog).toContainText("2件のメディア");
		await bulkDialog
			.getByRole("button", { name: "キャンセル", exact: true })
			.click();
		await expect(bulkActions).toContainText("2件選択中");

		await mediaItem(E2E_PRIMARY_MEDIA_ID).click({ button: "right" });
		await page
			.getByRole("menuitem", { name: /^削除(?: Delete)?$/, exact: true })
			.click();
		const deleteDialog = page.getByRole("dialog", {
			name: "メディアを削除",
			exact: true,
		});
		await expect(deleteDialog).toContainText(E2E_PRIMARY_FILE_NAME);
		await deleteDialog
			.getByRole("button", { name: "キャンセル", exact: true })
			.click();
		await expect(mediaItem(E2E_PRIMARY_MEDIA_ID)).toBeVisible();
		await expect(bulkActions).toContainText("2件選択中");

		const copied = await transfer(
			E2E_PRIMARY_MEDIA_ID,
			"copy",
			copyDestination,
		);
		await expect(bulkActions).toContainText("2件選択中");
		const moved = await transfer(copied.id, "move", moveDestination);
		await expect(mediaItem(copied.id)).toHaveCount(0);
		expect((await searchSource(copyDestination.id)).total).toBe(0);
		await mediaItem(moved.id).click({ modifiers: ["Control"] });
		await expect(bulkActions).toContainText("3件選択中");
		await mediaItem(moved.id).click({ button: "right" });
		await page
			.getByRole("menuitem", { name: /^削除(?: Delete)?$/, exact: true })
			.click();
		const deleted = page.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === "/api/rpc/media/delete" &&
				response.ok(),
		);
		await deleteDialog
			.getByRole("button", { name: "削除", exact: true })
			.click();
		await deleted;
		await expect(mediaItem(moved.id)).toHaveCount(0);
		await expect(bulkActions).toContainText("2件選択中");
		expect((await searchSource(moveDestination.id)).total).toBe(0);
	} finally {
		for (const source of sources) {
			await page.request.post("/api/rpc/sources/delete", {
				data: { json: { id: source.id } },
			});
			await rm(source.directory, { recursive: true, force: true });
		}
	}
});
