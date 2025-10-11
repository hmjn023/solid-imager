import { expect, test } from "@playwright/test";

const SOLID_IMAGER_TITLE_REGEX = /solid-imager/;

test("has title", async ({ page }) => {
  await page.goto("/");

  // タイトルが部分文字列を「含む」ことを期待します。
  await expect(page).toHaveTitle(SOLID_IMAGER_TITLE_REGEX);
});

test("get started link", async ({ page }) => {
  await page.goto("/");

  // 開始リンクをクリックします。
  await page.getByRole("link", { name: "Solid Imager" }).click();

  // ページに現在のURLの名前を持つ見出しがあることを期待します。
  await expect(
    page.getByRole("heading", { name: "Solid Imager" })
  ).toBeVisible();
});
