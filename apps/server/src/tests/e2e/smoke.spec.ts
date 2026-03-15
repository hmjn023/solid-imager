import { expect, test } from "@playwright/test";

const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_REGEX = /404/;

test.describe("Smoke Test - Page Accessibility", () => {
  const pages = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
    { name: "Config", path: "/config" },
    { name: "Manager", path: "/manager" },
    { name: "Search", path: "/search" },
    { name: "Sources", path: "/sources" },
    { name: "Swagger API Docs", path: "/docs/swagger" },
  ];

  for (const page of pages) {
    test(`should access ${page.name} page`, async ({ page: p }) => {
      const response = await p.goto(page.path);

      // Check if response is successful (2xx)
      expect(response?.status()).toBeLessThan(BAD_REQUEST_STATUS);

      // Simple accessibility check by waiting for some content
      await expect(p).not.toHaveTitle(NOT_FOUND_REGEX);
    });
  }
});
