import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log("Navigating to home...");
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(5000); // Wait for hydration

    console.log("Taking home screenshot...");
    await page.screenshot({ path: 'verification-home.png' });

    // Check if there are any media items
    const mediaItems = page.locator('a[href*="/sources/"]');
    const count = await mediaItems.count();
    console.log(`Found ${count} media items`);

    if (count > 0) {
      await mediaItems.first().click();
      console.log("Navigating to media detail...");
      await page.waitForTimeout(5000); // Wait for load

      console.log("Taking detail screenshot...");
      await page.screenshot({ path: 'verification-detail.png' });
    } else {
        console.log("No media items found to verify detail view.");
    }

  } catch (error) {
    console.error("Error during verification:", error);
  } finally {
    await browser.close();
  }
})();
