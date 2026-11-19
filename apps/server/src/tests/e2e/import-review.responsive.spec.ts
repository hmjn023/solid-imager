import { pendingImportJobSchema } from "@solid-imager/core/media";
import { z } from "zod";
import {
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SOURCE_ID,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("import inbox previews the full image and details without changing the selection", async ({
	page,
}, testInfo) => {
	await page.goto("/about");
	await waitForAppHydration(page);
	const titlePrefix =
		"制作サンプルのキャラクター設定資料と仕上げの確認用イメージ";
	const items = [
		{ mediaId: E2E_PRIMARY_MEDIA_ID, kind: "昼光版", author: "大橋 葵" },
		{ mediaId: E2E_SIMILAR_MEDIA_ID, kind: "夜景版", author: "大橋 茜" },
	].map(({ mediaId, kind, author }) => ({
		targetUrl: new URL(
			`/api/sources/${E2E_SOURCE_ID}/thumbnail/${mediaId}`,
			page.url(),
		).toString(),
		description: `${titlePrefix}・${kind}`,
		fileName: `設定資料-${kind}.png`,
		authors: [{ name: author }],
	}));
	const response = await page.request.post("/api/rpc/imports/bulkAdd", {
		data: { json: { items } },
	});
	expect(response.ok()).toBe(true);
	const list = await page.request.post("/api/rpc/imports/listPending", {
		data: { json: null },
	});
	expect(list.ok()).toBe(true);
	const pending = z
		.array(pendingImportJobSchema)
		.parse((await list.json()).json);
	const jobs = pending.filter((job) =>
		items.some((item) => item.description === job.item.description),
	);
	try {
		expect(jobs).toHaveLength(2);
		const openInbox = page.getByRole("button", { name: /^取り込み待ち/ });
		await expect(openInbox).toBeEnabled();
		await openInbox.click();
		const inbox = page.getByRole("dialog", {
			name: "取り込み待ち",
			exact: true,
		});
		await expect(inbox).toBeVisible();
		await expect(
			inbox.getByRole("button", { name: "内容を見る", exact: true }),
		).toHaveCount(2);
		await expect
			.poll(() =>
				inbox
					.locator("img")
					.evaluateAll(
						(images: HTMLImageElement[]) =>
							images.filter((image) => image.naturalWidth > 0).length,
					),
			)
			.toBe(2);
		await page.screenshot({
			path: testInfo.outputPath("import-inbox.png"),
			animations: "disabled",
		});
		const second = items[1];
		await inbox.getByText(second.description, { exact: true }).click();
		await expect(inbox.getByText("2件中1件 選択中")).toBeVisible();
		const openPreview = inbox.getByRole("button", {
			name: "内容を見る",
			exact: true,
			description: second.description,
		});
		await openPreview.click();
		const preview = page.getByRole("dialog", { name: "取り込みプレビュー" });
		await expect(preview).toBeVisible();
		await expect(
			preview.getByText(second.description, { exact: true }),
		).toBeVisible();
		await expect(
			preview.getByText(second.fileName, { exact: true }),
		).toBeVisible();
		await expect(
			preview.getByText(second.authors[0].name, { exact: true }),
		).toBeVisible();
		const image = preview.getByRole("img", { name: "取り込みプレビュー" });
		await expect
			.poll(() =>
				image.evaluate((element: HTMLImageElement) => element.naturalWidth),
			)
			.toBeGreaterThan(0);
		await expect(image).toHaveCSS("object-fit", "contain");
		await page.screenshot({
			path: testInfo.outputPath("import-preview.png"),
			animations: "disabled",
		});
		await page.keyboard.press("Escape");
		await expect(preview).toBeHidden();
		await expect(openPreview).toBeFocused();
		await expect(inbox.getByText("2件中1件 選択中")).toBeVisible();
	} finally {
		const cancel = await page.request.post("/api/rpc/imports/cancel", {
			data: { json: { jobIds: jobs.map((job) => job.id) } },
		});
		expect(cancel.ok()).toBe(true);
	}
});
