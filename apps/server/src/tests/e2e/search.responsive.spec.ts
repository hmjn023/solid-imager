import type { Page } from "@playwright/test";
import { E2E_PRIMARY_FILE_NAME } from "./support/fixture";
import { expect, test } from "./support/test";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth -
			document.documentElement.clientWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
}

test("search keeps controls usable without horizontal overflow", async ({
	page,
}, testInfo) => {
	await page.goto("/search");
	await expect(
		page.getByRole("heading", { name: "メディア検索", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	await expectNoHorizontalOverflow(page);

	const usesMobileFilterDialog = ["responsive-320", "responsive-375"].includes(
		testInfo.project.name,
	);
	if (usesMobileFilterDialog) {
		await page.getByRole("button", { name: "Filter results" }).click();
		const filterDialog = page.getByRole("dialog");
		await expect(filterDialog).toBeVisible();
		await expect(
			filterDialog.getByRole("heading", {
				name: "検索フィルター",
				exact: true,
			}),
		).toBeVisible();
		await expect(
			filterDialog.getByRole("button", { name: "簡易", exact: true }),
		).toBeVisible();
		const conditionSummary = filterDialog.getByRole("status");
		await expect(conditionSummary).toContainText("現在の条件");
		const resultCount = page.getByText(/^\d+ 件の結果$/);
		const initialResultCount = await resultCount.textContent();

		let fileNameInput = filterDialog.getByPlaceholder("ファイル名を入力...");
		await fileNameInput.fill("e2e");
		await expect(conditionSummary).toContainText("ファイル名: e2e");
		await page.keyboard.press("Escape");
		await expect(filterDialog).toBeHidden();
		await expect(resultCount).toHaveText(initialResultCount ?? "");

		await page.getByRole("button", { name: "Filter results" }).click();
		await expect(filterDialog).toBeVisible();
		fileNameInput = filterDialog.getByPlaceholder("ファイル名を入力...");
		await expect(fileNameInput).toHaveValue("");
		await expect(filterDialog.getByRole("status")).not.toContainText(
			"ファイル名:",
		);

		await fileNameInput.fill("e2e");
		await filterDialog.getByRole("button", { name: "Dismiss" }).click();
		await expect(filterDialog).toBeHidden();
		await expect(resultCount).toHaveText(initialResultCount ?? "");

		await page.getByRole("button", { name: "Filter results" }).click();
		await expect(filterDialog).toBeVisible();
		fileNameInput = filterDialog.getByPlaceholder("ファイル名を入力...");
		await expect(fileNameInput).toHaveValue("");
		const applyButton = filterDialog.getByRole("button", {
			name: "適用",
			exact: true,
		});
		await filterDialog
			.getByRole("button", { name: "ベクトル類似", exact: true })
			.click();
		await expect(applyButton).toBeDisabled();
		await filterDialog
			.getByRole("button", { name: "条件をクリア", exact: true })
			.click();
		await expect(applyButton).toBeEnabled();
		await expect(fileNameInput).toHaveValue("");
		await expect(conditionSummary).toContainText("条件は指定されていません。");

		await fileNameInput.fill("e2e");
		await applyButton.click();
		await expect(filterDialog).toBeHidden();
	} else {
		await expect(
			page.getByRole("heading", { name: "検索フィルター", exact: true }),
		).toBeVisible();
		await expect(page.getByPlaceholder("ファイル名を入力...")).toBeVisible();

		if (testInfo.project.name === "responsive-768") {
			await page.setViewportSize({ width: 768, height: 480 });
			const filterCard = page
				.getByRole("heading", { name: "検索フィルター", exact: true })
				.locator("..")
				.locator("..");
			const scrollState = await filterCard.evaluate((element) => {
				element.scrollTop = element.scrollHeight;
				const bounds = element.getBoundingClientRect();
				return {
					clientHeight: element.clientHeight,
					scrollHeight: element.scrollHeight,
					scrollTop: element.scrollTop,
					isWithinViewport:
						bounds.top >= 0 && bounds.bottom <= window.innerHeight,
				};
			});
			expect(scrollState.scrollHeight).toBeGreaterThan(
				scrollState.clientHeight,
			);
			expect(scrollState.scrollTop).toBeGreaterThan(0);
			expect(scrollState.isWithinViewport).toBe(true);

			const lastFilter = filterCard.getByPlaceholder("プロジェクトを検索...");
			await expect(lastFilter).toBeVisible();
			expect(
				await lastFilter.evaluate((element) => {
					const card = element.closest(".sticky");
					if (!(card instanceof HTMLElement)) return false;
					const inputBounds = element.getBoundingClientRect();
					const cardBounds = card.getBoundingClientRect();
					return (
						inputBounds.top >= cardBounds.top &&
						inputBounds.bottom <= cardBounds.bottom
					);
				}),
			).toBe(true);
		}
	}

	await expectNoHorizontalOverflow(page);
});
