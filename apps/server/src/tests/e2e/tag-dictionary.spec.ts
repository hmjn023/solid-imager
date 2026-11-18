import { E2E_SIMILAR_MEDIA_ID, mediaPath } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("browses the imported dictionary after reload and assigns a tag from the media editor", async ({
	page,
}) => {
	await page.goto("/manager");
	await waitForAppHydration(page);
	await page
		.getByRole("button", { name: /^タグ辞書/ })
		.filter({ visible: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "タグ辞書", exact: true }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "更新を確認" })).toBeEnabled();
	await expect(page.getByText(/1件 · 2026-06-01版/)).toBeVisible();

	await page.reload();
	await waitForAppHydration(page);
	const search = page.getByRole("searchbox", {
		name: "タグ名・別名",
	});
	await search.fill("波状の髪");
	await search.press("Enter");
	await expect(page.getByText("一致するタグがありません")).toBeVisible();
	await search.fill("waved_hair");
	await search.press("Enter");
	const result = page.getByRole("button", { name: /^wavy_hair/ });
	const category = page.getByRole("button", { name: /^分類 / });
	await category.click();
	await page.getByRole("option", { name: "作者", exact: true }).click();
	await expect(page.getByText("一致するタグがありません")).toBeVisible();
	await category.click();
	await page.getByRole("option", { name: "一般", exact: true }).click();
	await result.click();
	await expect(
		page.getByText("Hair that falls in waves.", { exact: true }),
	).toBeVisible();
	await expect(page.getByText("头发 / 发型", { exact: true })).toBeVisible();
	await page.setViewportSize({ width: 375, height: 800 });
	await expect(search).toBeVisible();
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth),
	).toBeLessThanOrEqual(375);
	await page.setViewportSize({ width: 1440, height: 900 });

	await page.goto(mediaPath());
	await waitForAppHydration(page);
	const tags = page
		.getByRole("heading", { name: "タグ", exact: true })
		.locator("..")
		.locator("..");
	await tags.getByRole("button", { name: "編集", exact: true }).click();
	try {
		await tags.getByRole("button", { name: "タグ辞書", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "タグ辞書" });
		await dialog.getByRole("searchbox").fill("waved_hair");
		await dialog.getByRole("searchbox").press("Enter");
		await dialog.getByRole("button", { name: /^wavy_hair/ }).click();
		await dialog.getByRole("button", { name: "タグに追加" }).click();
		await expect(page.locator("#positive-tags")).toHaveValue(/wavy_hair/);
		await tags.getByRole("button", { name: "保存", exact: true }).click();
		await expect(tags.getByText("wavy_hair", { exact: true })).toBeVisible();

		let wikiRequests = 0;
		page.on("request", (request) => {
			if (new URL(request.url()).pathname.endsWith("/tags/dictionaryDetail"))
				wikiRequests++;
		});
		await page.mouse.move(0, 0);
		await page.reload();
		await waitForAppHydration(page);
		const badge = tags.getByRole("group", { name: "wavy_hair" });
		await expect(badge).toBeVisible();
		expect(wikiRequests).toBe(0);
		const preview = page.getByRole("tooltip");
		const { promise: wikiGate, resolve: allowWiki } =
			Promise.withResolvers<void>();
		await page.route(
			"**/api/rpc/tags/dictionaryDetail",
			async (route) => {
				await wikiGate;
				await route.continue();
			},
			{ times: 1 },
		);
		try {
			await tags.getByRole("button", { name: "編集", exact: true }).focus();
			await page.keyboard.press("Tab");
			await expect(preview).toContainText("読み込み");
			await expect(badge).toBeFocused();
		} finally {
			allowWiki();
		}
		await expect(preview).toContainText("Hair that falls in waves.");
		await page.keyboard.press("Escape");
		await expect(preview).toBeHidden();
		await expect(badge).toBeFocused();
		await tags.getByRole("button", { name: "編集", exact: true }).focus();

		await badge.hover();
		await expect(preview).toContainText("Hair that falls in waves.");
		await expect(preview).toContainText("ウェーブヘア");
		await preview.hover();
		await expect(preview).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(preview).toBeHidden();
		await expect(badge.getByRole("button", { name: /コピー/ })).toBeEnabled();
		expect(wikiRequests).toBe(1);
	} finally {
		const assigned = tags.getByText("wavy_hair", { exact: true });
		if (await assigned.isVisible()) {
			await tags.getByRole("button", { name: "編集", exact: true }).click();
			const text = page.locator("#positive-tags");
			await text.fill(
				(await text.inputValue())
					.split("\n")
					.filter((name) => name !== "wavy_hair")
					.join("\n"),
			);
			await tags.getByRole("button", { name: "保存", exact: true }).click();
			await expect(assigned).toBeHidden();
		}
	}
});

test("confirms manual migration and keeps the tag attached to the media after reload", async ({
	page,
}) => {
	const oldName = "e2e_old_hair_label";
	const imagePath = mediaPath(E2E_SIMILAR_MEDIA_ID);
	await page.goto(imagePath);
	await waitForAppHydration(page);
	const tags = page
		.getByRole("heading", { name: "タグ", exact: true })
		.locator("..")
		.locator("..");
	await tags.getByRole("button", { name: "編集", exact: true }).click();
	const input = page.locator("#positive-tags");
	const before = await input.inputValue();
	await input.fill([before, oldName].filter(Boolean).join("\n"));
	await tags.getByRole("button", { name: "保存", exact: true }).click();
	await expect(tags.getByText(oldName, { exact: true })).toBeVisible();
	try {
		await page.goto("/manager");
		await waitForAppHydration(page);
		await page
			.getByRole("button", { name: /^タグ辞書/ })
			.filter({ visible: true })
			.click();
		await page
			.getByRole("button", { name: "旧タグの移行", exact: true })
			.click();
		const legacy = page.getByRole("searchbox", { name: "旧タグ名" });
		await legacy.fill(oldName);
		await legacy.press("Enter");
		const pick = page.getByRole("button", {
			name: `${oldName} の移行先を選ぶ`,
		});
		const dialog = page.getByRole("dialog");
		const choose = async () => {
			await pick.click();
			const search = dialog.getByRole("searchbox");
			await search.fill("waved_hair");
			await search.press("Enter");
			await dialog.getByRole("button", { name: /^wavy_hair/ }).click();
			await dialog.getByRole("button", { name: "このタグを選ぶ" }).click();
			await expect(
				dialog.getByRole("heading", { name: "タグの移行を確認" }),
			).toBeVisible();
		};
		await choose();
		const cancel = dialog.getByRole("button", { name: "キャンセル" });
		await expect(cancel).toBeFocused();
		await cancel.press("Enter");
		await expect(dialog).toBeHidden();
		await expect(pick).toBeFocused();
		await choose();
		await dialog.getByRole("button", { name: "タグを移行" }).click();
		await expect(
			page.getByText(`「${oldName}」を「wavy_hair」に移行しました。`),
		).toBeVisible();
		await expect(pick).toBeHidden();
		await page.goto(imagePath);
		await waitForAppHydration(page);
		await page.reload();
		await waitForAppHydration(page);
		await expect(tags.getByText("wavy_hair", { exact: true })).toBeVisible();
		await expect(tags.getByText(oldName, { exact: true })).toBeHidden();
	} finally {
		await page.goto(imagePath);
		await waitForAppHydration(page);
		await tags.getByRole("button", { name: "編集", exact: true }).click();
		await input.fill(before);
		await tags.getByRole("button", { name: "保存", exact: true }).click();
		await expect(tags.getByText("wavy_hair", { exact: true })).toBeHidden();
	}
});

test("saves the optional Wiki lookup setting and starts with it off", async ({
	page,
}) => {
	await page.goto("/config");
	await waitForAppHydration(page);
	const mediaTab = page.getByRole("tab", { name: /^メディア/ });
	const setting = page.getByRole("switch", {
		name: "不足しているWikiの説明を自動取得",
	});
	const save = page.getByRole("button", { name: "変更を保存" });
	await mediaTab.click();
	await expect(setting).not.toBeChecked();

	await setting.press("Space");
	await expect(setting).toBeChecked();
	await save.click();
	await expect(
		page.getByText("設定を保存しました", { exact: true }),
	).toBeVisible();

	await page.reload();
	await waitForAppHydration(page);
	await mediaTab.click();
	await expect(setting).toBeChecked();
	await setting.press("Space");
	await save.click();
	await expect(
		page.getByText("設定を保存しました", { exact: true }),
	).toBeVisible();
	await expect(setting).not.toBeChecked();
});
