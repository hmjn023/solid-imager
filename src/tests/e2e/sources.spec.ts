import { expect, test } from "@playwright/test";

test.describe("Media Sources Management", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to sources page before each test
    await page.goto("/sources");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Source Creation", () => {
    test("should open add source modal when clicking Add Source button", async ({
      page,
    }) => {
      // Click the Add Source button
      await page.click('button:has-text("Add Source")');

      // Verify modal is opened
      await expect(
        page.locator('h2:has-text("Add Media Source")')
      ).toBeVisible();

      // Verify form fields are present
      await expect(
        page.locator('input[placeholder="Enter source name"]')
      ).toBeVisible();
      await expect(
        page.locator('input[placeholder="Enter description (optional)"]')
      ).toBeVisible();
      await expect(page.locator("select")).toBeVisible();
      await expect(
        page.locator('input[placeholder="Enter file path"]')
      ).toBeVisible();
    });

    test("should create a new local source successfully", async ({ page }) => {
      // Open modal
      await page.click('button:has-text("Add Source")');

      // Fill form
      await page.fill(
        'input[placeholder="Enter source name"]',
        "Test Local Source"
      );
      await page.fill(
        'input[placeholder="Enter description (optional)"]',
        "Test description"
      );
      await page.selectOption("select", "local");
      await page.fill('input[placeholder="Enter file path"]', "/test/path");

      // Submit form
      await page.click('button:has-text("Create")');

      // Wait for modal to close
      await expect(
        page.locator('h2:has-text("Add Media Source")')
      ).not.toBeVisible();

      // Verify source appears in the list (assuming mock data or API response)
      // This might need adjustment based on actual API behavior
      await expect(page.locator("text=Test Local Source")).toBeVisible();
    });

    test("should create a new SFTP source successfully", async ({ page }) => {
      await page.click('button:has-text("Add Source")');

      await page.fill(
        'input[placeholder="Enter source name"]',
        "Test SFTP Source"
      );
      await page.fill(
        'input[placeholder="Enter description (optional)"]',
        "SFTP test description"
      );
      await page.selectOption("select", "sftp");
      await page.fill(
        'input[placeholder="Enter file path"]',
        "/sftp/test/path"
      );

      await page.click('button:has-text("Create")');

      await expect(
        page.locator('h2:has-text("Add Media Source")')
      ).not.toBeVisible();
      await expect(page.locator("text=Test SFTP Source")).toBeVisible();
    });

    test("should create a new S3 source successfully", async ({ page }) => {
      await page.click('button:has-text("Add Source")');

      await page.fill(
        'input[placeholder="Enter source name"]',
        "Test S3 Source"
      );
      await page.fill(
        'input[placeholder="Enter description (optional)"]',
        "S3 test description"
      );
      await page.selectOption("select", "s3");
      await page.fill(
        'input[placeholder="Enter file path"]',
        "s3://test-bucket/path"
      );

      await page.click('button:has-text("Create")');

      await expect(
        page.locator('h2:has-text("Add Media Source")')
      ).not.toBeVisible();
      await expect(page.locator("text=Test S3 Source")).toBeVisible();
    });

    test("should close modal when clicking Cancel", async ({ page }) => {
      await page.click('button:has-text("Add Source")');

      // Verify modal is open
      await expect(
        page.locator('h2:has-text("Add Media Source")')
      ).toBeVisible();

      // Click Cancel
      await page.click('button:has-text("Cancel")');

      // Verify modal is closed
      await expect(
        page.locator('h2:has-text("Add Media Source")')
      ).not.toBeVisible();
    });
  });

  test.describe("Form Validation", () => {
    test("should disable Create button when required fields are empty", async ({
      page,
    }) => {
      await page.click('button:has-text("Add Source")');

      // Create button should be disabled initially (empty form)
      await expect(page.locator('button:has-text("Create")')).toBeDisabled();

      // Fill only name
      await page.fill('input[placeholder="Enter source name"]', "Test");
      await expect(page.locator('button:has-text("Create")')).toBeDisabled();

      // Fill only path
      await page.fill('input[placeholder="Enter source name"]', "");
      await page.fill('input[placeholder="Enter file path"]', "/test");
      await expect(page.locator('button:has-text("Create")')).toBeDisabled();

      // Fill both required fields
      await page.fill('input[placeholder="Enter source name"]', "Test");
      await expect(page.locator('button:has-text("Create")')).toBeEnabled();
    });

    test("should work with only required fields (name and path)", async ({
      page,
    }) => {
      await page.click('button:has-text("Add Source")');

      // Fill only required fields
      await page.fill(
        'input[placeholder="Enter source name"]',
        "Minimal Source"
      );
      await page.fill('input[placeholder="Enter file path"]', "/minimal/path");

      // Submit should work
      await page.click('button:has-text("Create")');
      await expect(
        page.locator('h2:has-text("Add Media Source")')
      ).not.toBeVisible();
    });
  });

  test.describe("Source Editing", () => {
    test("should open edit modal with pre-filled data when clicking Edit", async ({
      page,
    }) => {
      // Wait for sources to load and click edit on first source
      await page
        .waitForSelector('[data-testid="source-card"]', { timeout: 5000 })
        .catch(() => {
          // If no test id, fall back to looking for edit buttons
        });

      // Click the first Edit button
      await page.click('button:has-text("Edit")').first();

      // Verify edit modal is opened
      await expect(
        page.locator('h2:has-text("Edit Media Source")')
      ).toBeVisible();

      // Verify button shows "Update" instead of "Create"
      await expect(page.locator('button:has-text("Update")')).toBeVisible();

      // Verify form fields are pre-filled (this depends on mock data)
      const nameInput = page.locator('input[placeholder="Enter source name"]');
      await expect(nameInput).not.toHaveValue("");
    });

    test("should update source successfully", async ({ page }) => {
      await page.click('button:has-text("Edit")').first();

      // Modify the name
      await page.fill(
        'input[placeholder="Enter source name"]',
        "Updated Source Name"
      );
      await page.fill(
        'input[placeholder="Enter description (optional)"]',
        "Updated description"
      );

      // Submit update
      await page.click('button:has-text("Update")');

      // Verify modal closes
      await expect(
        page.locator('h2:has-text("Edit Media Source")')
      ).not.toBeVisible();

      // Verify updated name appears (may need API mock)
      await expect(page.locator("text=Updated Source Name")).toBeVisible();
    });

    test("should close edit modal when clicking Cancel", async ({ page }) => {
      await page.click('button:has-text("Edit")').first();

      // Verify modal is open
      await expect(
        page.locator('h2:has-text("Edit Media Source")')
      ).toBeVisible();

      // Click Cancel
      await page.click('button:has-text("Cancel")');

      // Verify modal is closed
      await expect(
        page.locator('h2:has-text("Edit Media Source")')
      ).not.toBeVisible();
    });
  });

  test.describe("Source Deletion", () => {
    test("should open delete confirmation modal when clicking Delete", async ({
      page,
    }) => {
      // Click the first Delete button
      await page.click('button:has-text("Delete")').first();

      // Verify delete confirmation modal is opened
      await expect(
        page.locator('h2:has-text("Delete Media Source")')
      ).toBeVisible();

      // Verify confirmation message is present
      await expect(
        page.locator("text=Are you sure you want to delete")
      ).toBeVisible();

      // Verify Delete and Cancel buttons are present
      await expect(page.locator('button:has-text("Delete")')).toBeVisible();
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    });

    test("should delete source when confirming", async ({ page }) => {
      // Get the source name before deletion (for verification)
      const firstSourceName = await page
        .locator('[data-testid="source-card"] h3, .font-bold')
        .first()
        .textContent();

      await page.click('button:has-text("Delete")').first();

      // Confirm deletion
      await page.click('button:has-text("Delete")').last(); // Use last to get the confirmation button

      // Verify modal closes
      await expect(
        page.locator('h2:has-text("Delete Media Source")')
      ).not.toBeVisible();

      // Verify source is removed (this might need API mocking)
      if (firstSourceName) {
        await expect(page.locator(`text=${firstSourceName}`)).not.toBeVisible();
      }
    });

    test("should cancel deletion when clicking Cancel", async ({ page }) => {
      const initialSourceCount = await page
        .locator('[data-testid="source-card"], .grid > div')
        .count();

      await page.click('button:has-text("Delete")').first();

      // Cancel deletion
      await page.click('button:has-text("Cancel")').last();

      // Verify modal closes
      await expect(
        page.locator('h2:has-text("Delete Media Source")')
      ).not.toBeVisible();

      // Verify source count remains the same
      await expect(
        page.locator('[data-testid="source-card"], .grid > div')
      ).toHaveCount(initialSourceCount);
    });
  });

  test.describe("Loading States", () => {
    test("should show loading state when submitting form", async ({ page }) => {
      await page.click('button:has-text("Add Source")');

      await page.fill('input[placeholder="Enter source name"]', "Loading Test");
      await page.fill('input[placeholder="Enter file path"]', "/loading/test");

      // Mock slow API response to see loading state
      await page.route("**/api/sources", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "test",
            name: "Loading Test",
            type: "local",
          }),
        });
      });

      // Click submit and immediately check for loading state
      await page.click('button:has-text("Create")');

      // Verify loading state
      await expect(page.locator('button:has-text("Saving...")')).toBeVisible();

      // Wait for completion
      await expect(
        page.locator('h2:has-text("Add Media Source")')
      ).not.toBeVisible();
    });

    test("should show loading state when deleting", async ({ page }) => {
      await page.click('button:has-text("Delete")').first();

      // Mock slow delete API response
      await page.route("**/api/sources/*", async (route) => {
        if (route.request().method() === "DELETE") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await route.fulfill({ status: 200 });
        } else {
          await route.continue();
        }
      });

      // Confirm deletion and check loading state
      await page.click('button:has-text("Delete")').last();

      // Verify loading state
      await expect(
        page.locator('button:has-text("Deleting...")')
      ).toBeVisible();
    });
  });

  test.describe("Error Handling", () => {
    test("should handle create API errors gracefully", async ({ page }) => {
      await page.click('button:has-text("Add Source")');

      await page.fill('input[placeholder="Enter source name"]', "Error Test");
      await page.fill('input[placeholder="Enter file path"]', "/error/test");

      // Mock API error
      await page.route("**/api/sources", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Internal Server Error" }),
          });
        } else {
          await route.continue();
        }
      });

      await page.click('button:has-text("Create")');

      // Modal should remain open on error
      await expect(
        page.locator('h2:has-text("Add Media Source")')
      ).toBeVisible();

      // Button should return to normal state
      await expect(page.locator('button:has-text("Create")')).toBeVisible();
    });

    test("should handle delete API errors gracefully", async ({ page }) => {
      await page.click('button:has-text("Delete")').first();

      // Mock API error
      await page.route("**/api/sources/*", async (route) => {
        if (route.request().method() === "DELETE") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Failed to delete" }),
          });
        } else {
          await route.continue();
        }
      });

      await page.click('button:has-text("Delete")').last();

      // Modal should remain open on error
      await expect(
        page.locator('h2:has-text("Delete Media Source")')
      ).toBeVisible();

      // Button should return to normal state
      await expect(
        page.locator('button:has-text("Delete")').last()
      ).toBeVisible();
    });
  });
});
