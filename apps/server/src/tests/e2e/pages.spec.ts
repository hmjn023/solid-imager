import { test, expect } from '@playwright/test';

const STATIC_PAGES = [
  '/',
  '/config',
  '/about',
  '/manager',
  '/search',
  '/sources',
  '/docs/swagger'
];

test.describe('Static pages', () => {
  for (const pagePath of STATIC_PAGES) {
    test(`should load ${pagePath} successfully without crashing`, async ({ page }) => {
      const response = await page.goto(pagePath);
      // Ensure the response was successful (200 OK)
      expect(response?.status()).toBe(200);
    });
  }
});

test.describe('Dynamic routes', () => {
  test('should load /sources/123 without crashing', async ({ page }) => {
    const response = await page.goto('/sources/123');
    // Ensure the response does not indicate a server crash (500)
    expect(response?.status()).toBeLessThan(500);
  });
});
