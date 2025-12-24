
import asyncio
from playwright.async_api import async_playwright, expect

async def verify_dump_ui():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Check if server is up
        try:
            await page.goto("http://localhost:3000", timeout=10000)
        except Exception as e:
            print(f"Server might not be ready: {e}")
            return

        # Get the source ID (created in previous step)
        response = await page.request.get("http://localhost:3000/api/sources")
        sources = await response.json()
        if not sources:
            print("No sources found. Create one manually via curl.")
            return

        source_id = sources[0]['id']
        print(f"Testing with source ID: {source_id}")

        # Navigate to the source page
        # Don't wait for networkidle as it can be flaky with SSE or streaming
        await page.goto(f"http://localhost:3000/sources/{source_id}", wait_until="domcontentloaded")

        # Wait a bit for JS to hydrate and components to render
        await page.wait_for_timeout(2000)

        # Take a screenshot of the whole page
        await page.screenshot(path="verification/source_page.png")

        # Look for the download buttons
        # JSON Download Button (File Json Icon)
        json_btn = page.get_by_title("Download Backup JSON")
        await expect(json_btn).to_be_visible()

        # ZIP Download Button (Archive Icon)
        zip_btn = page.get_by_title("Download Backup ZIP (with Images)")
        await expect(zip_btn).to_be_visible()

        # Take a specific screenshot of the buttons area (navbar)
        header = page.locator("nav").first
        # Or just use the button container. The buttons are in a Portal, likely appended to document body or a specific container.
        # But visually they appear in the navbar.

        # Let's take screenshot of the top of the page
        await page.screenshot(path="verification/navbar_buttons.png", clip={"x": 0, "y": 0, "width": 1280, "height": 100})

        print("Verification successful: Buttons found.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_dump_ui())
