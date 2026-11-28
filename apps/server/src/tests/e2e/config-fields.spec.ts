import { AppConfigSchema } from "@solid-imager/core/config";
import { apiPathPattern, apiRequest } from "./support/api";
import { selectSettingsCategory } from "./support/settings-navigation";
import { expect, test, waitForAppHydration } from "./support/test";

test("settings fields associate help and errors and save corrected values", async ({
	page,
	request,
}) => {
	const original = await apiRequest(request, "config/get");
	expect(original.ok()).toBe(true);
	const { jobs, media } = AppConfigSchema.parse(await original.json());
	const nextConcurrency = jobs.concurrency === 2 ? 3 : 2;
	const hint = "ダウンロード・処理を同時に実行する数。";

	try {
		await page.goto("/config", { waitUntil: "domcontentloaded" });
		await waitForAppHydration(page);

		await selectSettingsCategory(page, "AI");
		await expect(
			page.getByRole("textbox", { name: "リモートAIサーバーURL（oRPC）" }),
		).toHaveAccessibleDescription(/空欄の場合はローカルで処理.+入力例：/);
		await selectSettingsCategory(page, "ログ");
		await expect(
			page.getByRole("combobox", { name: "ログレベル", exact: true }),
		).toBeVisible();
		await selectSettingsCategory(page, "メディア");
		const extensions = page.getByRole("textbox", { name: "画像の拡張子" });
		const savedExtensions = media.supportedExtensions.image.join(", ");
		const draft = `${savedExtensions},`;
		await extensions.fill(draft);
		await expect(extensions).toHaveValue(draft);
		await extensions.press("Tab");
		await expect(extensions).toHaveValue(savedExtensions);
		await page.getByRole("button", { name: "破棄", exact: true }).click();

		await selectSettingsCategory(page, "ジョブ");

		const concurrency = page.getByRole("spinbutton", {
			name: "同時実行数",
			exact: true,
		});
		const save = page.getByRole("button", { name: "変更を保存", exact: true });
		await page.getByText("同時実行数", { exact: true }).click();
		await expect(concurrency).toBeFocused();
		await expect(concurrency).toHaveAccessibleDescription(hint);
		await expect(save).toBeHidden();

		await concurrency.fill("0");
		await expect(concurrency).toHaveAttribute("aria-invalid", "true");
		await expect(concurrency).toHaveAccessibleDescription(
			/ダウンロード・処理を同時に実行する数。.+/,
		);
		await expect(save).toBeDisabled();

		await concurrency.fill(String(nextConcurrency));
		await expect(concurrency).not.toHaveAttribute("aria-invalid", "true");
		await expect(concurrency).toHaveAccessibleDescription(hint);
		await expect(save).toBeEnabled();

		const update = page.waitForResponse(apiPathPattern("config/update"));
		await save.click();
		expect((await update).ok()).toBe(true);
		await expect(
			page.getByText("設定を保存しました", { exact: true }),
		).toBeVisible();
		await expect(save).toBeHidden();

		await page.reload({ waitUntil: "domcontentloaded" });
		await waitForAppHydration(page);
		await selectSettingsCategory(page, "ジョブ");
		await expect(concurrency).toHaveValue(String(nextConcurrency));
		await expect(concurrency).toHaveAccessibleDescription(hint);
	} finally {
		const restored = await apiRequest(request, "config/update", { jobs });
		expect(restored.ok()).toBe(true);
	}
});
