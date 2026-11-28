import { apiPathPattern, apiRequest } from "./support/api";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { E2E_SOURCE_NAME } from "./support/fixture";
import { selectManagerCategory } from "./support/manager-navigation";
import { expect, test, waitForAppHydration } from "./support/test";

const entityIdResponse = z.object({ id: z.uuid() });

test("manager source selectors expose all sources only where supported", async ({
	page,
}) => {
	await page.goto("/manager");
	await waitForAppHydration(page);

	const source = page.getByRole("combobox", { name: /^対象ソース(?: |$)/ });
	const allSources = page.getByRole("option", {
		name: "すべてのソース",
		exact: true,
	});
	const localSource = page.getByRole("option", {
		name: E2E_SOURCE_NAME,
		exact: true,
	});
	for (const category of ["一括タグ付け", "ベクトル抽出", "重複検出"]) {
		await selectManagerCategory(page, category);
		await expect(source).toHaveText("すべてのソース");
		await source.click();
		await expect(allSources).toHaveAttribute("aria-selected", "true");
		await localSource.click();
		await expect(source).toHaveText(E2E_SOURCE_NAME);
		await source.click();
		await localSource.click();
		await expect(source).toHaveText(E2E_SOURCE_NAME);
		if (await allSources.isVisible()) await page.keyboard.press("Escape");
		await source.click();
		await allSources.click();
		await expect(source).toHaveText("すべてのソース");
	}

	await selectManagerCategory(page, "サムネイル");
	await expect(
		page.getByRole("button", { name: "不足するサムネイルを生成" }),
	).toBeDisabled();
	await source.click();
	await expect(localSource).toBeVisible();
	await expect(allSources).toHaveCount(0);
});

test("manager character form keeps selected IPs and recovers an Enter submission", async ({
	browserHealth,
	page,
	request,
}) => {
	const suffix = randomUUID().slice(0, 8);
	const firstIpName = `Manager IP A ${suffix}`;
	const secondIpName = `Manager IP B ${suffix}`;
	const characterName = `Manager character ${suffix}`;
	const updatedName = `Updated ${characterName}`;
	const ipIds: string[] = [];
	let characterId: string | undefined;
	const release = Promise.withResolvers<void>();
	let submissions = 0;

	try {
		for (const name of [firstIpName, secondIpName]) {
			const result = await apiRequest(request, "ips/create", { name });
			expect(result.ok()).toBe(true);
			ipIds.push(entityIdResponse.parse(await result.json()).id);
		}
		const character = await apiRequest(request, "characters/create", {
			name: characterName,
			ipIds: [ipIds[0]],
		});
		expect(character.ok()).toBe(true);
		characterId = entityIdResponse.parse(await character.json()).id;

		const updateUrl = apiPathPattern("characters/update");
		browserHealth.allowResponseFailure(apiPathPattern("characters/update"));
		browserHealth.allowConsole(/Failed to load resource:.*503/);
		await page.route(updateUrl, async (route) => {
			submissions++;
			if (submissions > 1) {
				await route.continue();
				return;
			}
			await release.promise;
			await route.fulfill({
				status: 503,
				json: {
					defined: false,
					code: "SERVICE_UNAVAILABLE",
					status: 503,
					message: "Manager save temporarily unavailable",
				},
			});
		});

		await page.goto("/manager");
		await waitForAppHydration(page);
		await selectManagerCategory(page, "キャラクター");
		await page
			.getByRole("button", { name: characterName, exact: true })
			.click();
		await page
			.getByRole("button", { name: `${characterName}を編集`, exact: true })
			.click();
		const dialog = page.getByRole("dialog", { name: "キャラクターを編集" });
		const firstIp = dialog.getByRole("button", {
			name: `「${firstIpName}」を選択から外す`,
			exact: true,
		});
		const secondIp = dialog.getByRole("button", {
			name: `「${secondIpName}」を選択から外す`,
			exact: true,
		});
		await expect(firstIp).toBeVisible();
		const ipPicker = dialog.getByRole("combobox", { name: "IP", exact: true });
		await ipPicker.fill(secondIpName);
		await dialog
			.getByRole("option", { name: secondIpName, exact: true })
			.click();
		await ipPicker.press("Escape");
		await expect(ipPicker).toHaveAttribute("aria-expanded", "false");
		await firstIp.click();
		await expect(firstIp).toHaveCount(0);
		await expect(secondIp).toBeVisible();

		const name = dialog.getByRole("textbox", { name: "名前", exact: true });
		await name.fill(updatedName);
		const discard = page.getByRole("alertdialog", {
			name: "未保存の変更を破棄しますか？",
		});
		await name.press("Escape");
		await expect(discard).toBeVisible();
		await discard.getByRole("button", { name: "編集を続ける" }).click();
		await expect(discard).toBeHidden();
		await expect(name).toHaveValue(updatedName);
		await expect(secondIp).toBeVisible();
		await name.press("Enter");
		await expect(
			dialog.getByRole("button", { name: "保存中..." }),
		).toBeDisabled();
		await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
		await page.keyboard.press("Escape");
		await page.mouse.click(2, 2);
		await expect(dialog).toBeVisible();
		await expect(page.getByRole("alertdialog")).toHaveCount(0);
		await expect.poll(() => submissions).toBe(1);

		release.resolve();
		await expect(dialog.getByRole("alert")).toContainText(
			"Manager save temporarily unavailable",
		);
		await expect(name).toHaveValue(updatedName);
		await expect(secondIp).toBeVisible();
		await name.press("Enter");
		await expect(dialog).toBeHidden();
		await expect(page.locator('[data-slot="dialog-backdrop"]')).toHaveCount(0);

		await page.getByRole("button", { name: updatedName, exact: true }).click();
		await page
			.getByRole("button", { name: `${updatedName}を編集`, exact: true })
			.click();
		await expect(firstIp).toHaveCount(0);
		await expect(secondIp).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(discard).toBeHidden();
		expect(submissions).toBe(2);
	} finally {
		release.resolve();
		if (characterId) {
			await apiRequest(request, "characters/delete", { id: characterId });
		}
		for (const id of ipIds) {
			await apiRequest(request, "ips/delete", { id });
		}
	}
});
