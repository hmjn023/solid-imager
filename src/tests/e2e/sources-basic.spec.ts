import { test, expect } from "@playwright/test";

test.describe("Media Sources - Basic Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sources");
    await page.waitForLoadState("networkidle");
  });

  test("should display the sources page with header and add button", async ({ page }) => {
    // Check page title
    await expect(page.locator('h1:has-text("Media Sources")')).toBeVisible();

    // Check Add Source button exists
    await expect(page.locator('button:has-text("Add Source")')).toBeVisible();

    // Check if sources grid exists
    await expect(page.locator('.grid')).toBeVisible();
  });

  test("should open and close add modal", async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Add Source")');
    await expect(page.locator('[data-testid="source-form-modal"], h2:has-text("Add Media Source")')).toBeVisible();

    // Close modal
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('[data-testid="source-form-modal"], h2:has-text("Add Media Source")')).not.toBeVisible();
  });

  test("should show validation - create button disabled with empty form", async ({ page }) => {
    await page.click('button:has-text("Add Source")');

    // Create button should be disabled initially
    await expect(page.locator('button:has-text("Create")')).toBeDisabled();
  });

  test("should enable create button when required fields are filled", async ({ page }) => {
    await page.click('button:has-text("Add Source")');

    // Fill required fields
    await page.fill('#source-name', "Test Source");
    await page.fill('#source-path', "/test/path");

    // Create button should be enabled
    await expect(page.locator('button:has-text("Create")')).toBeEnabled();
  });
});