import { expect, test } from "@playwright/test";

const SOLID_IMAGER_TITLE_REGEX = /solid-imager/;

test("has title", async ({ page }) => {
  await page.goto("/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(SOLID_IMAGER_TITLE_REGEX);
});

test("get started link", async ({ page }) => {
  await page.goto("/");

  // Click the get started link.
  await page.getByRole("link", { name: "Solid Imager" }).click();

  // Expects page to have a heading with the name of the current URL.
  await expect(
    page.getByRole("heading", { name: "Solid Imager" })
  ).toBeVisible();
});
