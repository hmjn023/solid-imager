import type { TagDictionaryStatus } from "@solid-imager/core/tags";
import { apiPathPattern, apiRequestMatches } from "./support/api";
import { E2E_SIMILAR_MEDIA_ID, mediaPath } from "./support/fixture";
import { selectManagerCategory } from "./support/manager-navigation";
import { expect, test, waitForAppHydration } from "./support/test";

test("shows the import job and individual dictionary sources on a narrow screen", async ({
	page,
}) => {
	await page.setViewportSize({ width: 375, height: 812 });
	const jobId = crypto.randomUUID();
	const updatedAt = new Date().toISOString();
	let status: TagDictionaryStatus = { snapshots: [], job: null };
	await page.route(apiPathPattern("tags/dictionaryStatus"), (route) =>
		route.fulfill({ json: status }),
	);
	const { promise: responseGate, resolve: finishRequest } =
		Promise.withResolvers<void>();
	await page.route(apiPathPattern("tags/dictionaryRefresh"), async (route) => {
		await responseGate;
		status = {
			snapshots: [],
			job: { id: jobId, status: "pending", error: null, updatedAt },
		};
		await route.fulfill({ json: { jobId } });
	});

	await page.goto("/manager");
	await waitForAppHydration(page);
	await selectManagerCategory(page, "タグ辞書");
	const panel = page.getByRole("region", { name: "タグ辞書", exact: true });
	const install = panel.getByRole("button", { name: "辞書を取り込む" });
	await expect(panel.getByText("未取り込み", { exact: true })).toHaveCount(3);
	await expect(panel.getByRole("searchbox")).toHaveCount(0);
	try {
		await install.press("Enter");
		await expect(install).toBeDisabled();
		await expect(panel.getByText("辞書ジョブを登録しています…")).toBeVisible();
	} finally {
		finishRequest();
	}
	await expect(panel.getByText("待機中", { exact: true })).toBeVisible();
	await expect(install).toBeDisabled();
	await expect(
		panel.getByRole("link", { name: "ジョブの詳細" }),
	).toHaveAttribute("href", `/jobs?jobId=${jobId}`);

	status = {
		snapshots: [
			{ source: "tags", version: updatedAt, count: 1, installedAt: updatedAt },
		],
		job: {
			id: jobId,
			status: "failed",
			error: "Wiki snapshot unavailable",
			updatedAt,
		},
	};
	await page.reload();
	await waitForAppHydration(page);
	await expect(panel.getByText("Wiki snapshot unavailable")).toBeVisible();
	await expect(panel.getByText("取り込み済み", { exact: true })).toHaveCount(1);
	await expect(panel.getByText("未取り込み", { exact: true })).toHaveCount(2);
	await expect(panel.getByRole("button", { name: "更新を確認" })).toBeEnabled();
	await expect(
		panel.getByRole("searchbox", { name: "タグ名・別名" }),
	).toBeVisible();
	expect(
		await panel.evaluate((element) => element.scrollWidth),
	).toBeLessThanOrEqual(await panel.evaluate((element) => element.clientWidth));
});

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
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
		.toBeLessThanOrEqual(375);
	await page.setViewportSize({ width: 1440, height: 900 });

	await page.goto(mediaPath());
	await waitForAppHydration(page);
	const tags = page
		.getByRole("heading", { name: "タグ", exact: true })
		.locator("..")
		.locator("..");
	const edit = tags.getByRole("button", { name: "編集", exact: true });
	const editor = page.getByRole("dialog", { name: "タグを割り当てる" });
	const remove = editor.getByRole("button", {
		name: "「wavy_hair」の割り当てを外す",
	});
	await page.setViewportSize({ width: 320, height: 720 });
	await edit.click();
	try {
		const input = editor.getByRole("combobox", { name: "タグ名", exact: true });
		const options = page.getByRole("listbox").getByRole("option");
		await input.fill("wavy_hair");
		await expect(options.first()).toHaveText("「wavy_hair」を新規作成");
		await expect(options.nth(1)).toContainText("ウェーブヘア");
		await input.fill("waved_hair");
		await expect(options.first()).toHaveText("「waved_hair」を新規作成");
		await expect(options.nth(1)).toContainText("wavy_hair");
		await input.press("ArrowDown");
		await input.press("ArrowDown");
		await expect(options.nth(1)).toHaveAttribute("data-highlighted", "");
		await input.press("Enter");
		await expect(remove).toBeVisible();
		await expect(input).toHaveValue("");
		await expect(input).toBeFocused();
		await expect(editor.getByRole("tablist")).toHaveCount(0);
		await input.fill("night sky");
		await input.press("Enter");
		await expect(input).toHaveValue("");
		await input.fill("open sky");
		await page
			.getByRole("option", { name: "「open sky」を新規作成", exact: true })
			.click();
		await expect(input).toBeFocused();
		await input.fill("stale draft");
		await input.evaluate((element) => {
			if (element instanceof HTMLInputElement) element.select();
			const clipboardData = new DataTransfer();
			clipboardData.setData("text/plain", "night sky\r\n夜景\r\n夜景");
			element.dispatchEvent(
				new ClipboardEvent("paste", {
					clipboardData,
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		await expect(input).toHaveValue("");
		for (const name of ["night sky", "open sky", "夜景"]) {
			const chip = editor.getByRole("button", {
				name: `「${name}」の割り当てを外す`,
				exact: true,
			});
			await expect(chip).toHaveCount(1);
			await chip.click();
		}
		await page.keyboard.press("Escape");
		const discard = page.getByRole("alertdialog", {
			name: "変更を破棄しますか？",
		});
		await expect(discard).toBeVisible();
		await discard.getByRole("button", { name: "編集を続ける" }).click();
		await expect(remove).toBeVisible();
		expect(
			await editor.evaluate((element) => element.scrollWidth),
		).toBeLessThanOrEqual(
			await editor.evaluate((element) => element.clientWidth),
		);
		const save = page.waitForRequest(
			apiRequestMatches("media/updatePositiveTags"),
		);
		await editor.getByRole("button", { name: "保存", exact: true }).click();
		expect((await save).postDataJSON()).toMatchObject({
			entries: expect.arrayContaining([
				{ name: "wavy_hair", fromDictionary: true },
			]),
		});
		await expect(editor).toBeHidden();
		await page.setViewportSize({ width: 1440, height: 900 });
		await expect(tags.getByText("wavy_hair", { exact: true })).toBeVisible();

		let wikiRequests = 0;
		page.on("request", (request) => {
			if (apiPathPattern("tags/dictionaryDetail").test(request.url()))
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
			apiPathPattern("tags/dictionaryDetail"),
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
			await edit.click();
			await remove.click();
			await editor.getByRole("button", { name: "保存", exact: true }).click();
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
	const editor = page.getByRole("dialog", { name: "タグを割り当てる" });
	const input = editor.getByRole("combobox", { name: "タグ名", exact: true });
	await input.fill(oldName);
	await editor.getByRole("button", { name: "保存", exact: true }).click();
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
		await editor
			.getByRole("button", { name: "「wavy_hair」の割り当てを外す" })
			.click();
		await editor.getByRole("button", { name: "保存", exact: true }).click();
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
