import { expect, test } from "@playwright/test";

const HTTP_OK = 200;
const HTTP_INTERNAL_SERVER_ERROR = 500;

test.describe("SSR Crashing Check - E2E", () => {
  const pages = ["/", "/config", "/about"];

  for (const pagePath of pages) {
    test(`should load ${pagePath} without crashing`, async ({ page }) => {
      const response = await page.goto(pagePath);
      // Ensure the response was successful (200 OK)
      expect(response?.status()).toBe(HTTP_OK);
    });
  }

  test("should load dynamic route /sources/123 without crashing", async ({
    page,
  }) => {
    const response = await page.goto("/sources/123");
    // Ensure the response does not indicate a server crash (500)
    expect(response?.status()).toBeLessThan(HTTP_INTERNAL_SERVER_ERROR);
  });
});
