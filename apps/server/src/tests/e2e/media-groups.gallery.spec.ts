import { expect, test } from "./support/test";

test("creates a tentative comic from a post and preserves failed form input", async ({
	page,
}) => {
	await page.goto(
		`http://127.0.0.1:${process.env.E2E_GALLERY_PORT}/?media-groups=1`,
	);
	await expect(
		page.getByRole("heading", { name: "pixiv:42 · 同時投稿" }),
	).toBeVisible();
	await page
		.getByRole("button", { name: "この画像群で新しいグループを作成" })
		.click();
	await page.getByLabel("グループ名（必須）").fill("fail");
	await page
		.getByRole("button", { name: "暫定グループを作成", exact: true })
		.click();
	await expect(page.getByText("Fixture save failed")).toBeVisible();
	await expect(page.getByLabel("グループ名（必須）")).toHaveValue("fail");
	await page.getByLabel("グループ名（必須）").fill("Chapter 1");
	await page
		.getByRole("button", { name: "暫定グループを作成", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Chapter 1 · 漫画" }),
	).toBeVisible();
	const comic = page
		.getByRole("heading", { name: "Chapter 1 · 漫画" })
		.locator("..");
	await expect(comic.getByRole("link")).toHaveCount(2);
	await comic.getByLabel("紐づけの状態").first().selectOption("confirmed");
	await comic.getByLabel("順番（空欄は未定）").first().fill("3");
	await comic
		.getByRole("button", { name: "保存", exact: true })
		.first()
		.click();
	await expect(comic.getByLabel("紐づけの状態").first()).toHaveValue(
		"confirmed",
	);
	await expect(comic.getByLabel("順番（空欄は未定）").first()).toHaveValue("3");
	await page.setViewportSize({ width: 390, height: 844 });
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);
});
